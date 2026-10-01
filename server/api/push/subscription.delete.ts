export default defineEventHandler(async (event) => {
  const body = await readBody<{ endpoint?: unknown }>(event)
  const subscriberId = await getSubscriberId(event)
  if (subscriberId && typeof body?.endpoint === 'string') await deleteSubscription(subscriberId, body.endpoint)
  return { ok: true }
})
