/**
 * Appli privée : sans le cookie d'accès, les pages renvoient vers /login et l'API répond 401.
 * Restent publics la connexion, le relevé planifié (protégé par CRON_SECRET) et les fichiers statiques
 * (assets, icônes, manifeste, service worker) pour que la PWA s'installe et que la page de connexion s'affiche.
 */
const PUBLIC_PATHS = new Set(['/login', '/api/login', '/api/cron/refresh'])

export default defineEventHandler((event) => {
  if (!accessCode()) return
  const path = event.path.split('?')[0]!
  if (PUBLIC_PATHS.has(path) || path.startsWith('/_nuxt/') || /\.[a-z0-9]+$/i.test(path)) return
  if (hasAccess(event)) return

  if (path.startsWith('/api/')) {
    throw createError({ statusCode: 401, message: 'Code d\'accès requis.', data: { code: 'access_required' } })
  }
  return sendRedirect(event, `/login?next=${encodeURIComponent(event.path)}`, 302)
})
