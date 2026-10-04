import { describe, expect, it } from 'vitest'
import { extractUrl, identify, resolveProductRef } from '../server/lib/links'

describe('extractUrl', () => {
  it('finds the link in shared text', () => {
    expect(extractUrl('Regarde ce produit sur AliExpress ! 2,47€ | Câble https://a.aliexpress.com/_EzABCD')).toBe('https://a.aliexpress.com/_EzABCD')
  })
  it('strips trailing punctuation', () => {
    expect(extractUrl('(voir https://amzn.eu/d/abc123).')).toBe('https://amzn.eu/d/abc123')
  })
  it('accepts a link without scheme', () => {
    expect(extractUrl('amazon.fr/dp/B06VW5BH2K')).toBe('https://amazon.fr/dp/B06VW5BH2K')
  })
  it('returns null without a link', () => {
    expect(extractUrl('rien ici')).toBeNull()
  })
})

describe('identify', () => {
  it.each([
    'https://www.amazon.fr/dp/B06VW5BH2K',
    'https://www.amazon.fr/Duracell-Piles/dp/B06VW5BH2K/ref=sr_1_1?crid=XYZ&keywords=pile',
    'https://www.amazon.fr/gp/product/B06VW5BH2K?psc=1',
    'https://m.amazon.fr/gp/aw/d/B06VW5BH2K',
    'https://amazon.fr/dp/b06vw5bh2k',
  ])('Amazon %s', (url) => {
    expect(identify(url)).toEqual({ platform: 'amazon', externalId: 'B06VW5BH2K', url: 'https://www.amazon.fr/dp/B06VW5BH2K' })
  })

  it('keeps the Amazon domain', () => {
    expect(identify('https://www.amazon.de/dp/B06VW5BH2K')?.url).toBe('https://www.amazon.de/dp/B06VW5BH2K')
  })

  it.each([
    'https://fr.aliexpress.com/item/1005009561948552.html?spm=a2g0o.productlist&algo_pvid=abc',
    'https://m.aliexpress.com/item/1005009561948552.html',
    'https://www.aliexpress.us/item/1005009561948552.html',
    'https://star.aliexpress.com/share/share.htm?redirectUrl=https%3A%2F%2Ffr.aliexpress.com%2Fitem%2F1005009561948552.html%3Fsrc%3Dshare',
  ])('AliExpress %s', (url) => {
    expect(identify(url)).toEqual({ platform: 'aliexpress', externalId: '1005009561948552', url: 'https://fr.aliexpress.com/item/1005009561948552.html' })
  })

  it('ignores other sites and non-product pages', () => {
    expect(identify('https://example.com/dp/B06VW5BH2K')).toBeNull()
    expect(identify('https://www.amazon.fr/s?k=pile')).toBeNull()
    expect(identify('https://evil-amazon.fr.example.com/dp/B06VW5BH2K')).toBeNull()
  })
})

describe('resolveProductRef', () => {
  function fakeFetch(routes: Record<string, { status: number, location?: string, body?: string }>) {
    const calls: string[] = []
    const impl = (async (input: string | URL | Request) => {
      const url = String(input)
      calls.push(url)
      const r = routes[url]
      if (!r) throw new Error(`unexpected fetch ${url}`)
      return new Response(r.body ?? '', { status: r.status, headers: r.location ? { location: r.location } : {} })
    }) as typeof fetch
    return { impl, calls }
  }

  it('follows short-link redirects', async () => {
    const { impl } = fakeFetch({
      'https://amzn.eu/d/abc123': { status: 301, location: 'https://www.amazon.fr/dp/B06VW5BH2K?ref=share' },
    })
    await expect(resolveProductRef('Découvrez https://amzn.eu/d/abc123', impl)).resolves.toMatchObject({ platform: 'amazon', externalId: 'B06VW5BH2K' })
  })

  it('finds the product in a JavaScript redirect page', async () => {
    const { impl } = fakeFetch({
      'https://a.aliexpress.com/_EzABCD': { status: 302, location: 'https://s.click.aliexpress.com/e/xyz' },
      'https://s.click.aliexpress.com/e/xyz': { status: 200, body: '<script>location.href="https:\\/\\/fr.aliexpress.com\\/item\\/1005009561948552.html?aff=1"</script>' },
    })
    await expect(resolveProductRef('https://a.aliexpress.com/_EzABCD', impl)).resolves.toMatchObject({ platform: 'aliexpress', externalId: '1005009561948552' })
  })

  it('doesn\'t contact unknown hosts', async () => {
    const { impl, calls } = fakeFetch({})
    await expect(resolveProductRef('http://169.254.169.254/latest/meta-data', impl)).rejects.toMatchObject({ code: 'unsupported' })
    expect(calls).toEqual([])
  })

  it('stops following a redirect to an unknown host', async () => {
    const { impl, calls } = fakeFetch({
      'https://amzn.eu/d/evil': { status: 302, location: 'http://localhost:3000/admin' },
    })
    await expect(resolveProductRef('https://amzn.eu/d/evil', impl)).rejects.toMatchObject({ code: 'unsupported' })
    expect(calls).toEqual(['https://amzn.eu/d/evil'])
  })
})
