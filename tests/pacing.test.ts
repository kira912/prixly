import { describe, expect, it } from 'vitest'
import { interleaveByPlatform, nextBackoff } from '../server/lib/pacing'

const HOUR = 60 * 60 * 1000

describe('nextBackoff', () => {
  const rule = { baseMs: HOUR, maxMs: 3 * HOUR }

  it('starts with the base wait', () => {
    expect(nextBackoff(null, rule, 0)).toEqual({ strikes: 1, until: HOUR })
  })

  it('doubles the wait on each consecutive block, capped', () => {
    let state = nextBackoff(null, rule, 0)
    state = nextBackoff(state, rule, 0)
    expect(state.until).toBe(2 * HOUR)
    state = nextBackoff(state, rule, 0)
    expect(state).toEqual({ strikes: 3, until: 3 * HOUR })
    expect(nextBackoff(state, rule, 0).until).toBe(3 * HOUR)
  })
})

describe('interleaveByPlatform', () => {
  it('alternates platforms while keeping each one\'s order', () => {
    const items = [
      { platform: 'amazon' as const, id: 1 },
      { platform: 'amazon' as const, id: 2 },
      { platform: 'amazon' as const, id: 3 },
      { platform: 'aliexpress' as const, id: 4 },
    ]
    expect(interleaveByPlatform(items).map(i => i.id)).toEqual([1, 4, 2, 3])
  })

  it('handles an empty list', () => {
    expect(interleaveByPlatform([])).toEqual([])
  })
})
