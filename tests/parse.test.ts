import { describe, expect, it } from 'vitest'
import { parseCount, parseFrenchDeliveryDays, parsePrice, parseRating } from '../server/lib/parse'

describe('parsePrice', () => {
  it.each([
    ['11,99 €', 1199, 'EUR'],
    ['11,99€', 1199, 'EUR'],
    ['1 234,56 €', 123456, 'EUR'],
    ['€1,234.56', 123456, 'EUR'],
    ['$12.5', 1250, 'USD'],
    ['£3', 300, 'GBP'],
    ['2,47€|2|47', 247, 'EUR'],
    ['1.234 €', 123400, 'EUR'],
  ])('%s → %i %s', (input, cents, currency) => {
    expect(parsePrice(input)).toEqual({ cents, currency })
  })

  it('renvoie null sans nombre', () => {
    expect(parsePrice('GRATUITE')).toBeNull()
    expect(parsePrice('')).toBeNull()
  })
})

describe('parseCount / parseRating', () => {
  it('lit les nombres avec séparateurs', () => {
    expect(parseCount('(141 570)')).toBe(141570)
    expect(parseCount('141 570 évaluations')).toBe(141570)
  })
  it('lit une note sur 5', () => {
    expect(parseRating('4,7 sur 5 étoiles')).toBe(4.7)
    expect(parseRating('4.5')).toBe(4.5)
    expect(parseRating('12')).toBeNull()
  })
})

describe('parseFrenchDeliveryDays', () => {
  const now = new Date(2026, 8, 29) // mardi 29 septembre 2026

  it.each([
    ['vendredi 2 octobre', 3, 3],
    ['demain', 1, 1],
    ['2 - 5 octobre', 3, 6],
    ['30 sept. - 3 oct.', 1, 4],
    ['mercredi 30 septembre', 1, 1],
  ])('%s', (text, min, max) => {
    expect(parseFrenchDeliveryDays(text, now)).toEqual({ min, max })
  })

  it('passe à l’année suivante pour janvier vu depuis décembre', () => {
    expect(parseFrenchDeliveryDays('lundi 4 janvier', new Date(2026, 11, 30))).toEqual({ min: 5, max: 5 })
  })

  it('renvoie null si illisible', () => {
    expect(parseFrenchDeliveryDays('bientôt', now)).toBeNull()
  })
})
