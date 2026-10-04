import type { Platform } from './types'

export interface BackoffState {
  strikes: number
  until: number
}

export interface BackoffRule {
  baseMs: number
  maxMs: number
}

export const DEFAULT_BACKOFF: BackoffRule = { baseMs: 8 * 60 * 60 * 1000, maxMs: 48 * 60 * 60 * 1000 }

export function nextBackoff(previous: BackoffState | null, rule: BackoffRule = DEFAULT_BACKOFF, now = Date.now()): BackoffState {
  const strikes = (previous?.strikes ?? 0) + 1
  return { strikes, until: now + Math.min(rule.maxMs, rule.baseMs * 2 ** (strikes - 1)) }
}

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
