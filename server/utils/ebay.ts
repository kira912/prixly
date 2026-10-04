import { fetchEbayToken, searchEbay, type EbayCondition, type EbayCredentials, type EbaySort } from '../lib/ebay'
import { intlLocale, type Locale } from '../lib/i18n'

const SEARCH_TTL_SEC = 15 * 60

export function ebayCredentials(): EbayCredentials | null {
  const { ebayClientId: clientId, ebayClientSecret: clientSecret } = useRuntimeConfig()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

async function ebayToken(credentials: EbayCredentials): Promise<string> {
  const cached = await kvGet<string>('ebay:token')
  if (cached) return cached
  const token = await fetchEbayToken(credentials)
  await kvSet('ebay:token', token.accessToken, { ttlSec: Math.max(60, token.expiresInSec - 300) })
  return token.accessToken
}

export async function cachedEbaySearch(credentials: EbayCredentials, query: string, opts: { condition?: EbayCondition, sort?: EbaySort, locale: Locale }) {
  const key = `ebay:search:${opts.locale}:${opts.condition ?? 'all'}:${opts.sort ?? 'relevance'}:${query.trim().toLowerCase()}`
  const cached = await kvGet<Awaited<ReturnType<typeof searchEbay>>>(key)
  if (cached) return cached
  const result = await searchEbay(query, await ebayToken(credentials), { condition: opts.condition, sort: opts.sort, language: intlLocale(opts.locale) })
  await kvSet(key, result, { ttlSec: SEARCH_TTL_SEC })
  return result
}

export function searchParams(query: Record<string, unknown>) {
  const { q, condition, sort } = query
  return {
    query: typeof q === 'string' ? q.trim() : '',
    condition: condition === 'new' || condition === 'used' ? condition as EbayCondition : undefined,
    sort: sort === 'price' ? sort as EbaySort : undefined,
  }
}
