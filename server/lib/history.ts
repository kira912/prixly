export interface Snapshot {
  priceCents: number | null
  shippingCents: number | null
  capturedAt: Date
  /** Dernier relevé confirmant ce prix ; absent = capturedAt */
  lastSeenAt?: Date | null
}

export interface PricePoint {
  /** Début du palier : premier relevé à ce prix */
  at: Date
  /** Dernier relevé confirmant ce prix */
  until: Date
  priceCents: number | null
  shippingCents: number | null
  totalCents: number | null
}

export function snapshotTotal(s: { priceCents: number | null, shippingCents: number | null }): number | null {
  return s.priceCents == null ? null : s.priceCents + (s.shippingCents ?? 0)
}

/** Deux relevés identiques : le second ne crée pas de nouveau palier en base, il prolonge le précédent. */
export function samePrice(a: { priceCents: number | null, shippingCents: number | null }, b: { priceCents: number | null, shippingCents: number | null }): boolean {
  return a.priceCents === b.priceCents && a.shippingCents === b.shippingCents
}

/**
 * Regroupe les lignes d'historique successives au même total en paliers pour le graphique.
 * (En base, deux lignes consécutives peuvent avoir le même total avec une répartition prix / port différente.)
 * Les relevés sans prix (produit indisponible) forment leur propre palier.
 */
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
  /** Total du palier précédent (dernier total différent de l'actuel, hors indisponibilité) */
  previousCents: number | null
  currentCents: number | null
}

type StoredStats = Pick<PriceStats, 'lowestCents' | 'highestCents' | 'previousCents'>

/**
 * Met à jour les statistiques stockées sur le produit après un relevé,
 * sans relire l'historique : c'est ce qui garde la liste des produits à une ligne lue par produit.
 */
export function nextStats(before: StoredStats & { currentCents: number | null } | null, currentCents: number | null): StoredStats {
  if (!before) {
    return { lowestCents: currentCents, highestCents: currentCents, previousCents: null }
  }
  const changed = currentCents !== before.currentCents
  return {
    lowestCents: currentCents == null ? before.lowestCents : Math.min(before.lowestCents ?? currentCents, currentCents),
    highestCents: currentCents == null ? before.highestCents : Math.max(before.highestCents ?? currentCents, currentCents),
    // Après une indisponibilité, le prix précédent reste le dernier prix connu
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
  /** Moyenne du total pondérée par la durée de chaque palier, sur la fenêtre observée */
  averageCents: number
  /** Écart du total actuel à la moyenne, en % arrondi (négatif = moins cher que d'habitude) */
  diffPct: number
  /** Durée d'historique prise en compte, en jours */
  spanDays: number
}

/** En dessous, l'historique est trop court pour dire si un prix est bon */
export const INSIGHT_MIN_DAYS = 7
const INSIGHT_WINDOW_DAYS = 90

/**
 * « Bon moment pour acheter ? » : compare le total actuel à la moyenne des 90 derniers jours,
 * chaque palier pesant selon sa durée (un prix resté 2 mois compte plus qu'un prix resté 6 h).
 * Null si moins de INSIGHT_MIN_DAYS jours d'historique ou si le produit est indisponible.
 */
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
  /** Remise annoncée par rapport au prix barré, en % arrondi */
  discountPct: number
  /**
   * observed : le prix barré a déjà été pratiqué (promo crédible)
   * never_seen : jamais vu à ce prix sur toute la période suivie, assez longue pour que ce soit parlant
   * too_early : historique trop court pour trancher
   */
  status: 'observed' | 'never_seen' | 'too_early'
  /** Plus haut prix de l'article (hors port) relevé, pour comparaison */
  highestSeenCents: number | null
  spanDays: number
}

/** Durée de suivi à partir de laquelle un prix barré jamais pratiqué est jugé douteux */
export const LIST_PRICE_MIN_DAYS = 30

/**
 * Le prix barré affiché a-t-il déjà été pratiqué ? Compare au prix de l'article seul (comme le prix barré),
 * pas au total avec le port. Un prix barré jamais observé en 30 jours ou plus signale une remise gonflée.
 */
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
