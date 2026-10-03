export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const product = Number.isInteger(id) ? await getProduct(id) : undefined
  if (!product) throw createError({ statusCode: 404, message: 'Produit inconnu.' })
  await enforceRateLimit(event, 'compare')
  return { offers: await compareMarketplaces(product) }
})
