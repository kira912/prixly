import { createHash, randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { subscribers } from '../database/schema'

const COOKIE = 'prixly_sid'
const MAX_AGE = 60 * 60 * 24 * 365 * 2

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/**
 * Identité anonyme : un jeton aléatoire en cookie httpOnly désigne un abonné.
 * Pas de compte : chaque navigateur / appli installée est un abonné distinct.
 */
export async function getSubscriberId(event: H3Event): Promise<number | null> {
  const token = getCookie(event, COOKIE)
  if (!token) return null
  const db = await useDb()
  const row = await db.select({ id: subscribers.id }).from(subscribers).where(eq(subscribers.tokenHash, hash(token))).get()
  return row?.id ?? null
}

export async function requireSubscriberId(event: H3Event): Promise<number> {
  const existing = await getSubscriberId(event)
  if (existing) return existing

  const token = randomBytes(32).toString('base64url')
  const db = await useDb()
  const row = await db.insert(subscribers).values({ tokenHash: hash(token), createdAt: new Date() }).returning({ id: subscribers.id }).get()
  setCookie(event, COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: MAX_AGE,
  })
  return row.id
}
