import { timingSafeEqual } from 'node:crypto'

/**
 * Relevé planifié en serverless (Vercel) : appelé toutes les ~15 min par un cron externe
 * (.github/workflows/refresh-prices.yml) avec `Authorization: Bearer $CRON_SECRET`, même en-tête que Vercel Cron.
 * Chaque appel relève les produits dont le dernier relevé a plus de PRIXLY_REFRESH_INTERVAL_H heures (6 par défaut),
 * les plus anciens d'abord, dans la limite de PRIXLY_REFRESH_BUDGET_SEC secondes (50 par défaut) ; le reste attend l'appel suivant.
 * Hors Vercel, la tâche Nitro prices:refresh fait le même travail en un seul passage.
 */
export default defineEventHandler(async (event) => {
  const secret = process.env.CRON_SECRET
  if (!secret) throw createError({ statusCode: 503, message: 'CRON_SECRET non configuré.' })
  const given = Buffer.from(getHeader(event, 'authorization') ?? '')
  const expected = Buffer.from(`Bearer ${secret}`)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw createError({ statusCode: 401, message: 'Non autorisé.' })
  }

  const report = await refreshWatchedProducts({
    minAgeMs: Number(process.env.PRIXLY_REFRESH_INTERVAL_H ?? 6) * 60 * 60 * 1000,
    budgetMs: Number(process.env.PRIXLY_REFRESH_BUDGET_SEC ?? 50) * 1000,
  })
  logRefreshReport(report)
  return report
})
