import type { H3Event } from 'h3'
import { hit, type RateLimitRule } from '../lib/rate-limit'

/**
 * Règles par action. Les plus strictes protègent les requêtes qui déclenchent un scraping :
 * c'est l'IP du serveur qui se fait bannir par Amazon / AliExpress, pas celle de l'utilisateur.
 */
export const RATE_LIMITS = {
  lookup: [{ limit: 10, windowSec: 60 }, { limit: 100, windowSec: 86_400 }],
  refresh: [{ limit: 5, windowSec: 60 }, { limit: 50, windowSec: 86_400 }],
  watch: [{ limit: 30, windowSec: 60 }],
  pushSubscribe: [{ limit: 10, windowSec: 3600 }],
  pushTest: [{ limit: 3, windowSec: 60 }],
  // 5 pages Amazon par comparaison
  compare: [{ limit: 3, windowSec: 60 }, { limit: 20, windowSec: 86_400 }],
  // Recherche eBay : API officielle, mais quota de 5 000 appels / jour pour toute l'appli
  search: [{ limit: 20, windowSec: 60 }, { limit: 300, windowSec: 86_400 }],
  // Code d'accès : freine les essais au hasard
  login: [{ limit: 5, windowSec: 60 }, { limit: 30, windowSec: 86_400 }],
} satisfies Record<string, RateLimitRule[]>

/** Nombre maximum de produits suivis par appareil : chaque suivi coûte un scraping toutes les 6 h. */
export const MAX_WATCHES_PER_SUBSCRIBER = 50

/**
 * Refuse la requête (429) si l'IP a dépassé l'une des règles de l'action.
 * Compteurs en base (table kv) : partagés par toutes les instances serverless.
 */
export async function enforceRateLimit(event: H3Event, action: keyof typeof RATE_LIMITS) {
  const ip = clientIp(event)
  for (const rule of RATE_LIMITS[action]) {
    const result = await hit(kvCounterStorage, `ratelimit:${action}:${rule.windowSec}:${ip}`, rule)
    if (!result.allowed) {
      setResponseHeader(event, 'Retry-After', result.retryAfterSec)
      throw createError({
        statusCode: 429,
        message: rule.windowSec >= 86_400
          ? 'Limite quotidienne atteinte pour cette action. Réessaie demain.'
          : `Trop de requêtes. Réessaie dans ${formatDelay(result.retryAfterSec)}.`,
        data: { code: 'rate_limited', retryAfterSec: result.retryAfterSec },
      })
    }
  }
}

/**
 * IP du client. X-Forwarded-For n'est lu que derrière un proxy qui le réécrit (Vercel, ingress) :
 * sinon n'importe qui pourrait s'inventer une IP par requête et contourner la limite.
 */
function clientIp(event: H3Event): string {
  const trustProxy = useRuntimeConfig().trustProxy || Boolean(process.env.VERCEL)
  return getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'unknown'
}

function formatDelay(sec: number): string {
  if (sec < 60) return `${sec} s`
  const min = Math.ceil(sec / 60)
  return min < 60 ? `${min} min` : `${Math.ceil(min / 60)} h`
}
