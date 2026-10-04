import { and, eq, isNotNull, lt, or, isNull, gt } from 'drizzle-orm'
import { kv } from '../database/schema'
import type { CounterStorage } from '../lib/rate-limit'

export async function kvGet<T>(key: string): Promise<T | null> {
  const db = await useDb()
  const row = await db.select({ value: kv.value }).from(kv)
    .where(and(eq(kv.key, key), or(isNull(kv.expiresAt), gt(kv.expiresAt, new Date()))))
    .get()
  return row ? JSON.parse(row.value) as T : null
}

export async function kvSet(key: string, value: unknown, { ttlSec }: { ttlSec?: number } = {}) {
  const db = await useDb()
  const values = { key, value: JSON.stringify(value), expiresAt: ttlSec ? new Date(Date.now() + ttlSec * 1000) : null }
  await db.insert(kv).values(values).onConflictDoUpdate({ target: kv.key, set: values }).run()
}

export async function kvDelete(key: string) {
  const db = await useDb()
  await db.delete(kv).where(eq(kv.key, key)).run()
}

export async function kvAcquire(key: string, ttlSec: number): Promise<boolean> {
  const db = await useDb()
  const now = new Date()
  const values = { key, value: 'true', expiresAt: new Date(now.getTime() + ttlSec * 1000) }
  const rows = await db.insert(kv).values(values)
    .onConflictDoUpdate({ target: kv.key, set: values, setWhere: and(isNotNull(kv.expiresAt), lt(kv.expiresAt, now)) })
    .returning({ key: kv.key })
    .all()
  return rows.length > 0
}

export async function kvPurgeExpired() {
  const db = await useDb()
  await db.delete(kv).where(and(isNotNull(kv.expiresAt), lt(kv.expiresAt, new Date()))).run()
}

export const kvCounterStorage: CounterStorage = {
  getItem: key => kvGet(key),
  setItem: (key, value, opts) => kvSet(key, value, { ttlSec: opts?.ttl }),
}
