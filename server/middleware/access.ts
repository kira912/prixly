const PUBLIC_PATHS = new Set(['/login', '/api/login', '/api/cron/refresh'])

export default defineEventHandler((event) => {
  if (!accessCode()) return
  const path = event.path.split('?')[0]!
  if (PUBLIC_PATHS.has(path) || path.startsWith('/_nuxt/') || /\.[a-z0-9]+$/i.test(path)) return
  if (hasAccess(event)) return

  if (path.startsWith('/api/')) {
    throw localizedError(event, 401, 'errors.accessRequired')
  }
  return sendRedirect(event, `/login?next=${encodeURIComponent(event.path)}`, 302)
})
