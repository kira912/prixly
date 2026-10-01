export default defineEventHandler(async (event) => {
  const subscriberId = await getSubscriberId(event)
  return {
    enabled: pushEnabled(),
    publicKey: useRuntimeConfig().vapidPublicKey || null,
    /** Nombre d'appareils abonnés pour l'utilisateur courant */
    devices: subscriberId ? await countSubscriptions(subscriberId) : 0,
  }
})
