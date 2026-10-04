export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'pushSubscribe')
  const body = await readBody<{ endpoint?: unknown, keys?: { p256dh?: unknown, auth?: unknown } }>(event)
  const endpoint = body?.endpoint
  const p256dh = body?.keys?.p256dh
  const auth = body?.keys?.auth
  if (typeof endpoint !== 'string' || typeof p256dh !== 'string' || typeof auth !== 'string') {
    throw localizedError(event, 400, 'errors.invalidSubscription')
  }
  let url: URL
  try {
    url = new URL(endpoint)
  }
  catch {
    throw localizedError(event, 400, 'errors.invalidSubscription')
  }
  if (url.protocol !== 'https:' || /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[)/.test(url.hostname)) {
    throw localizedError(event, 400, 'errors.endpointRefused')
  }

  const subscriberId = await requireSubscriberId(event)
  await saveSubscription(subscriberId, { endpoint, keys: { p256dh, auth } })
  await setSubscriberLocale(subscriberId, eventLocale(event))
  return { ok: true }
})
