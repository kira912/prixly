export default defineEventHandler(async (event) => {
  await enforceRateLimit(event, 'pushTest')
  if (!pushEnabled()) throw createError({ statusCode: 503, message: 'Notifications non configurées sur le serveur (clés VAPID manquantes).' })
  const subscriberId = await getSubscriberId(event)
  const sent = subscriberId
    ? await sendToSubscriber(subscriberId, { title: 'Prixly', body: 'Les alertes de prix fonctionnent sur cet appareil.', url: '/', tag: 'test' })
    : 0
  if (!sent) throw createError({ statusCode: 404, message: 'Aucun appareil abonné aux notifications.' })
  return { sent }
})
