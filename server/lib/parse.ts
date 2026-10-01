const CURRENCY_SYMBOLS: Record<string, string> = {
  '€': 'EUR',
  '$': 'USD',
  '£': 'GBP',
  'CHF': 'CHF',
}

export function currencyFromSymbol(symbol: string | undefined, fallback = 'EUR'): string {
  if (!symbol) return fallback
  return CURRENCY_SYMBOLS[symbol.trim()] ?? (/^[A-Z]{3}$/.test(symbol.trim()) ? symbol.trim() : fallback)
}

/**
 * Parse un prix affiché : « 11,99 € », « €1,234.56 », « 1 234,56€ », « 2,47€ ».
 * Renvoie un montant en centimes.
 */
export function parsePrice(text: string | null | undefined): { cents: number, currency: string } | null {
  if (!text) return null
  const clean = text.replace(/[  ]/g, ' ').trim()
  const num = clean.match(/\d[\d .,']*/)
  if (!num) return null

  let digits = num[0].replace(/[ ']/g, '').replace(/[.,]$/, '')
  const lastSep = Math.max(digits.lastIndexOf(','), digits.lastIndexOf('.'))
  // Un séparateur suivi d'exactement 1 ou 2 chiffres est décimal ; sinon c'est un séparateur de milliers
  if (lastSep !== -1 && digits.length - lastSep - 1 <= 2) {
    const int = digits.slice(0, lastSep).replace(/[.,]/g, '')
    const dec = digits.slice(lastSep + 1).padEnd(2, '0')
    digits = `${int}.${dec}`
  }
  else {
    digits = digits.replace(/[.,]/g, '')
  }

  const value = Number.parseFloat(digits)
  if (!Number.isFinite(value)) return null

  const symbol = clean.match(/[€$£]|\b[A-Z]{3}\b/)?.[0]
  return { cents: Math.round(value * 100), currency: currencyFromSymbol(symbol) }
}

/** « 141 570 », « (7 624) », « 1.234 » → 141570 */
export function parseCount(text: string | null | undefined): number | null {
  if (!text) return null
  const m = text.replace(/[   ]/g, '').match(/\d[\d.,]*/)
  if (!m) return null
  const n = Number.parseInt(m[0].replace(/[.,]/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/** « 4,7 sur 5 étoiles » → 4.7 */
export function parseRating(text: string | null | undefined): number | null {
  if (!text) return null
  const m = text.match(/\d+(?:[.,]\d+)?/)
  if (!m) return null
  const n = Number.parseFloat(m[0].replace(',', '.'))
  return Number.isFinite(n) && n >= 0 && n <= 5 ? n : null
}

const FR_MONTHS = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc']

function monthIndex(token: string): number {
  const t = token.toLowerCase().replace('fevr', 'févr').replace('aout', 'août').replace('dec', 'déc')
  return FR_MONTHS.findIndex(m => t.startsWith(m))
}

function daysUntil(day: number, month: number, now: Date): number {
  const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  let target = Date.UTC(now.getFullYear(), month, day)
  // Une date « passée » de plus d'un mois désigne l'année suivante (ex. livraison en janvier vue en décembre)
  if (target < today - 31 * 86_400_000) target = Date.UTC(now.getFullYear() + 1, month, day)
  return Math.max(0, Math.round((target - today) / 86_400_000))
}

/**
 * Convertit un texte de livraison français en nombre de jours.
 * Gère « demain », « vendredi 2 octobre », « 2 - 5 octobre », « 30 sept. - 3 oct. ».
 */
export function parseFrenchDeliveryDays(text: string | null | undefined, now = new Date()): { min: number, max: number } | null {
  if (!text) return null
  const t = text.toLowerCase()
  if (/aujourd'hui|aujourd’hui/.test(t)) return { min: 0, max: 0 }
  if (/après-demain/.test(t)) return { min: 2, max: 2 }
  if (/demain/.test(t)) return { min: 1, max: 1 }

  const re = /(\d{1,2})(?:er)?\s*([a-zéû]{3,}\.?)?/g
  const dates: Array<{ day: number, month: number | null }> = []
  for (const m of t.matchAll(re)) {
    const month = m[2] ? monthIndex(m[2]) : -1
    dates.push({ day: Number(m[1]), month: month === -1 ? null : month })
  }
  if (!dates.length) return null

  // Dans « 2 - 5 octobre », le premier jour hérite du mois du second
  const lastMonth = [...dates].reverse().find(d => d.month !== null)?.month
  if (lastMonth == null) return null
  const days = dates
    .slice(0, 2)
    .map(d => daysUntil(d.day, d.month ?? lastMonth, now))
  return { min: Math.min(...days), max: Math.max(...days) }
}
