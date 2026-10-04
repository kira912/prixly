import type { H3Event } from 'h3'
import type { Translate } from '../lib/i18n'
import { hit, type RateLimitRule } from '../lib/rate-limit'

export const RATE_LIMITS = {
  lookup: [{ limit: 10, windowSec: 60 }, { limit: 100, windowSec: 86_400 }],
  refresh: [{ limit: 5, windowSec: 60 }, { limit: 50, windowSec: 86_400 }],
  watch: [{ limit: 30, windowSec: 60 }],
  pushSubscribe: [{ limit: 10, windowSec: 3600 }],
  pushTest: [{ limit: 3, windowSec: 60 }],
  compare: [{ limit: 3, windowSec: 60 }, { limit: 20, windowSec: 86_400 }],
  search: [{ limit: 20, windowSec: 60 }, { limit: 300, windowSec: 86_400 }],
  curate: [{ limit: 5, windowSec: 60 }, { limit: 50, windowSec: 86_400 }],
  assist: [{ limit: 5, windowSec: 60 }, { limit: 50, windowSec: 86_400 }],
  assistResults: [{ limit: 3, windowSec: 60 }, { limit: 30, windowSec: 86_400 }],
  login: [{ limit: 5, windowSec: 60 }, { limit: 30, windowSec: 86_400 }],
} satisfies Record<string, RateLimitRule[]>

export const MAX_WATCHES_PER_SUBSCRIBER = 50

export async function enforceRateLimit(event: H3Event, action: keyof typeof RATE_LIMITS) {
  const ip = clientIp(event)
  for (const rule of RATE_LIMITS[action]) {
    const result = await hit(kvCounterStorage, `ratelimit:${action}:${rule.windowSec}:${ip}`, rule)
    if (!result.allowed) {
      setResponseHeader(event, 'Retry-After', result.retryAfterSec)
      const t = useServerT(event)
      throw createError({
        statusCode: 429,
        message: rule.windowSec >= 86_400
          ? t('errors.rateLimitDaily')
          : t('errors.rateLimit', { delay: formatDelay(t, result.retryAfterSec) }),
        data: { code: 'rate_limited', retryAfterSec: result.retryAfterSec },
      })
    }
  }
}

function clientIp(event: H3Event): string {
  const trustProxy = useRuntimeConfig().trustProxy || Boolean(process.env.VERCEL)
  return getRequestIP(event, { xForwardedFor: trustProxy }) ?? 'unknown'
}

function formatDelay(t: Translate, sec: number): string {
  if (sec < 60) return t('duration.seconds', { n: sec })
  const min = Math.ceil(sec / 60)
  return min < 60 ? t('duration.minutes', { n: min }) : t('duration.hours', { n: Math.ceil(min / 60) })
}
