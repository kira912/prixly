import { describe, expect, it } from 'vitest'
import { checkListPrice, nextStats, priceInsight, samePrice, toPricePoints } from '../server/lib/history'

const snap = (day: number, priceCents: number | null, shippingCents: number | null = 0) =>
  ({ priceCents, shippingCents, capturedAt: new Date(2026, 8, day) })

describe('toPricePoints', () => {
  it('groups identical readings into steps', () => {
    const points = toPricePoints([snap(1, 1000), snap(2, 1000), snap(3, 900), snap(4, 900), snap(5, 1000)])
    expect(points.map(p => [p.at.getDate(), p.until.getDate(), p.totalCents])).toEqual([
      [1, 2, 1000],
      [3, 4, 900],
      [5, 5, 1000],
    ])
  })

  it('compares the total, shipping included', () => {
    const points = toPricePoints([snap(1, 1000, 200), snap(2, 800, 400), snap(3, 800, 0)])
    expect(points.map(p => p.totalCents)).toEqual([1200, 800])
  })

  it('sorts readings by date', () => {
    const points = toPricePoints([snap(3, 900), snap(1, 1000)])
    expect(points.map(p => p.totalCents)).toEqual([1000, 900])
  })

  it('isolates unavailability periods', () => {
    const points = toPricePoints([snap(1, 1000), snap(2, null), snap(3, 1000)])
    expect(points.map(p => p.totalCents)).toEqual([1000, null, 1000])
  })
})

describe('toPricePoints with compacted steps', () => {
  it('extends the step up to last_seen_at', () => {
    const points = toPricePoints([
      { priceCents: 1000, shippingCents: 0, capturedAt: new Date(2026, 8, 1), lastSeenAt: new Date(2026, 8, 5) },
      { priceCents: 900, shippingCents: 0, capturedAt: new Date(2026, 8, 6), lastSeenAt: new Date(2026, 8, 9) },
    ])
    expect(points.map(p => [p.at.getDate(), p.until.getDate(), p.totalCents])).toEqual([[1, 5, 1000], [6, 9, 900]])
  })

  it('merges two rows with the same total (different price / shipping split)', () => {
    const points = toPricePoints([
      { priceCents: 1000, shippingCents: 200, capturedAt: new Date(2026, 8, 1), lastSeenAt: new Date(2026, 8, 3) },
      { priceCents: 800, shippingCents: 400, capturedAt: new Date(2026, 8, 4), lastSeenAt: new Date(2026, 8, 7) },
    ])
    expect(points.map(p => [p.at.getDate(), p.until.getDate(), p.totalCents])).toEqual([[1, 7, 1200]])
  })
})

describe('samePrice', () => {
  it('compares price and shipping separately', () => {
    expect(samePrice({ priceCents: 100, shippingCents: 0 }, { priceCents: 100, shippingCents: 0 })).toBe(true)
    expect(samePrice({ priceCents: 100, shippingCents: 50 }, { priceCents: 150, shippingCents: 0 })).toBe(false)
    expect(samePrice({ priceCents: null, shippingCents: null }, { priceCents: null, shippingCents: null })).toBe(true)
  })
})

describe('nextStats', () => {
  function replay(totals: Array<number | null>) {
    let state: Parameters<typeof nextStats>[0] = null
    for (const t of totals) state = { ...nextStats(state, t), currentCents: t }
    return state
  }

  it('computes lowest, highest and previous price', () => {
    expect(replay([1000, 1000, 1200, 1200, 900])).toEqual({ lowestCents: 900, highestCents: 1200, previousCents: 1200, currentCents: 900 })
  })

  it('first reading: no previous price', () => {
    expect(replay([500])).toEqual({ lowestCents: 500, highestCents: 500, previousCents: null, currentCents: 500 })
    expect(replay([500, 500]).previousCents).toBeNull()
  })

  it('goes through unavailability without losing the last known price', () => {
    expect(replay([1000, null, 900])).toMatchObject({ previousCents: 1000, lowestCents: 900 })
    expect(replay([1000, null])).toMatchObject({ previousCents: 1000, lowestCents: 1000, currentCents: null })
  })

  it('ignores a product that was never available', () => {
    expect(replay([null, null])).toEqual({ lowestCents: null, highestCents: null, previousCents: null, currentCents: null })
  })
})

describe('priceInsight', () => {
  const point = (from: number, to: number, totalCents: number | null) =>
    ({ at: new Date(2026, 8, from), until: new Date(2026, 8, to), priceCents: totalCents, shippingCents: 0, totalCents })
  const now = new Date(2026, 8, 30)

  it('says nothing with less than 7 days of history', () => {
    expect(priceInsight([point(25, 30, 1000)], now)).toBeNull()
  })

  it('weights the average by step duration', () => {
    const insight = priceInsight([point(0, 20, 1000), point(20, 30, 1300)], now)
    expect(insight).toEqual({ verdict: 'high', averageCents: 1100, diffPct: 18, spanDays: 30 })
  })

  it('spots the lowest price seen', () => {
    expect(priceInsight([point(0, 20, 1000), point(20, 30, 800)], now)?.verdict).toBe('lowest')
  })

  it('rates a low price that isn\'t the lowest', () => {
    const insight = priceInsight([point(0, 5, 800), point(5, 25, 1100), point(25, 30, 950)], now)
    expect(insight?.verdict).toBe('good')
  })

  it('ignores unavailability periods and readings older than 90 days', () => {
    const insight = priceInsight([
      { ...point(0, 0, 5000), at: new Date(2026, 4, 1) },
      { ...point(0, 10, 1000), at: new Date(2026, 5, 1) },
      point(10, 20, null),
      point(20, 30, 1000),
    ], now)
    expect(insight).toMatchObject({ verdict: 'normal', averageCents: 1000 })
  })

  it('says nothing if the product is unavailable', () => {
    expect(priceInsight([point(0, 20, 1000), point(20, 30, null)], now)).toBeNull()
  })
})

describe('checkListPrice', () => {
  const now = new Date(2026, 9, 31)

  it('confirms a deal whose list price was actually charged', () => {
    const check = checkListPrice(2000, 1500, [snap(1, 2000), snap(20, 1500)], now)
    expect(check).toMatchObject({ status: 'observed', discountPct: 25, highestSeenCents: 2000 })
  })

  it('flags a list price never charged in 30 days', () => {
    const check = checkListPrice(2500, 1500, [snap(1, 1600), snap(20, 1500)], now)
    expect(check).toMatchObject({ status: 'never_seen', discountPct: 40, highestSeenCents: 1600 })
  })

  it('waits for enough history before judging', () => {
    expect(checkListPrice(2500, 1500, [snap(1, 1500)], new Date(2026, 8, 10))?.status).toBe('too_early')
  })

  it('ignores a missing list price or one below the price', () => {
    expect(checkListPrice(null, 1500, [], now)).toBeNull()
    expect(checkListPrice(1400, 1500, [], now)).toBeNull()
  })
})
