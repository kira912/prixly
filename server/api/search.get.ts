import { EbayError, type EbayCondition, type EbaySort } from '../lib/ebay'

/** Vraies annonces pour une recherche (eBay pour l'instant). Sans clés eBay, répond configured: false et la page se contente des liens. */
export default defineEventHandler(async (event) => {
  const { q, condition, sort } = getQuery(event)
  const query = typeof q === 'string' ? q.trim() : ''
  if (!query || query.length > 200) throw createError({ statusCode: 400, message: 'Recherche vide ou trop longue.' })

  const credentials = ebayCredentials()
  if (!credentials) return { configured: false, total: 0, items: [] }

  await enforceRateLimit(event, 'search')
  try {
    const result = await cachedEbaySearch(credentials, query, {
      condition: condition === 'new' || condition === 'used' ? condition as EbayCondition : undefined,
      sort: sort === 'price' ? sort as EbaySort : undefined,
    })
    return { configured: true, ...result }
  }
  catch (err) {
    if (err instanceof EbayError) {
      // Clés invalides : le détail sert à l'admin, pas à l'utilisateur
      if (err.status === 401) console.error('[search]', err.message)
      throw createError({ statusCode: 502, message: err.status === 429 ? err.message : 'eBay ne répond pas pour le moment.' })
    }
    throw createError({ statusCode: 502, message: 'eBay ne répond pas pour le moment.' })
  }
})
