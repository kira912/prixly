export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@vite-pwa/nuxt'],
  css: ['~/assets/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Prixly',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0f766e' },
        { name: 'description', content: 'Comparateur de prix entre marketplaces' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' },
      ],
    },
  },

  runtimeConfig: {
    // Surchargeables via NUXT_DB_URL / NUXT_DB_AUTH_TOKEN / NUXT_MIGRATIONS_DIR
    // Vides : repli sur TURSO_DATABASE_URL / TURSO_AUTH_TOKEN (intégration Turso de Vercel), puis fichier local (server/utils/db.ts)
    dbUrl: '',
    dbAuthToken: '',
    migrationsDir: './server/database/migrations',
    // Web Push : générer avec `pnpm vapid`, puis NUXT_VAPID_PUBLIC_KEY / NUXT_VAPID_PRIVATE_KEY / NUXT_VAPID_SUBJECT
    vapidPublicKey: '',
    vapidPrivateKey: '',
    vapidSubject: 'mailto:prixly@example.com',
    // Lire l'IP client dans X-Forwarded-For (NUXT_TRUST_PROXY=true derrière un ingress / reverse proxy ; automatique sur Vercel)
    trustProxy: false,
  },

  nitro: {
    experimental: { tasks: true },
    // Relevé des produits suivis ; cron lu au build (PRIXLY_REFRESH_CRON), toutes les 6 h par défaut.
    // Serveur Node uniquement : sur Vercel, pas de process permanent, le relevé passe par /api/cron/refresh
    scheduledTasks: process.env.VERCEL
      ? {}
      : { [process.env.PRIXLY_REFRESH_CRON ?? '0 */6 * * *']: ['prices:refresh'] },
  },

  pwa: {
    registerType: 'autoUpdate',
    // Service worker maison (app/service-worker/sw.ts) pour recevoir les notifications push
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.ts',
    manifest: {
      name: 'Prixly',
      short_name: 'Prixly',
      description: 'Partage un produit, compare le vrai prix.',
      lang: 'fr',
      start_url: '/',
      scope: '/',
      display: 'standalone',
      background_color: '#f8fafc',
      theme_color: '#0f766e',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ],
      // Web Share Target : Prixly apparaît dans la feuille « Partager » d'Android
      share_target: {
        action: '/share',
        method: 'GET',
        params: { title: 'title', text: 'text', url: 'url' },
      },
    },
    injectManifest: {
      // Pages rendues côté serveur : seuls les assets statiques sont mis en cache
      globPatterns: ['**/*.{js,css,png,svg,ico,woff2}'],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false, type: 'module' },
  },
})
