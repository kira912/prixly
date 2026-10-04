import type { RefreshReport } from './products'

export function logRefreshReport(report: RefreshReport) {
  if (report.busy) {
    console.info('[prices:refresh] a refresh is already running, skipping')
    return
  }
  const summary = `${report.checked} checked, ${report.changed.length} changed, ${report.notified} alert(s), ${report.failed.length} failed, ${report.pending} postponed for lack of time`
  console.info(`[prices:refresh] ${summary}`)
  for (const c of report.changed) console.info(`[prices:refresh] #${c.id} ${c.fromCents ?? '—'} → ${c.toCents ?? '—'} ${c.title}`)
  for (const f of report.failed) console.warn(`[prices:refresh] #${f.id} failed: ${f.error}`)
  if (report.skippedPlatforms.length) console.warn(`[prices:refresh] postponed (captcha or platform backing off): ${report.skippedPlatforms.join(', ')}`)
}
