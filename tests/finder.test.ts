import { describe, expect, it, vi } from 'vitest'
import type { AssistAdvice } from '../server/lib/assist'
import type { EbayItem } from '../server/lib/ebay'
import { applyRanking, dedupeCandidates, fromEbay, fromWebHit, parseWebHits, rankPrompt, withVerifiedProduct } from '../server/lib/finder'
import { createOpenAiCompatibleProvider, supportsBrowserSearch } from '../server/lib/llm/openai-compatible'

const advice: AssistAdvice = {
  understood: 'A cordless vacuum for a small flat with a cat.',
  queries: [{ query: 'aspirateur balai animaux', why: '' }],
  condition: 'any',
  conditionWhy: '',
  budgetMaxEuros: 200,
  criteria: ['30 min battery'],
  avoid: ['generic batteries'],
  question: '',
}

const ebayItem: EbayItem = {
  id: 'v1|1|0', title: 'Dyson V8 Animal', url: 'https://www.ebay.fr/itm/1', image: null, priceCents: 15000, shippingCents: 500,
  currency: 'EUR', condition: 'Occasion', isNew: false, auction: false, endsAt: null, country: 'FR', sellerFeedbackPct: 99,
}

describe('parseWebHits', () => {
  it('reads the JSON array and drops search, category and duplicate pages', () => {
    const text = `Here you go:
[
  {"url": "https://www.amazon.fr/dp/B0ABCDEF12?ref=x#reviews", "title": "Aspirateur A"},
  {"url": "https://www.amazon.fr/dp/B0ABCDEF12", "title": "Duplicate"},
  {"url": "https://www.amazon.fr/s?k=aspirateur", "title": "Search page"},
  {"url": "https://www.darty.com/nav/achat/aspirateur-x.html", "title": "Aspirateur X"},
  {"url": "https://www.cdiscount.com/search/10/aspirateur.html", "title": "Search"},
  {"url": "ftp://example.com/file", "title": "Not http"}
]`
    expect(parseWebHits(text)).toEqual([
      { url: 'https://www.amazon.fr/dp/B0ABCDEF12?ref=x', title: 'Aspirateur A' },
      { url: 'https://www.darty.com/nav/achat/aspirateur-x.html', title: 'Aspirateur X' },
    ])
  })

  it('ignores citation marks inside the answer', () => {
    expect(parseWebHits('[{"url": "https://www.fnac.com/a1234/x", "title": "X"}]【3†L1-L4】')).toEqual([{ url: 'https://www.fnac.com/a1234/x', title: 'X' }])
  })

  it('falls back to bare URLs when there is no JSON', () => {
    expect(parseWebHits('See https://www.boulanger.com/ref/1234567, it is good.')).toEqual([{ url: 'https://www.boulanger.com/ref/1234567', title: '' }])
  })
})

describe('candidates', () => {
  it('keeps the real price from eBay and Prixly, never from the web page title', () => {
    expect(fromEbay(ebayItem)).toMatchObject({ source: 'ebay', priceCents: 15000, shippingCents: 500, shop: 'eBay' })
    const web = fromWebHit({ url: 'https://www.darty.com/nav/achat/x.html', title: 'X à 99 €' })
    expect(web).toMatchObject({ source: 'web', shop: 'darty.com', priceCents: null })
    const verified = withVerifiedProduct(fromWebHit({ url: 'https://www.amazon.fr/dp/B0ABCDEF12', title: '' }), {
      id: 7, title: 'Aspirateur A', url: 'https://www.amazon.fr/dp/B0ABCDEF12', image: null, priceCents: 12999, shippingCents: 0, currency: 'EUR', platform: 'amazon',
    })
    expect(verified).toMatchObject({ shop: 'Amazon', priceCents: 12999, productId: 7 })
  })

  it('dedupes the same Prixly product found twice', () => {
    const a = withVerifiedProduct(fromWebHit({ url: 'https://www.amazon.fr/dp/B0ABCDEF12', title: '' }), { id: 7, title: 'A', url: 'u', image: null, priceCents: 1, shippingCents: 0, currency: 'EUR', platform: 'amazon' })
    const b = withVerifiedProduct(fromWebHit({ url: 'https://www.amazon.fr/dp/B0ABCDEF12?th=1', title: '' }), { id: 7, title: 'A', url: 'u', image: null, priceCents: 1, shippingCents: 0, currency: 'EUR', platform: 'amazon' })
    expect(dedupeCandidates([a, b])).toHaveLength(1)
  })
})

describe('ranking', () => {
  const candidates = [fromEbay(ebayItem), fromWebHit({ url: 'https://www.darty.com/nav/achat/x.html', title: 'Aspirateur X' })]

  it('lists offers with total price or unknown price', () => {
    const prompt = rankPrompt('vacuum', advice, candidates)
    expect(prompt).toContain('Budget: at most 200 EUR')
    expect(prompt).toContain('[0] Dyson V8 Animal | 155.00 EUR total | Occasion | eBay')
    expect(prompt).toContain('[1] Aspirateur X | price unknown | darty.com')
  })

  it('keeps valid picks in order and leaves the rest as other offers', () => {
    const { picks, others } = applyRanking(candidates, {
      picks: [
        { n: 1, fit: 'partial', reason: 'Matches the need', warning: 'Price unknown' },
        { n: 1, fit: 'great', reason: 'dup', warning: '' },
        { n: 9, fit: 'great', reason: 'made up', warning: '' },
      ],
    })
    expect(picks.map(p => [p.candidate.id, p.fit])).toEqual([[candidates[1]!.id, 'partial']])
    expect(others.map(c => c.id)).toEqual([candidates[0]!.id])
  })
})

describe('web search provider', () => {
  it('is only offered on Groq gpt-oss models', () => {
    expect(supportsBrowserSearch('https://api.groq.com/openai/v1', 'openai/gpt-oss-120b')).toBe(true)
    expect(supportsBrowserSearch('https://openrouter.ai/api/v1', 'openai/gpt-oss-120b')).toBe(false)
    expect(supportsBrowserSearch('https://api.groq.com/openai/v1', 'llama-3.3-70b-versatile')).toBe(false)
    expect(createOpenAiCompatibleProvider({ apiKey: 'k', webSearchModel: 'llama-3.3-70b-versatile' }).searchWeb).toBeUndefined()
  })

  it('asks for the browser_search tool and returns the answer text', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ choices: [{ message: { content: '[{"url":"https://a.fr/p/1"}]' } }] })))
    const provider = createOpenAiCompatibleProvider({ apiKey: 'gsk', fetchImpl })
    expect(await provider.searchWeb!({ system: 's', user: 'u' })).toBe('[{"url":"https://a.fr/p/1"}]')
    const body = JSON.parse(fetchImpl.mock.calls[0]![1]!.body as string)
    expect(body.model).toBe('openai/gpt-oss-20b')
    expect(body.tools).toEqual([{ type: 'browser_search' }])
    expect(body.tool_choice).toBe('required')
    expect(body.messages).toEqual([{ role: 'user', content: 's u' }])
    expect(body.response_format).toBeUndefined()
  })

  it('retries once on a server error', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{"error":{"message":"Internal Server Error"}}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })))
    const provider = createOpenAiCompatibleProvider({ apiKey: 'gsk', fetchImpl })
    expect(await provider.searchWeb!({ system: 's', user: 'u' })).toBe('ok')
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })

  it('waits for a short rate limit before retrying, gives up on a long one', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'retry-after': '0.01' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })))
    expect(await createOpenAiCompatibleProvider({ apiKey: 'gsk', fetchImpl }).searchWeb!({ system: 's', user: 'u' })).toBe('ok')

    const slow = vi.fn<typeof fetch>(async () => new Response('{}', { status: 429, headers: { 'retry-after': '120' } }))
    await expect(createOpenAiCompatibleProvider({ apiKey: 'gsk', fetchImpl: slow }).searchWeb!({ system: 's', user: 'u' })).rejects.toMatchObject({ statusCode: 429, key: 'errors.ai.busy' })
    expect(slow).toHaveBeenCalledTimes(2)
  })
})

describe('web search quota', () => {
  const quota = () => new Response('{"error":{"message":"Rate limit reached for model `openai/gpt-oss-20b` on tokens per day (TPD): Limit 200000"}}', { status: 429, headers: { 'retry-after': '231' } })

  it('switches to the other model when the daily quota of the first one is used up', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(quota())
      .mockResolvedValueOnce(new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] })))
    expect(await createOpenAiCompatibleProvider({ apiKey: 'gsk', fetchImpl }).searchWeb!({ system: 's', user: 'u' })).toBe('ok')
    expect(fetchImpl.mock.calls.map(c => JSON.parse(c[1]!.body as string).model)).toEqual(['openai/gpt-oss-20b', 'openai/gpt-oss-120b'])
  })

  it('reports a daily quota distinctly when every model is out', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => quota())
    await expect(createOpenAiCompatibleProvider({ apiKey: 'gsk', fetchImpl }).searchWeb!({ system: 's', user: 'u' })).rejects.toMatchObject({ statusCode: 429, key: 'errors.ai.quota' })
    expect(fetchImpl).toHaveBeenCalledTimes(2)
  })
})
