export function formatMoney(cents: number | null | undefined, currency = 'EUR'): string {
  if (cents == null) return '—'
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(cents / 100)
}

export function totalCents(p: { priceCents: number | null, shippingCents: number | null }): number | null {
  if (p.priceCents == null) return null
  return p.priceCents + (p.shippingCents ?? 0)
}

export function formatDelivery(p: { deliveryMinDays: number | null, deliveryMaxDays: number | null, deliveryText: string | null }): string {
  const { deliveryMinDays: min, deliveryMaxDays: max } = p
  if (min == null && max == null) return p.deliveryText ?? 'Délai inconnu'
  const days = (n: number) => (n <= 1 ? `${n} jour` : `${n} jours`)
  if (min === 0 && max === 0) return 'Aujourd’hui'
  if (min === max || max == null) return days(min!)
  if (min == null) return `≤ ${days(max)}`
  return `${min}–${days(max)}`
}

export function formatRelative(date: string | Date): string {
  const diff = Date.now() - new Date(date).getTime()
  const rtf = new Intl.RelativeTimeFormat('fr', { numeric: 'auto' })
  const minutes = Math.round(diff / 60_000)
  if (minutes < 60) return rtf.format(-minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours < 48) return rtf.format(-hours, 'hour')
  return rtf.format(-Math.round(hours / 24), 'day')
}

export const PLATFORM_LABELS: Record<string, string> = {
  amazon: 'Amazon',
  aliexpress: 'AliExpress',
}

/** Message d'erreur lisible depuis une erreur $fetch */
export function errorMessage(err: unknown): string {
  const e = err as { data?: { message?: string, data?: { message?: string } }, message?: string }
  return e?.data?.data?.message ?? e?.data?.message ?? e?.message ?? 'Erreur inconnue'
}
