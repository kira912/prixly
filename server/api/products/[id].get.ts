export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const product = Number.isInteger(id) ? await getProduct(id) : undefined
  if (!product) throw createError({ statusCode: 404, message: 'Produit inconnu.' })
  const subscriberId = await getSubscriberId(event)
  // Pas de création de cookie ici : en SSR, un Set-Cookie de cet appel interne n'atteindrait pas le navigateur
  if (subscriberId) await recordView(subscriberId, id)
  const [history, watch, offers] = await Promise.all([getPriceHistory(product), getWatch(subscriberId, id), getOffers(id)])
  return { product, ...history, watch, offers }
})
