export default defineEventHandler(async (event) => {
  if (!accessCode()) return { ok: true }
  await enforceRateLimit(event, 'login')
  const body = await readBody<{ code?: unknown }>(event)
  const code = typeof body?.code === 'string' ? body.code.trim() : ''
  if (!grantAccess(event, code)) throw localizedError(event, 401, 'errors.wrongCode')
  return { ok: true }
})
