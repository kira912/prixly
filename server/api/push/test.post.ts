export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'pushTest')
  if (!pushEnabled()) throw localizedError(event, 503, 'errors.pushNotConfigured')
  const subscriberId = await getSubscriberId(event)
  const sent = subscriberId
    ? await sendToSubscriber(subscriberId, { title: 'Prixly', body: useServerT(event)('alerts.testBody'), url: '/', tag: 'test' })
    : 0
  if (!sent) throw localizedError(event, 404, 'errors.noDevice')
  return { sent }
})
