import { describe, expect, it } from 'vitest'
import { alertReason, formatAlert, shouldResetNotified, type AlertInput } from '../server/lib/alerts'

const base: AlertInput = { previousCents: 1000, currentCents: 1000, lowestBeforeCents: 800, targetPriceCents: null, lastNotifiedCents: null }
const reason = (o: Partial<AlertInput>) => alertReason({ ...base, ...o })

describe('alertReason', () => {
  it('ignore les hausses, prix stables et produits indisponibles', () => {
    expect(reason({ currentCents: 1100 })).toBeNull()
    expect(reason({ currentCents: 1000 })).toBeNull()
    expect(reason({ currentCents: null })).toBeNull()
    expect(reason({ previousCents: null, currentCents: 500 })).toBeNull()
  })

  it('alerte sur une baisse ≥ 5 % ou ≥ 0,50 €', () => {
    expect(reason({ currentCents: 950 })).toBe('drop') // -5 %
    expect(reason({ currentCents: 960 })).toBeNull() // -4 %, -0,40 €
    expect(reason({ previousCents: 20000, currentCents: 19950 })).toBe('drop') // -0,25 % mais -0,50 €
    expect(reason({ previousCents: 20000, currentCents: 19960, lowestBeforeCents: 15000 })).toBeNull()
  })

  it('alerte sur un nouveau plus bas, même petit', () => {
    expect(reason({ previousCents: 810, currentCents: 799, lowestBeforeCents: 800 })).toBe('lowest')
    expect(reason({ previousCents: 810, currentCents: 800, lowestBeforeCents: 800 })).toBeNull()
  })

  it('donne la priorité au prix cible', () => {
    expect(reason({ currentCents: 700, targetPriceCents: 750 })).toBe('target')
    expect(reason({ currentCents: 990, targetPriceCents: 995 })).toBe('target')
  })

  it('n’alerte pas si la cible était déjà atteinte sans baisse', () => {
    expect(reason({ previousCents: 700, currentCents: 700, targetPriceCents: 750 })).toBeNull()
  })

  it('n’alerte pas deux fois pour le même niveau', () => {
    expect(reason({ currentCents: 900, lastNotifiedCents: 900 })).toBeNull()
    expect(reason({ currentCents: 900, lastNotifiedCents: 850 })).toBeNull()
    expect(reason({ previousCents: 900, currentCents: 700, lastNotifiedCents: 900 })).toBe('lowest')
  })
})

describe('shouldResetNotified', () => {
  it('oublie la dernière alerte quand le prix remonte nettement', () => {
    expect(shouldResetNotified(500, 1000)).toBe(true)
    expect(shouldResetNotified(1000, 1040)).toBe(false)
    expect(shouldResetNotified(1000, 1050)).toBe(true)
    expect(shouldResetNotified(null, 1000)).toBe(false)
    expect(shouldResetNotified(1000, null)).toBe(false)
  })
})

describe('formatAlert', () => {
  const p = { title: 'Câble de charge USB Type C en Nylon 240W, très rapide, pour Samsung, Xiaomi, Huawei', currency: 'EUR' }

  it('résume la baisse', () => {
    const m = formatAlert('lowest', p, 446, 399, null)
    expect(m.title).toBe('↓ Câble de charge USB Type C en Nylon 240W, très rapide, pour…')
    expect(m.body.replace(/ | /g, ' ')).toBe('4,46 € → 3,99 € (-11 %) · plus bas relevé (port compris)')
  })

  it('mentionne la cible', () => {
    const m = formatAlert('target', p, 446, 399, 400)
    expect(m.body.replace(/ | /g, ' ')).toContain('sous ta cible de 4,00 €')
  })
})
