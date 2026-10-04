export interface CounterStorage {
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: unknown, opts?: { ttl?: number }) => Promise<void>
}

export interface RateLimitRule {
  limit: number
  windowSec: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  retryAfterSec: number
}

interface Counter {
  count: number
  resetAt: number
}

export async function hit(storage: CounterStorage, key: string, rule: RateLimitRule, now = Date.now()): Promise<RateLimitResult> {
  const stored = await storage.getItem(key) as Counter | null
  const counter: Counter = stored && stored.resetAt > now
    ? { count: stored.count + 1, resetAt: stored.resetAt }
    : { count: 1, resetAt: now + rule.windowSec * 1000 }

  const retryAfterSec = Math.max(1, Math.ceil((counter.resetAt - now) / 1000))
  await storage.setItem(key, counter, { ttl: retryAfterSec })

  return { allowed: counter.count <= rule.limit, remaining: Math.max(0, rule.limit - counter.count), retryAfterSec }
}
