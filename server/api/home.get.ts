export default defineEventHandler(async (event) => {
  const subscriberId = await getSubscriberId(event)
  const [watched, recent] = await Promise.all([listWatched(subscriberId, 5), listRecent(subscriberId, 5)])
  return { watched: watched.items, watchedTotal: watched.total, recent }
})
