import { describe, expect, it, vi } from 'vitest'
import { EbayError, ebaySearchUrl, fetchEbayToken, searchEbay, toItem } from '../server/lib/ebay'

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

describe('fetchEbayToken', () => {
  it('demande un jeton d\'application avec les clés en Basic', async () => {
    const fetchImpl = vi.fn(async () => json({ access_token: 'tok', expires_in: 7200, token_type: 'Application Access Token' }))
    const token = await fetchEbayToken({ clientId: 'id', clientSecret: 'secret' }, fetchImpl as unknown as typeof fetch)
    expect(token).toEqual({ accessToken: 'tok', expiresInSec: 7200 })
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe('https://api.ebay.com/identity/v1/oauth2/token')
    expect((init.headers as Record<string, string>).authorization).toBe(`Basic ${btoa('id:secret')}`)
    expect(String(init.body)).toContain('grant_type=client_credentials')
  })

  it('signale des clés refusées', async () => {
    const fetchImpl = async () => json({ error: 'invalid_client' }, 401)
    await expect(fetchEbayToken({ clientId: 'id', clientSecret: 'bad' }, fetchImpl as unknown as typeof fetch)).rejects.toMatchObject({ status: 401 })
  })
})

describe('ebaySearchUrl', () => {
  it('limite aux annonces livrables en France', () => {
    const url = new URL(ebaySearchUrl('  vélo pliant '))
    expect(url.searchParams.get('q')).toBe('vélo pliant')
    expect(url.searchParams.get('filter')).toBe('deliveryCountry:FR')
    expect(url.searchParams.has('sort')).toBe(false)
  })

  it('filtre l\'état et trie par prix', () => {
    const url = new URL(ebaySearchUrl('vélo', { condition: 'used', sort: 'price' }))
    expect(url.searchParams.get('filter')).toBe('deliveryCountry:FR,conditions:{USED}')
    expect(url.searchParams.get('sort')).toBe('price')
  })
})

describe('toItem', () => {
  const base = { itemId: 'v1|1|0', title: 'Vélo pliant', itemWebUrl: 'https://www.ebay.fr/itm/1', price: { value: '149.90', currency: 'EUR' } }

  it('prend le port le moins cher', () => {
    const item = toItem({
      ...base,
      buyingOptions: ['FIXED_PRICE', 'BEST_OFFER'],
      condition: 'Occasion',
      conditionId: '3000',
      shippingOptions: [{ shippingCost: { value: '12.00', currency: 'EUR' } }, { shippingCost: { value: '8.50', currency: 'EUR' } }],
      itemLocation: { country: 'DE' },
    })
    expect(item).toMatchObject({ priceCents: 14990, shippingCents: 850, isNew: false, auction: false, endsAt: null, country: 'DE' })
  })

  it('enchère : prix de l\'enchère en cours et date de fin', () => {
    const item = toItem({ ...base, buyingOptions: ['AUCTION'], currentBidPrice: { value: '42.00', currency: 'EUR' }, itemEndDate: '2026-10-05T18:00:00.000Z' })
    expect(item).toMatchObject({ priceCents: 4200, auction: true, endsAt: '2026-10-05T18:00:00.000Z' })
  })

  it('port gratuit, port inconnu, neuf', () => {
    expect(toItem({ ...base, conditionId: '1000', shippingOptions: [{ shippingCost: { value: '0.00', currency: 'EUR' } }] }))
      .toMatchObject({ shippingCents: 0, isNew: true })
    expect(toItem({ ...base, shippingOptions: [{ shippingCostType: 'CALCULATED' }] })?.shippingCents).toBeNull()
  })

  it('ignore une annonce sans prix', () => {
    expect(toItem({ ...base, price: undefined })).toBeNull()
  })
})

describe('searchEbay', () => {
  it('interroge eBay.fr avec le jeton et normalise les annonces', async () => {
    const fetchImpl = vi.fn(async () => json({
      total: 1234,
      itemSummaries: [
        { itemId: '1', title: 'A', itemWebUrl: 'https://www.ebay.fr/itm/1', price: { value: '10.00', currency: 'EUR' } },
        { itemId: '2', title: 'Sans prix', itemWebUrl: 'https://www.ebay.fr/itm/2' },
      ],
    }))
    const result = await searchEbay('vélo', 'tok', {}, fetchImpl as unknown as typeof fetch)
    expect(result.total).toBe(1234)
    expect(result.items.map(i => i.id)).toEqual(['1'])
    const [, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    expect(init.headers).toMatchObject({ 'authorization': 'Bearer tok', 'x-ebay-c-marketplace-id': 'EBAY_FR' })
  })

  it('aucun résultat', async () => {
    const result = await searchEbay('zzz', 'tok', {}, (async () => json({ total: 0 })) as unknown as typeof fetch)
    expect(result).toEqual({ total: 0, items: [] })
  })

  it('quota atteint', async () => {
    const err = await searchEbay('vélo', 'tok', {}, (async () => json({}, 429)) as unknown as typeof fetch).catch(e => e)
    expect(err).toBeInstanceOf(EbayError)
    expect(err.status).toBe(429)
  })
})
