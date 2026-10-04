function i18n() {
  return tryUseNuxtApp()?.$i18n
}

export function intlLocale(): string {
  return i18n()?.localeProperties.value.language ?? 'fr-FR'
}

function t(key: string, params?: Record<string, unknown> | number): string {
  const instance = i18n()
  if (!instance) return key
  return typeof params === 'number' ? instance.t(key, params) : instance.t(key, params ?? {})
}

export function formatMoney(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat(intlLocale(), { style: 'currency', currency }).format(cents / 100)
}

export function formatNumber(value: number): string {
  return value.toLocaleString(intlLocale())
}

export function formatDate(date: string | number | Date, options: Intl.DateTimeFormatOptions = {}): string {
  return new Date(date).toLocaleString(intlLocale(), options)
}

export function totalCents(p: { priceCents: number | null, shippingCents: number | null }): number | null {
  if (p.priceCents == null) return null
  return p.priceCents + (p.shippingCents ?? 0)
}

export function formatDays(n: number): string {
  return t('format.days', n)
}

export function formatDelivery(p: { deliveryMinDays: number | null, deliveryMaxDays: number | null, deliveryText: string | null }): string {
  const { deliveryMinDays: min, deliveryMaxDays: max } = p
  if (min == null && max == null) return p.deliveryText ?? t('format.unknownDelay')
  if (min === 0 && max === 0) return t('format.today')
  if (min === max || max == null) return formatDays(min!)
  if (min == null) return `≤ ${formatDays(max)}`
  return `${min}–${formatDays(max)}`
}

export function formatRelative(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const rtf = new Intl.RelativeTimeFormat(intlLocale(), { numeric: 'auto' })
  const minutes = Math.round(diff / 60_000)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 48) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.round(hours / 24), 'day')
}

export function countryName(code: string): string {
  if (!/^[A-Z]{2}$/.test(code)) return code
  try {
    return new Intl.DisplayNames([intlLocale()], { type: 'region' }).of(code) ?? code
  }
  catch {
    return code
  }
}

export const PLATFORM_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
}

export function errorMessage(err: unknown): string {
  const e = err as { data?: { message?: string, data?: { message?: string } }, message?: string }
  return e?.data?.data?.message ?? e?.data?.message ?? e?.message ?? t('common.unknownError')
}
