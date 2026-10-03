import { fetchEbayToken, searchEbay, type EbayCondition, type EbayCredentials, type EbaySort } from '../lib/ebay'

/** Résultats gardés 15 min : une recherche relancée ou partagée ne consomme pas le quota eBay */
const SEARCH_TTL_SEC = 15 * 60

/** Clés de l'appli eBay (developer.ebay.com, clés « Production »), ou null si la recherche eBay n'est pas configurée */
export function ebayCredentials(): EbayCredentials | null {
  const { ebayClientId: clientId, ebayClientSecret: clientSecret } = useRuntimeConfig()
  return clientId && clientSecret ? { clientId, clientSecret } : null
}

/** Jeton d'application (valable 2 h), partagé entre instances via la table kv */
async function ebayToken(credentials: EbayCredentials): Promise<string> {
  const cached = await kvGet<string>('ebay:token')
  if (cached) return cached
  const token = await fetchEbayToken(credentials)
  await kvSet('ebay:token', token.accessToken, { ttlSec: Math.max(60, token.expiresInSec - 300) })
  return token.accessToken
}

export async function cachedEbaySearch(credentials: EbayCredentials, query: string, opts: { condition?: EbayCondition, sort?: EbaySort }) {
  const key = `ebay:search:${opts.condition ?? 'all'}:${opts.sort ?? 'relevance'}:${query.trim().toLowerCase()}`
  const cached = await kvGet<Awaited<ReturnType<typeof searchEbay>>>(key)
  if (cached) return cached
  const result = await searchEbay(query, await ebayToken(credentials), opts)
  await kvSet(key, result, { ttlSec: SEARCH_TTL_SEC })
  return result
}
