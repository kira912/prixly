import { describe, expect, it } from 'vitest'
import { AssistSchema, assistPrompt, cleanAdvice } from '../server/lib/assist'

const advice = (over: Partial<Parameters<typeof cleanAdvice>[0]> = {}) => AssistSchema.parse({
  understood: 'Un aspirateur sans fil pour un petit logement avec un chat.',
  queries: [
    { query: 'aspirateur balai sans fil brosse animaux', why: 'les poils de chat' },
    { query: 'Dyson V8 Animal', why: 'référence solide dans ce budget' },
  ],
  condition: 'any',
  conditionWhy: 'Le reconditionné garanti fait baisser le prix.',
  budgetMaxEuros: 200,
  criteria: ['autonomie d\'au moins 30 min', 'batterie remplaçable'],
  avoid: ['batteries génériques sans marque'],
  question: '',
  ...over,
})

describe('assistPrompt', () => {
  it('appends clarifications after the need', () => {
    expect(assistPrompt('  un vélo  ', ['pour aller au travail', '  '])).toBe('My need: un vélo\nClarification: pour aller au travail')
  })
})

describe('cleanAdvice', () => {
  it('keeps valid advice as is', () => {
    expect(cleanAdvice(advice())).toEqual(advice())
  })

  it('deduplicates and caps the searches', () => {
    const out = cleanAdvice(advice({
      queries: [
        { query: 'a', why: '' }, { query: 'A ', why: '' }, { query: '  ', why: '' },
        { query: 'b', why: '' }, { query: 'c', why: '' }, { query: 'd', why: '' }, { query: 'e', why: '' },
      ],
    }))
    expect(out.queries.map(q => q.query)).toEqual(['a', 'b', 'c', 'd'])
  })

  it('ignores an absurd budget and caps the lists', () => {
    const out = cleanAdvice(advice({ budgetMaxEuros: -5, criteria: Array.from({ length: 10 }, (_, i) => `point ${i}`), avoid: ['', 'x', 'y', 'z', 'w'] }))
    expect(out.budgetMaxEuros).toBeNull()
    expect(out.criteria).toHaveLength(6)
    expect(out.avoid).toEqual(['x', 'y', 'z'])
  })

  it('shortens texts that are too long', () => {
    const out = cleanAdvice(advice({ queries: [{ query: 'x'.repeat(200), why: 'y' }] }))
    expect(out.queries[0]!.query).toHaveLength(80)
  })
})
