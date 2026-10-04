import { DEFAULT_LOCALE, intlLocale, translator, type Locale } from './i18n'

export const DROP_MIN_RATIO = 0.05
export const DROP_MIN_CENTS = 50

export type AlertReason = 'target' | 'lowest' | 'drop'

export interface AlertInput {
  previousCents: number | null
  currentCents: number | null
  lowestBeforeCents: number | null
  targetPriceCents: number | null
  lastNotifiedCents: number | null
}

export function alertReason(i: AlertInput): AlertReason | null {
  const cur = i.currentCents
  if (cur == null) return null
  if (i.lastNotifiedCents != null && cur >= i.lastNotifiedCents) return null

  if (i.previousCents == null || cur >= i.previousCents) return null

  if (i.targetPriceCents != null && cur <= i.targetPriceCents) return 'target'
  if (i.lowestBeforeCents != null && cur < i.lowestBeforeCents) return 'lowest'
  const drop = i.previousCents - cur
  if (drop >= DROP_MIN_CENTS || drop / i.previousCents >= DROP_MIN_RATIO) return 'drop'
  return null
}

export function shouldResetNotified(lastNotifiedCents: number | null, currentCents: number | null): boolean {
  if (lastNotifiedCents == null || currentCents == null) return false
  const rise = currentCents - lastNotifiedCents
  return rise >= DROP_MIN_CENTS || rise / lastNotifiedCents >= DROP_MIN_RATIO
}

export interface AlertMessage {
  title: string
  body: string
}

export function formatAlert(
  reason: AlertReason,
  p: { title: string, currency: string },
  previousCents: number | null,
  currentCents: number,
  targetPriceCents: number | null,
  locale: Locale = DEFAULT_LOCALE,
): AlertMessage {
  const t = translator(locale)
  const money = (c: number) => new Intl.NumberFormat(intlLocale(locale), { style: 'currency', currency: p.currency }).format(c / 100)
  const percent = (ratio: number) => new Intl.NumberFormat(intlLocale(locale), { style: 'percent', maximumFractionDigits: 0 }).format(ratio)
  const name = p.title.length > 60 ? `${p.title.slice(0, 60).replace(/[\s,;:-]+\S*$/, '')}…` : p.title

  const parts: string[] = []
  if (previousCents != null && previousCents > currentCents) {
    parts.push(`${money(previousCents)} → ${money(currentCents)} (${percent(-(previousCents - currentCents) / previousCents)})`)
  }
  else {
    parts.push(money(currentCents))
  }
  if (reason === 'lowest') parts.push(t('alerts.lowest'))
  if (reason === 'target' && targetPriceCents != null) parts.push(t('alerts.belowTarget', { target: money(targetPriceCents) }))

  return { title: `↓ ${name}`, body: `${parts.join(' · ')} ${t('alerts.shippingIncluded')}` }
}
