export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const product = Number.isInteger(id) ? await getProduct(id) : undefined
  if (!product) throw localizedError(event, 404, 'errors.unknownProduct')
  const subscriberId = await getSubscriberId(event)
  if (subscriberId) await recordView(subscriberId, id)
  const [history, watch, offers] = await Promise.all([getPriceHistory(product), getWatch(subscriberId, id), getOffers(id)])
  return { product, ...history, watch, offers }
})
