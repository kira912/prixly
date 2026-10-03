import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'
import { parseAliExpressResult } from '../server/lib/extractors/aliexpress'
import { parseAmazonHtml } from '../server/lib/extractors/amazon'

const fixture = (name: string) => gunzipSync(readFileSync(new URL(`./fixtures/${name}`, import.meta.url))).toString('utf8')

describe('parseAmazonHtml', () => {
  const ref = { platform: 'amazon' as const, externalId: 'B06VW5BH2K', url: 'https://www.amazon.fr/dp/B06VW5BH2K' }
  const html = fixture('amazon-B06VW5BH2K.html.gz')

  it('extrait les infos produit', () => {
    const p = parseAmazonHtml(html, ref, new Date(2026, 8, 29))
    expect(p).toMatchObject({
      ...ref,
      title: 'DURACELL 2032 Piles Boutons au Lithium (Lot de 8) 3V, CR2032',
      currency: 'EUR',
      // Achat ponctuel, pas le prix « abonnez-vous » (10,19 €)
      priceCents: 1199,
      // « Prix unique » barré = offre sans abonnement, hors du bloc prix principal : pas un prix barré
      listPriceCents: null,
      shippingCents: 0,
      deliveryText: 'vendredi 2 octobre',
      deliveryMinDays: 3,
      deliveryMaxDays: 3,
      rating: 4.7,
      reviewCount: 141570,
    })
    expect(p.image).toMatch(/^https:\/\/m\.media-amazon\.com\/images\/I\//)
  })

  it('lit le prix barré du bloc prix principal', () => {
    const page = `<span id="productTitle">Produit</span>
      <div id="corePriceDisplay_desktop_feature_div">
        <span class="a-price apex-pricetopay-value"><span class="a-offscreen">14,99 €</span></span>
        <span class="basisPrice">Prix conseillé : <span class="a-price a-text-price" data-a-strike="true"><span class="a-offscreen">24,99 €</span></span></span>
      </div>`
    expect(parseAmazonHtml(page, ref)).toMatchObject({ priceCents: 1499, listPriceCents: 2499 })
  })

  it('échoue proprement sur une page sans produit', () => {
    expect(() => parseAmazonHtml('<html><body>Page introuvable</body></html>', ref)).toThrow(/Titre/)
  })
})

describe('parseAliExpressResult', () => {
  const ref = { platform: 'aliexpress' as const, externalId: '1005009561948552', url: 'https://fr.aliexpress.com/item/1005009561948552.html' }
  const result = JSON.parse(fixture('aliexpress-1005009561948552.json.gz')).data.result

  it('extrait prix, livraison et délai', () => {
    const p = parseAliExpressResult(result, ref)
    expect(p).toMatchObject({
      ...ref,
      title: expect.stringContaining('Câble de charge USB Type C'),
      currency: 'EUR',
      priceCents: 247,
      // Prix d'origine = prix de vente : pas de remise
      listPriceCents: null,
      shippingCents: 199,
      deliveryMinDays: 4,
      deliveryMaxDays: 9,
      deliveryText: '03 oct. – 08 oct.',
      rating: 4.5,
      reviewCount: 7624,
    })
    expect(p.shippingNote).toBe('AliExpress Selection Standard · gratuite dès 10,00€ d\'achat · expédié depuis Chine')
    expect(p.image).toMatch(/^https:\/\/ae-pic-a1\.aliexpress-media\.com\//)
  })

  it('lit le prix avant remise', () => {
    const discounted = structuredClone(result)
    discounted.GLOBAL_DATA.globalData.eventInfo.clcEvent.originalPriceCent = 499
    expect(parseAliExpressResult(discounted, ref).listPriceCents).toBe(499)
  })

  it('signale un produit introuvable', () => {
    expect(() => parseAliExpressResult({}, ref)).toThrow(/introuvable/)
  })
})
