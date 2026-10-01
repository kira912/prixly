export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'lookup')
  const body = await readBody<{ input?: unknown, refresh?: unknown }>(event)
  const input = typeof body?.input === 'string' ? body.input.trim() : ''
  if (!input || input.length > 4000) {
    throw createError({ statusCode: 400, message: 'Colle un lien Amazon ou AliExpress.' })
  }

  try {
    const result = await lookupProduct(input, { refresh: body.refresh === true })
    // Appel côté navigateur (formulaire, partage) : c'est ici que le cookie anonyme peut être posé
    await recordView(await requireSubscriberId(event), result.product.id)
    return result
  }
  catch (err) {
    throw toHttpError(err)
  }
})
