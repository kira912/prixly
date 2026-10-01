import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  dialect: 'turso',
  schema: './server/database/schema.ts',
  out: './server/database/migrations',
  dbCredentials: {
    url: process.env.NUXT_DB_URL ?? 'file:./data/prixly.db',
    authToken: process.env.NUXT_DB_AUTH_TOKEN || undefined,
  },
})
