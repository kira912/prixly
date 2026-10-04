export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw localizedError(event, 400, 'errors.invalidId')
  await enforceRateLimit(event, 'watch')

  const body = await readBody<{ watching?: unknown, targetPriceCents?: unknown }>(event)
  if (typeof body?.watching !== 'boolean') throw localizedError(event, 400, 'errors.invalidBody')

  const target = body.targetPriceCents
  if (target != null && !(Number.isInteger(target) && (target as number) > 0 && (target as number) < 100_000_000)) {
    throw localizedError(event, 400, 'errors.invalidTarget')
  }

  if (!body.watching) {
    const subscriberId = await getSubscriberId(event)
    if (subscriberId) await removeWatch(subscriberId, id)
    return { watch: null }
  }
  const subscriberId = await requireSubscriberId(event)
  if (!await getWatch(subscriberId, id) && await countWatches(subscriberId) >= MAX_WATCHES_PER_SUBSCRIBER) {
    throw localizedError(event, 409, 'errors.tooManyWatches', { max: MAX_WATCHES_PER_SUBSCRIBER })
  }
  const watch = await setWatch(subscriberId, id, { targetPriceCents: (target as number | null | undefined) ?? null })
  if (!watch) throw localizedError(event, 404, 'errors.unknownProduct')
  return { watch }
})
