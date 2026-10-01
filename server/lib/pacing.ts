import type { Platform } from './types'

/**
 * Mise en retrait d'une plateforme après un captcha : on n'y retourne pas avant `until`,
 * et chaque blocage consécutif double l'attente. Insister pendant un blocage ne fait que prolonger le marquage de l'IP.
 * L'état est stocké en base (voir utils/products.ts) pour être partagé entre instances.
 */
export interface BackoffState {
  strikes: number
  until: number
}

export interface BackoffRule {
  baseMs: number
  maxMs: number
}

/** Au moins un passage planifié (toutes les 6 h) sauté dès le premier blocage, puis 16 h, 32 h, 48 h max. */
export const DEFAULT_BACKOFF: BackoffRule = { baseMs: 8 * 60 * 60 * 1000, maxMs: 48 * 60 * 60 * 1000 }

/** État après un nouveau blocage : chaque blocage consécutif double l'attente, plafonnée. */
export function nextBackoff(previous: BackoffState | null, rule: BackoffRule = DEFAULT_BACKOFF, now = Date.now()): BackoffState {
  const strikes = (previous?.strikes ?? 0) + 1
  return { strikes, until: now + Math.min(rule.maxMs, rule.baseMs * 2 ** (strikes - 1)) }
}

/** A1 B1 A2 B2 A3… : garde l'ordre (plus ancien relevé d'abord) au sein de chaque plateforme. */
export function interleaveByPlatform<T extends { platform: Platform }>(items: T[]): T[] {
  const queues = new Map<Platform, T[]>()
  for (const item of items) {
    const queue = queues.get(item.platform)
    if (queue) queue.push(item)
    else queues.set(item.platform, [item])
  }
  const out: T[] = []
  for (let i = 0; out.length < items.length; i++) {
    for (const queue of queues.values()) if (i < queue.length) out.push(queue[i]!)
  }
  return out
}
