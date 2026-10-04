export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',
  devtools: { enabled: false },
  modules: ['@vite-pwa/nuxt', '@nuxtjs/i18n'],
  css: ['~/assets/main.css'],

  app: {
    head: {
      title: 'Prixly',
      meta: [
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
        { name: 'theme-color', content: '#0f766e' },
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/icon-192.png' },
      ],
    },
  },

  runtimeConfig: {
    dbUrl: '',
    dbAuthToken: '',
    migrationsDir: './server/database/migrations',
    vapidPublicKey: '',
    vapidPrivateKey: '',
    vapidSubject: 'mailto:prixly@example.com',
    trustProxy: false,
    accessCode: '',
    ebayClientId: '',
    ebayClientSecret: '',
    llmProvider: '',
    llmApiKey: '',
    llmBaseUrl: '',
    llmModel: '',
    llmWebSearchModel: '',
    anthropicApiKey: '',
    anthropicModel: '',
    anthropicWorkspaceId: '',
  },

  i18n: {
    strategy: 'no_prefix',
    defaultLocale: 'fr',
    locales: [
      { code: 'fr', language: 'fr-FR', name: 'Français', file: 'fr.json' },
      { code: 'en', language: 'en-GB', name: 'English', file: 'en.json' },
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'prixly_locale',
      redirectOn: 'root',
      fallbackLocale: 'fr',
    },
  },

  nitro: {
    experimental: { tasks: true },
    scheduledTasks: process.env.VERCEL
      ? {}
      : { [process.env.PRIXLY_REFRESH_CRON ?? '0 */6 * * *']: ['prices:refresh'] },
  },

  pwa: {
    registerType: 'autoUpdate',
    strategies: 'injectManifest',
    srcDir: 'service-worker',
    filename: 'sw.ts',
    manifest: {
      name: 'Prixly',
      short_name: 'Prixly',
      description: 'Share a product, compare the real price.',
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
      share_target: {
        action: '/share',
        method: 'GET',
        params: { title: 'title', text: 'text', url: 'url' },
      },
    },
    injectManifest: {
      globPatterns: ['**/*.{js,css,png,svg,ico,woff2}'],
    },
    client: { installPrompt: true },
    devOptions: { enabled: false, type: 'module' },
  },
})
