import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

const url = process.env.NUXT_DB_URL || process.env.TURSO_DATABASE_URL
if (!url) {
  console.error('NUXT_DB_URL or TURSO_DATABASE_URL missing (libsql://… for Turso, file:… locally).')
  process.exit(1)
}

const client = createClient({ url, authToken: process.env.NUXT_DB_AUTH_TOKEN || process.env.TURSO_AUTH_TOKEN || undefined })
await migrate(drizzle(client), { migrationsFolder: './server/database/migrations' })
client.close()
console.log(`Migrations applied to ${new URL(url).host || url}`)
