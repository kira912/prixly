import { EbayError } from '../lib/ebay'

export default defineEventHandler(async (event) => {
  const { query, condition, sort } = searchParams(getQuery(event))
  if (!query || query.length > 200) throw localizedError(event, 400, 'errors.searchInvalid')

  const credentials = ebayCredentials()
  if (!credentials) return { configured: false, assistant: false, total: 0, items: [] }

  await enforceRateLimit(event, 'search')
  try {
    const result = await cachedEbaySearch(credentials, query, { condition, sort, locale: eventLocale(event) })
    return { configured: true, assistant: useLlm().enabled, ...result }
  }
  catch (err) {
    if (err instanceof EbayError) {
      if (err.status === 401) console.error('[search]', err.message)
      throw localizedError(event, 502, err.status === 429 ? 'errors.ebayQuota' : 'errors.ebayDown')
    }
    throw localizedError(event, 502, 'errors.ebayDown')
  }
})
