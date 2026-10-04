import { otherMarketplaces } from '../../../lib/marketplaces'

export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  const product = Number.isInteger(id) ? await getProduct(id) : undefined
  if (!product) throw localizedError(event, 404, 'errors.unknownProduct')
  if (!otherMarketplaces(product).length) throw localizedError(event, 400, 'errors.amazonOnly')
  await enforceRateLimit(event, 'compare')
  return { offers: await compareMarketplaces(product) }
})
