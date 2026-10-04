const API = 'https://api.ebay.com'
const SCOPE = 'https://api.ebay.com/oauth/api_scope'

export type EbayCondition = 'new' | 'used'
export type EbaySort = 'relevance' | 'price'

export interface EbayCredentials { clientId: string, clientSecret: string }

export interface EbayToken { accessToken: string, expiresInSec: number }

export interface EbayItem {
  id: string
  title: string
  url: string
  image: string | null
  priceCents: number
  shippingCents: number | null
  currency: string
  condition: string | null
  isNew: boolean
  auction: boolean
  endsAt: string | null
  country: string | null
  sellerFeedbackPct: number | null
}

export class EbayError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'EbayError'
  }
}

export async function fetchEbayToken({ clientId, clientSecret }: EbayCredentials, fetchImpl: typeof fetch = fetch): Promise<EbayToken> {
  const res = await fetchImpl(`${API}/identity/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'authorization': `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE }).toString(),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) throw new EbayError(res.status, `eBay authentication refused (${res.status}): check NUXT_EBAY_CLIENT_ID / NUXT_EBAY_CLIENT_SECRET.`)
  const body = await res.json() as { access_token: string, expires_in: number }
  return { accessToken: body.access_token, expiresInSec: body.expires_in }
}

export function ebaySearchUrl(query: string, { condition, sort, limit = 30 }: { condition?: EbayCondition, sort?: EbaySort, limit?: number } = {}): string {
  const filters = ['deliveryCountry:FR']
  if (condition) filters.push(`conditions:{${condition === 'new' ? 'NEW' : 'USED'}}`)
  const params = new URLSearchParams({ q: query.trim(), limit: String(limit), filter: filters.join(',') })
  if (sort === 'price') params.set('sort', 'price')
  return `${API}/buy/browse/v1/item_summary/search?${params}`
}

export async function searchEbay(
  query: string,
  token: string,
  opts: { condition?: EbayCondition, sort?: EbaySort, limit?: number, language?: string } = {},
  fetchImpl: typeof fetch = fetch,
): Promise<{ total: number, items: EbayItem[] }> {
  const res = await fetchImpl(ebaySearchUrl(query, opts), {
    headers: {
      'authorization': `Bearer ${token}`,
      'x-ebay-c-marketplace-id': 'EBAY_FR',
      'x-ebay-c-enduserctx': 'contextualLocation=country%3DFR',
      'accept-language': opts.language ?? 'fr-FR',
    },
    signal: AbortSignal.timeout(10_000),
  })
  if (res.status === 429) throw new EbayError(429, 'Daily eBay API quota reached.')
  if (!res.ok) throw new EbayError(res.status, `eBay search failed (${res.status}).`)
  const body = await res.json() as { total?: number, itemSummaries?: RawItem[] }
  const items = (body.itemSummaries ?? []).map(toItem).filter((i): i is EbayItem => i !== null)
  return { total: body.total ?? items.length, items }
}

interface Money { value?: string, currency?: string }
interface RawItem {
  itemId?: string
  title?: string
  itemWebUrl?: string
  image?: { imageUrl?: string }
  thumbnailImages?: { imageUrl?: string }[]
  price?: Money
  currentBidPrice?: Money
  buyingOptions?: string[]
  condition?: string
  conditionId?: string
  itemEndDate?: string
  itemLocation?: { country?: string }
  shippingOptions?: { shippingCostType?: string, shippingCost?: Money }[]
  seller?: { feedbackPercentage?: string }
}

function cents(m: Money | undefined): number | null {
  const n = Number(m?.value)
  return m?.value != null && Number.isFinite(n) ? Math.round(n * 100) : null
}

export function toItem(raw: RawItem): EbayItem | null {
  const auction = !raw.buyingOptions?.includes('FIXED_PRICE') && Boolean(raw.buyingOptions?.includes('AUCTION'))
  const money = (auction && raw.currentBidPrice) || raw.price
  const priceCents = cents(money)
  if (!raw.itemId || !raw.title || !raw.itemWebUrl || priceCents == null) return null
  const currency = money?.currency ?? 'EUR'

  const shipping = (raw.shippingOptions ?? [])
    .filter(o => o.shippingCost && (o.shippingCost.currency ?? currency) === currency)
    .map(o => cents(o.shippingCost))
    .filter((c): c is number => c != null)
  const conditionId = Number(raw.conditionId)

  return {
    id: raw.itemId,
    title: raw.title,
    url: raw.itemWebUrl,
    image: raw.image?.imageUrl ?? raw.thumbnailImages?.[0]?.imageUrl ?? null,
    priceCents,
    shippingCents: shipping.length ? Math.min(...shipping) : null,
    currency,
    condition: raw.condition ?? null,
    isNew: conditionId >= 1000 && conditionId < 2000,
    auction,
    endsAt: auction ? raw.itemEndDate ?? null : null,
    country: raw.itemLocation?.country ?? null,
    sellerFeedbackPct: raw.seller?.feedbackPercentage != null ? Number(raw.seller.feedbackPercentage) : null,
  }
}
