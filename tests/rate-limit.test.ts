import { describe, expect, it } from 'vitest'
import { hit, type CounterStorage } from '../server/lib/rate-limit'

function memoryStorage(): CounterStorage & { ttls: number[] } {
  const map = new Map<string, unknown>()
  const ttls: number[] = []
  return {
    ttls,
    getItem: async key => map.get(key) ?? null,
    setItem: async (key, value, opts) => {
      map.set(key, value)
      if (opts?.ttl) ttls.push(opts.ttl)
    },
  }
}

describe('hit', () => {
  const rule = { limit: 3, windowSec: 60 }

  it('autorise jusqu’à la limite puis refuse', async () => {
    const s = memoryStorage()
    const results = []
    for (let i = 0; i < 5; i++) results.push(await hit(s, 'k', rule, 1000))
    expect(results.map(r => r.allowed)).toEqual([true, true, true, false, false])
    expect(results.map(r => r.remaining)).toEqual([2, 1, 0, 0, 0])
  })

  it('repart de zéro à la fin de la fenêtre', async () => {
    const s = memoryStorage()
    for (let i = 0; i < 4; i++) await hit(s, 'k', rule, 0)
    expect((await hit(s, 'k', rule, 59_999)).allowed).toBe(false)
    expect((await hit(s, 'k', rule, 60_000)).allowed).toBe(true)
  })

  it('isole les clés', async () => {
    const s = memoryStorage()
    for (let i = 0; i < 4; i++) await hit(s, 'a', rule, 0)
    expect((await hit(s, 'b', rule, 0)).allowed).toBe(true)
  })

  it('indique le délai avant réinitialisation et le transmet en TTL', async () => {
    const s = memoryStorage()
    await hit(s, 'k', rule, 0)
    const r = await hit(s, 'k', rule, 45_500)
    expect(r.retryAfterSec).toBe(15)
    expect(s.ttls.at(-1)).toBe(15)
  })
})
