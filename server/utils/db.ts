import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@libsql/client'
import { drizzle, type LibSQLDatabase } from 'drizzle-orm/libsql'
import { migrate } from 'drizzle-orm/libsql/migrator'
import * as schema from '../database/schema'

export type Db = LibSQLDatabase<typeof schema>

let ready: Promise<Db> | undefined

export function useDb(): Promise<Db> {
  ready ??= open().catch((err) => {
    ready = undefined
    throw err
  })
  return ready
}

async function open(): Promise<Db> {
  const config = useRuntimeConfig()
  const dbUrl = config.dbUrl || process.env.TURSO_DATABASE_URL || 'file:./data/prixly.db'
  const dbAuthToken = config.dbAuthToken || process.env.TURSO_AUTH_TOKEN
  const { migrationsDir } = config
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
