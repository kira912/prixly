/** Enregistre l'abonnement Web Push du navigateur (PushSubscription.toJSON()). */
export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'pushSubscribe')
  const body = await readBody<{ endpoint?: unknown, keys?: { p256dh?: unknown, auth?: unknown } }>(event)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    throw createError({ statusCode: 400, message: 'Abonnement push invalide.' })
  }
  // Le serveur enverra des requêtes vers cet endpoint : https uniquement, sans adresse locale
  let url: URL
  try {
    url = new URL(endpoint)
  }
  catch {
    throw createError({ statusCode: 400, message: 'Abonnement push invalide.' })
  }
  if (url.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) {
    throw createError({ statusCode: 400, message: 'Endpoint push refusé.' })
  }

  await saveSubscription(await requireSubscriberId(event), { endpoint, keys: { p256dh, auth } })
  return { ok: true }
})
