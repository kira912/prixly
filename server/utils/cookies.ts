import { cookieJar, type StoredCookie } from '../lib/http'

const KEY = 'http:cookies'

let restored: Promise<void> | null = null

/** Loads the scraping session saved by another instance (once per instance). */
export function restoreCookies(): Promise<void> {
  restored ??= kvGet<StoredCookie[]>(KEY)
    .then((cookies) => { if (cookies) cookieJar.load(cookies) })
    .catch((err) => {
      restored = null
      console.warn('[cookies] restore failed', err)
    })
  return restored
}

export async function persistCookies() {
  if (!cookieJar.changed) return
  cookieJar.changed = false
  await kvSet(KEY, cookieJar.toJSON(), { ttlSec: 30 * 24 * 3600 }).catch(err => console.warn('[cookies] save failed', err))
}
