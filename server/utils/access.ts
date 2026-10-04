import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const COOKIE = 'prixly_access'
const MAX_AGE = 60 * 60 * 24 * 365

export function accessCode(): string {
  return useRuntimeConfig().accessCode
}

const fingerprint = (code: string) => createHmac('sha256', code).update('prixly-access').digest('base64url')

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a)
  const bb = Buffer.from(b)
  return ba.length === bb.length && timingSafeEqual(ba, bb)
}

export function hasAccess(event: H3Event): boolean {
  const code = accessCode()
  if (!code) return true
  const cookie = getCookie(event, COOKIE)
  return !!cookie && safeEqual(cookie, fingerprint(code))
}

export function grantAccess(event: H3Event, given: string): boolean {
  const code = accessCode()
  if (!code || !safeEqual(fingerprint(given), fingerprint(code))) return false
  setCookie(event, COOKIE, fingerprint(code), {
    httpOnly: true,
    sameSite: 'lax',
    secure: !import.meta.dev,
    path: '/',
    maxAge: MAX_AGE,
  })
  return true
}
