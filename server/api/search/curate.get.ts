import { EbayError } from '../../lib/ebay'
import { AiError } from '../../lib/llm'

export default defineEventHandler(async (event) => {
  const { query, condition, sort } = searchParams(getQuery(event))
  if (!query || query.length > 200) throw localizedError(event, 400, 'errors.searchInvalid')

  const credentials = ebayCredentials()
  const llm = useLlm()
  if (!credentials || !llm.enabled) throw localizedError(event, 404, 'errors.curateDisabled')

  await enforceRateLimit(event, 'curate')
  const locale = eventLocale(event)

  try {
    const { items } = await cachedEbaySearch(credentials, query, { condition, sort, locale })
    if (!items.length) return { groups: [], hidden: [], unsorted: [] }
    return await cachedCuration(llm, `${locale}:${condition ?? 'all'}:${sort ?? 'relevance'}:${query.toLowerCase()}`, query, items, locale)
  }
  catch (err) {
    if (err instanceof AiError) throw localizedError(event, err.statusCode, err.key)
    if (err instanceof EbayError) throw localizedError(event, 502, 'errors.ebayDown')
    throw err
  }
})
