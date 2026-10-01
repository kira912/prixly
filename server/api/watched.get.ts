export default defineEventHandler(async event => (await listWatched(await getSubscriberId(event))).items)
