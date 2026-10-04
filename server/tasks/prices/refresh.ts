const JITTER_MS = Number(process.env.PRIXLY_REFRESH_JITTER_MIN ?? 20) * 60 * 1000

export default defineTask({
  meta: {
    name: 'prices:refresh',
    description: 'Checks the price of watched products',
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
