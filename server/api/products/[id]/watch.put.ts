/**
 * Suivre / ne plus suivre un produit, pour l'abonné courant (cookie).
 * Corps : { watching: boolean, targetPriceCents?: number | null }
 */
export default defineEventHandler(async (event) => {
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id)) throw createError({ statusCode: 400, message: 'Identifiant invalide.' })
  await enforceRateLimit(event, 'watch')

  const body = await readBody<{ watching?: unknown, targetPriceCents?: unknown }>(event)
  if (typeof body?.watching !== 'boolean') throw createError({ statusCode: 400, message: 'Champ « watching » attendu (booléen).' })

  const target = body.targetPriceCents
  if (target != null && !(Number.isInteger(target) && (target as number) > 0 && (target as number) < 100_000_000)) {
    throw createError({ statusCode: 400, message: 'Prix cible invalide.' })
  }

  if (!body.watching) {
    const subscriberId = await getSubscriberId(event)
    if (subscriberId) await removeWatch(subscriberId, id)
    return { watch: null }
  }
  const subscriberId = await requireSubscriberId(event)
  if (!await getWatch(subscriberId, id) && await countWatches(subscriberId) >= MAX_WATCHES_PER_SUBSCRIBER) {
    throw createError({ statusCode: 409, message: `Tu suis déjà ${MAX_WATCHES_PER_SUBSCRIBER} produits : arrête d'en suivre un pour en ajouter un autre.` })
  }
  return { watch: await setWatch(subscriberId, id, { targetPriceCents: (target as number | null | undefined) ?? null }) }
})
