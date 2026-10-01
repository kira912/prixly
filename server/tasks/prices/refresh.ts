/**
 * Délai aléatoire avant le relevé (PRIXLY_REFRESH_JITTER_MIN, 20 min par défaut) : sans lui,
 * les requêtes partent pile à 0 h, 6 h, 12 h… ce qui fait un motif facile à repérer.
 * Le payload { jitter: false } le désactive pour un lancement manuel.
 */
const JITTER_MS = Number(process.env.PRIXLY_REFRESH_JITTER_MIN ?? 20) * 60 * 1000

export default defineTask({
  meta: {
    name: 'prices:refresh',
    description: 'Relève le prix des produits suivis',
  },
  async run({ payload }) {
    if (payload?.jitter !== false && JITTER_MS > 0) {
      await new Promise(resolve => setTimeout(resolve, Math.random() * JITTER_MS))
    }
    const report = await refreshWatchedProducts()
    logRefreshReport(report)
    return { result: report }
  },
})
