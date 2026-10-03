import { describe, expect, it } from 'vitest'
import { applyCuration, CurationSchema, curationPrompt } from '../server/lib/curate'
import type { EbayItem } from '../server/lib/ebay'

const item = (id: string, title: string, priceCents: number, shippingCents: number | null = 0, extra: Partial<EbayItem> = {}): EbayItem => ({
  id, title, url: `https://www.ebay.fr/itm/${id}`, image: null, priceCents, shippingCents, currency: 'EUR',
  condition: 'Occasion', isNew: false, auction: false, endsAt: null, country: 'FR', sellerFeedbackPct: 99, ...extra,
})

const items = [
  item('a', 'iPhone 13 128 Go bleu', 42000, 500),
  item('b', 'Coque iPhone 13 silicone', 900),
  item('c', 'iPhone 13 128Go minuit batterie 89%', 39000, 0),
  item('d', 'iPhone 13 256 Go', 47000, null),
  item('e', 'iPhone 13 écran cassé pour pièces', 9000),
]

describe('curationPrompt', () => {
  it('numérote les annonces avec le prix port compris', () => {
    const prompt = curationPrompt(' iphone 13 ', [items[0]!, item('x', 'Lot', 1000, 250, { auction: true, condition: null })])
    expect(prompt).toContain('Recherche : « iphone 13 »')
    expect(prompt).toContain('[0] iPhone 13 128 Go bleu | 425.00 EUR port compris | Occasion')
    expect(prompt).toContain('[1] Lot | 12.50 EUR port compris | enchère')
  })
})

describe('applyCuration', () => {
  const output = CurationSchema.parse({
    items: [
      { n: 0, kind: 'product', group: 'iPhone 13 · 128 Go', units: 1, note: '' },
      { n: 1, kind: 'accessory', group: '', units: 1, note: '' },
      { n: 2, kind: 'product', group: 'iphone 13 · 128 go ', units: 1, note: 'batterie 89 %' },
      { n: 3, kind: 'product', group: 'iPhone 13 · 256 Go', units: 1, note: '' },
      { n: 4, kind: 'for_parts', group: '', units: 1, note: 'écran cassé' },
    ],
  })

  it('regroupe par produit, du groupe le plus fourni au moins fourni, moins cher en tête', () => {
    const { groups } = applyCuration(items, output)
    expect(groups.map(g => g.label)).toEqual(['iPhone 13 · 128 Go', 'iPhone 13 · 256 Go'])
    expect(groups[0]!.entries.map(e => e.item.id)).toEqual(['c', 'a'])
    expect(groups[0]!.fromCents).toBe(39000)
    expect(groups[0]!.entries[0]!.note).toBe('batterie 89 %')
  })

  it('écarte accessoires et pièces avec leur raison', () => {
    const { hidden } = applyCuration(items, output)
    expect(hidden.map(h => [h.item.id, h.kind])).toEqual([['b', 'accessory'], ['e', 'for_parts']])
  })

  it('calcule le prix à l\'unité d\'un lot', () => {
    const lot = [item('p', 'Piles CR2032 x8', 1200, 400)]
    const { groups } = applyCuration(lot, { items: [{ n: 0, kind: 'product', group: 'CR2032', units: 8, note: '' }] })
    expect(groups[0]!.entries[0]).toMatchObject({ units: 8, unitTotalCents: 200 })
  })

  it('ignore les numéros inventés ou en double, garde les oubliées à part', () => {
    const result = applyCuration(items.slice(0, 3), {
      items: [
        { n: 0, kind: 'product', group: 'iPhone 13', units: 1, note: '' },
        { n: 0, kind: 'accessory', group: '', units: 1, note: '' },
        { n: 42, kind: 'product', group: 'Fantôme', units: 1, note: '' },
        { n: 1, kind: 'accessory', group: '', units: 0, note: '' },
      ],
    })
    expect(result.groups.map(g => g.label)).toEqual(['iPhone 13'])
    expect(result.hidden.map(h => h.item.id)).toEqual(['b'])
    expect(result.hidden[0]!.units).toBe(1)
    expect(result.unsorted.map(i => i.id)).toEqual(['c'])
  })
})
