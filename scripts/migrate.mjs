// Applique les migrations Drizzle sur la base NUXT_DB_URL (Turso en prod).
// Lancé par le build Vercel (vercel.json) : en serverless, l'appli ne migre pas au démarrage.
import { createClient } from '@libsql/client'
import { drizzle } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'

const url = process.env.NUXT_DB_URL
if (!url) {
  console.error('NUXT_DB_URL manquant (libsql://… pour Turso, file:… en local).')
  process.exit(1)
}

const client = createClient({ url, authToken: process.env.NUXT_DB_AUTH_TOKEN || undefined })
await migrate(drizzle(client), { migrationsFolder: './server/database/migrations' })
client.close()
console.log(`Migrations appliquées sur ${new URL(url).host || url}`)
