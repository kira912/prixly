export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'lookup')
  const body = await readBody<{ input?: unknown, refresh?: unknown }>(event)
  const input = typeof body?.input === 'string' ? body.input.trim() : ''
  if (!input || input.length > 4000) {
    throw localizedError(event, 400, 'errors.pasteLink')
  }

  try {
    const result = await lookupProduct(input, { refresh: body.refresh === true })
    await recordView(await requireSubscriberId(event), result.product.id)
    return result
  }
  catch (err) {
    throw toHttpError(event, err)
  }
})
