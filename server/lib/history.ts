export interface Snapshot {
  priceCents: number | null
  shippingCents: number | null
  capturedAt: Date
  lastSeenAt?: Date | null
}

export interface PricePoint {
  at: Date
  until: Date
  priceCents: number | null
  shippingCents: number | null
  totalCents: number | null
}

export function snapshotTotal(s: { priceCents: number | null, shippingCents: number | null }): number | null {
  return s.priceCents == null ? null : s.priceCents + (s.shippingCents ?? 0)
}

export function samePrice(a: { priceCents: number | null, shippingCents: number | null }, b: { priceCents: number | null, shippingCents: number | null }): boolean {
  return a.priceCents === b.priceCents && a.shippingCents === b.shippingCents
}

export function toPricePoints(snapshots: Snapshot[]): PricePoint[] {
  const sorted = [...snapshots].sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime())
  const points: PricePoint[] = []
  for (const s of sorted) {
    const total = snapshotTotal(s)
    const until = s.lastSeenAt ?? s.capturedAt
    const last = points.at(-1)
    if (last && last.totalCents === total) {
      if (until > last.until) last.until = until
      continue
    }
    points.push({ at: s.capturedAt, until, priceCents: s.priceCents, shippingCents: s.shippingCents, totalCents: total })
  }
  return points
}

export interface PriceStats {
  lowestCents: number | null
  highestCents: number | null
  previousCents: number | null
  currentCents: number | null
}

type StoredStats = Pick<PriceStats, 'lowestCents' | 'highestCents' | 'previousCents'>

export function nextStats(before: StoredStats & { currentCents: number | null } | null, currentCents: number | null): StoredStats {
  if (!before) {
    return { lowestCents: currentCents, highestCents: currentCents, previousCents: null }
  }
  const changed = currentCents !== before.currentCents
  return {
    lowestCents: currentCents == null ? before.lowestCents : Math.min(before.lowestCents ?? currentCents, currentCents),
    highestCents: currentCents == null ? before.highestCents : Math.max(before.highestCents ?? currentCents, currentCents),
    previousCents: changed ? (before.currentCents ?? before.previousCents) : before.previousCents,
  }
}

export function statsOf(p: StoredStats & { priceCents: number | null, shippingCents: number | null }): PriceStats {
  return { lowestCents: p.lowestCents, highestCents: p.highestCents, previousCents: p.previousCents, currentCents: snapshotTotal(p) }
}

const DAY_MS = 86_400_000

export type PriceVerdict = 'lowest' | 'good' | 'normal' | 'high'

export interface PriceInsight {
  verdict: PriceVerdict
  averageCents: number
  diffPct: number
  spanDays: number
}

export const INSIGHT_MIN_DAYS = 7
const INSIGHT_WINDOW_DAYS = 90

export function priceInsight(points: PricePoint[], now = new Date()): PriceInsight | null {
  const current = points.at(-1)?.totalCents
  if (current == null) return null
  const end = Math.max(now.getTime(), points.at(-1)!.until.getTime())
  const windowStart = end - INSIGHT_WINDOW_DAYS * DAY_MS

  let weighted = 0
  let duration = 0
  let lowest = Infinity
  let highest = -Infinity
  let firstAt: number | null = null
  points.forEach((p, i) => {
    if (p.totalCents == null) return
    const from = Math.max(p.at.getTime(), windowStart)
    const to = i + 1 < points.length ? points[i + 1]!.at.getTime() : end
    if (to <= from) return
    firstAt ??= from
    weighted += p.totalCents * (to - from)
    duration += to - from
    lowest = Math.min(lowest, p.totalCents)
    highest = Math.max(highest, p.totalCents)
  })
  if (firstAt == null || end - firstAt < INSIGHT_MIN_DAYS * DAY_MS || duration === 0) return null

  const averageCents = Math.round(weighted / duration)
  const diff = (current - averageCents) / averageCents
  let verdict: PriceVerdict = 'normal'
  if (current <= lowest && lowest < highest) verdict = 'lowest'
  else if (diff <= -0.05) verdict = 'good'
  else if (diff >= 0.1) verdict = 'high'
  return { verdict, averageCents, diffPct: Math.round(diff * 100), spanDays: Math.floor((end - firstAt) / DAY_MS) }
}

export interface ListPriceCheck {
  listPriceCents: number
  discountPct: number
  status: 'observed' | 'never_seen' | 'too_early'
  highestSeenCents: number | null
  spanDays: number
}

export const LIST_PRICE_MIN_DAYS = 30

export function checkListPrice(listPriceCents: number | null, priceCents: number | null, snapshots: Snapshot[], now = new Date()): ListPriceCheck | null {
  if (listPriceCents == null || priceCents == null || listPriceCents <= priceCents) return null
  const prices = snapshots.filter(s => s.priceCents != null)
  const highestSeenCents = prices.length ? Math.max(...prices.map(s => s.priceCents!)) : null
  const firstAt = Math.min(...snapshots.map(s => s.capturedAt.getTime()), now.getTime())
  const spanDays = Math.floor((now.getTime() - firstAt) / DAY_MS)

  let status: ListPriceCheck['status'] = 'too_early'
  if (highestSeenCents != null && highestSeenCents >= listPriceCents) status = 'observed'
  else if (spanDays >= LIST_PRICE_MIN_DAYS) status = 'never_seen'
  return {
    listPriceCents,
    discountPct: Math.round((1 - priceCents / listPriceCents) * 100),
    status,
    highestSeenCents,
    spanDays,
  }
}
