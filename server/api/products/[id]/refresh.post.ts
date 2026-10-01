export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Identifiant invalide.' })
  await enforceRateLimit(event, 'refresh')

  try {
    return { product: await refreshProduct(id) }
  }
  catch (err) {
    throw toHttpError(err)
  }
})
