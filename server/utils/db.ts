import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../database/schema'

export type Db = LibSQLDatabase<typeof schema>

let ready: Promise<Db> | undefined

/**
 * Base libSQL : fichier SQLite local (`file:…`, par défaut) ou Turso (`libsql://…` + jeton).
 * Les migrations ne sont appliquées au démarrage que sur un fichier local ; une base distante
 * est migrée à part avec `pnpm db:migrate` (lancé par le build Vercel), pas à chaque démarrage à froid.
 */
export function useDb(): Promise<Db> {
  ready ??= open().catch((err) => {
    ready = undefined
    throw err
  })
  return ready
}

async function open(): Promise<Db> {
  const { dbUrl, dbAuthToken, migrationsDir } = useRuntimeConfig()
  const local = dbUrl.startsWith('file:')
  if (local) mkdirSync(dirname(fileURLToPath(new URL(dbUrl, `file://${process.cwd()}/`))), { recursive: true })

  const client = createClient({ url: dbUrl, authToken: dbAuthToken || undefined })
  const db = drizzle(client, { schema })
  if (local) {
    await client.execute('PRAGMA journal_mode = WAL')
    await client.execute('PRAGMA foreign_keys = ON')
    await migrate(db, { migrationsFolder: resolve(migrationsDir) })
  }
  return db
}

export { schema }
