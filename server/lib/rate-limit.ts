/** Sous-ensemble de l'API unstorage utilisé : permet de brancher mémoire, Redis, Upstash… */
export interface CounterStorage {
  getItem: (key: string) => Promise<unknown>
  setItem: (key: string, value: unknown, opts?: { ttl?: number }) => Promise<void>
}

export interface RateLimitRule {
  /** Requêtes autorisées par fenêtre */
  limit: number
  /** Durée de la fenêtre, en secondes */
  windowSec: number
}

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** Secondes avant la réinitialisation de la fenêtre */
  retryAfterSec: number
}

interface Counter {
  count: number
  resetAt: number
}

/**
 * Fenêtre fixe : compte les requêtes d'une clé jusqu'à resetAt, puis repart de zéro.
 * Lecture puis écriture non atomiques : sous forte concurrence, quelques requêtes en trop peuvent passer,
 * ce qui est acceptable pour protéger les plateformes scrapées, pas pour de la facturation.
 */
export async function hit(storage: CounterStorage, key: string, rule: RateLimitRule, now = Date.now()): Promise<RateLimitResult> {
  const stored = await storage.getItem(key) as Counter | null
  const counter: Counter = stored && stored.resetAt > now
    ? { count: stored.count + 1, resetAt: stored.resetAt }
    : { count: 1, resetAt: now + rule.windowSec * 1000 }

  const retryAfterSec = Math.max(1, Math.ceil((counter.resetAt - now) / 1000))
  // Le TTL laisse les drivers qui le gèrent (Redis, Upstash) purger les compteurs expirés
  await storage.setItem(key, counter, { ttl: retryAfterSec })

  return { allowed: counter.count <= rule.limit, remaining: Math.max(0, rule.limit - counter.count), retryAfterSec }
}
