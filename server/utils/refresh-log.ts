import type { RefreshReport } from './products'

export function logRefreshReport(report: RefreshReport) {
  if (report.busy) {
    console.info('[prices:refresh] un relevé est déjà en cours, passage ignoré')
    return
  }
  const summary = `${report.checked} relevé(s), ${report.changed.length} changement(s), ${report.notified} alerte(s), ${report.failed.length} échec(s), ${report.pending} reporté(s) faute de temps`
  console.info(`[prices:refresh] ${summary}`)
  for (const c of report.changed) console.info(`[prices:refresh] #${c.id} ${c.fromCents ?? '—'} → ${c.toCents ?? '—'} ${c.title}`)
  for (const f of report.failed) console.warn(`[prices:refresh] #${f.id} échec : ${f.error}`)
  if (report.skippedPlatforms.length) console.warn(`[prices:refresh] reporté (captcha ou plateforme en retrait) : ${report.skippedPlatforms.join(', ')}`)
}
