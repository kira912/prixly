import { timingSafeEqual } from 'node:crypto'

export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (!secret) throw createError({ statusCode: 503, message: 'CRON_SECRET is not configured.' })
  const given = Buffer.from(getHeader(event, 'authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw createError({ statusCode: 401, message: 'Unauthorized.' })
  }

  const report = await refreshWatchedProducts({
    minAgeMs: Number(process.env.PRIXLY_REFRESH_INTERVAL_H ?? 6) * 60 * 60 * 1000,
    budgetMs: Number(process.env.PRIXLY_REFRESH_BUDGET_SEC ?? 50) * 1000,
  })
  logRefreshReport(report)
  return report
})
