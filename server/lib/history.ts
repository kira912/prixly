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
