import { createHmac, timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

const COOKIE = 'prixly_access'
const MAX_AGE = 60 * 60 * 24 * 365

/**
 * Code d'accès commun (NUXT_ACCESS_CODE) : sans lui, l'appli est ouverte à tous.
 * Le cookie contient une empreinte du code, pas le code : changer le code déconnecte tout le monde.
 */
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

/** Vérifie le code saisi et pose le cookie d'accès. */
export function grantAccess(event: H3Event, given: string): boolean {
  const code = accessCode()
  // Comparaison des empreintes : longueur fixe, pas de fuite de la longueur du code
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
