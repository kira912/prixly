export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw localizedError(event, 400, 'errors.invalidId')
  await enforceRateLimit(event, 'refresh')

  let product
  try {
    product = await refreshProduct(id)
  }
  catch (err) {
    throw toHttpError(event, err)
  }
  if (!product) throw localizedError(event, 404, 'errors.unknownProduct')
  return { product }
})
