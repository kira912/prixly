import { EbayError, type EbayCondition, type EbaySort } from '../../lib/ebay'

/**
 * Tri par l'IA des annonces eBay d'une recherche. Le serveur relit lui-même les annonces (en cache depuis /api/search) :
 * le client n'envoie que la recherche, il ne peut donc pas faire classer n'importe quel texte à nos frais.
 */
export default defineEventHandler(async (event) => {
  const { q, condition: c, sort: s } = getQuery(event)
  const query = typeof q === 'string' ? q.trim() : ''
  if (!query || query.length > 200) throw createError({ statusCode: 400, message: 'Recherche vide ou trop longue.' })

  const credentials = ebayCredentials()
  const anthropic = anthropicClient()
  if (!credentials || !anthropic) throw createError({ statusCode: 404, message: 'Le tri par l\'IA n\'est pas activé.' })

  await enforceRateLimit(event, 'curate')
  const condition = c === 'new' || c === 'used' ? c as EbayCondition : undefined
  const sort = s === 'price' ? s as EbaySort : undefined

  try {
    const { items } = await cachedEbaySearch(credentials, query, { condition, sort })
    if (!items.length) return { groups: [], hidden: [], unsorted: [] }
    return await cachedCuration(anthropic, `${condition ?? 'all'}:${sort ?? 'relevance'}:${query.toLowerCase()}`, query, items)
  }
  catch (err) {
    if (err instanceof CurateError) throw createError({ statusCode: err.statusCode, message: err.message })
    if (err instanceof EbayError) throw createError({ statusCode: 502, message: 'eBay ne répond pas pour le moment.' })
    throw err
  }
})
