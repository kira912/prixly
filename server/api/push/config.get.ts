export default defineEventHandler(async (event) => {
  const subscriberId = await getSubscriberId(event)
  return {
    enabled: pushEnabled(),
    publicKey: useRuntimeConfig().vapidPublicKey || null,
    devices: subscriberId ? await countSubscriptions(subscriberId) : 0,
  }
})
