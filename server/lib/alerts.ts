/** Baisse minimale pour alerter : l'un OU l'autre seuil suffit. */
export const DROP_MIN_RATIO = 0.05
export const DROP_MIN_CENTS = 50

export type AlertReason = 'target' | 'lowest' | 'drop'

export interface AlertInput {
  /** Total avant ce relevé */
  previousCents: number | null
  /** Total relevé à l'instant */
  currentCents: number | null
  /** Plus bas total relevé AVANT ce relevé */
  lowestBeforeCents: number | null
  /** Prix cible fixé par l'abonné */
  targetPriceCents: number | null
  /** Total de la dernière alerte envoyée à cet abonné pour ce produit */
  lastNotifiedCents: number | null
}

/**
 * Décide s'il faut prévenir un abonné après un relevé ; renvoie la raison la plus forte, ou null.
 * - jamais sur une hausse ou un produit indisponible ;
 * - jamais deux fois pour un même niveau de prix : il faut descendre sous la dernière alerte ;
 * - sur une baisse : prix cible atteint, nouveau plus bas historique, ou baisse ≥ 5 % / ≥ 0,50 €.
 */
export function alertReason(i: AlertInput): AlertReason | null {
  const cur = i.currentCents
  if (cur == null) return null
  if (i.lastNotifiedCents != null && cur >= i.lastNotifiedCents) return null

  // Seule une baisse déclenche une alerte : un prix déjà sous la cible quand on la fixe se voit à l'écran
  if (i.previousCents == null || cur >= i.previousCents) return null

  if (i.targetPriceCents != null && cur <= i.targetPriceCents) return 'target'
  if (i.lowestBeforeCents != null && cur < i.lowestBeforeCents) return 'lowest'
  const drop = i.previousCents - cur
  if (drop >= DROP_MIN_CENTS || drop / i.previousCents >= DROP_MIN_RATIO) return 'drop'
  return null
}

/**
 * Le prix est nettement remonté depuis la dernière alerte (mêmes seuils qu'une baisse) :
 * on oublie cette alerte pour pouvoir prévenir à la prochaine vraie baisse.
 */
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
): AlertMessage {
  const money = (c: number) => new Intl.NumberFormat('fr-FR', { style: 'currency', currency: p.currency }).format(c / 100)
  const name = p.title.length > 60 ? `${p.title.slice(0, 60).replace(/[\s,;:-]+\S*$/, '')}…` : p.title

  const parts: string[] = []
  if (previousCents != null && previousCents > currentCents) {
    const pct = Math.round(((previousCents - currentCents) / previousCents) * 100)
    parts.push(`${money(previousCents)} → ${money(currentCents)} (-${pct} %)`)
  }
  else {
    parts.push(money(currentCents))
  }
  if (reason === 'lowest') parts.push('plus bas relevé')
  if (reason === 'target' && targetPriceCents != null) parts.push(`sous ta cible de ${money(targetPriceCents)}`)

  return { title: `↓ ${name}`, body: `${parts.join(' · ')} (port compris)` }
}
