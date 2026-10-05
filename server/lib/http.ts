import { Impit } from 'impit'
import { ExtractError } from './types'

export interface StoredCookie {
  name: string
  value: string
  domain: string
  expires: number | null
}

/**
 * Cookies shared by every request, like a browser profile: a returning visitor with a session
 * (and, once passed, the captcha cookies) looks far less like a bot than a cookieless one.
 * Path and Secure are ignored: only Amazon / AliExpress pages go through it.
 */
export class CookieJar {
  private cookies = new Map<string, StoredCookie>()
  changed = false

  setCookie(header: string, url: string) {
    const [pair = '', ...attrs] = header.split(';')
    const eq = pair.indexOf('=')
    if (eq <= 0) return
    const name = pair.slice(0, eq).trim()
    const value = pair.slice(eq + 1).trim()

    let domain = new URL(url).hostname
    let expires: number | null = null
    for (const attr of attrs) {
      const [k = '', v = ''] = attr.split('=', 2).map(s => s.trim())
      const key = k.toLowerCase()
      if (key === 'domain' && v) domain = v.replace(/^\./, '').toLowerCase()
      else if (key === 'max-age') expires = Date.now() + Number(v) * 1000
      else if (key === 'expires' && expires == null) expires = Date.parse(v) || null
    }

    const id = `${domain}|${name}`
    if (expires != null && expires <= Date.now()) this.cookies.delete(id)
    else this.cookies.set(id, { name, value, domain, expires })
    this.changed = true
  }

  getCookieString(url: string): string {
    const host = new URL(url).hostname
    const now = Date.now()
    return [...this.cookies.values()]
      .filter(c => (host === c.domain || host.endsWith(`.${c.domain}`)) && (c.expires == null || c.expires > now))
      .map(c => `${c.name}=${c.value}`)
      .join('; ')
  }

  get(url: string, name: string): string | undefined {
    return this.getCookieString(url).split('; ').find(c => c.startsWith(`${name}=`))?.slice(name.length + 1)
  }

  /** Forgets the session of a site (e.g. www.amazon.fr → every cookie of amazon.fr). */
  clearSite(url: string) {
    const host = new URL(url).hostname
    for (const [id, c] of this.cookies) {
      if (host === c.domain || host.endsWith(`.${c.domain}`)) this.cookies.delete(id)
    }
    this.changed = true
  }

  toJSON(): StoredCookie[] {
    const now = Date.now()
    return [...this.cookies.values()].filter(c => c.expires == null || c.expires > now)
  }

  load(cookies: StoredCookie[]) {
    for (const c of cookies) this.cookies.set(`${c.domain}|${c.name}`, c)
  }
}

export const cookieJar = new CookieJar()

const impit = new Impit({
  browser: 'chrome142',
  proxyUrl: process.env.PRIXLY_PROXY_URL || undefined,
  followRedirects: true,
  cookieJar,
})

export const browserFetch = ((input: string | URL, init?: RequestInit) => impit.fetch(input, init as any)) as unknown as typeof fetch

export const BROWSER_HEADERS: Record<string, string> = {
  'accept-language': 'fr-FR,fr;q=0.9,en-US;q=0.8,en;q=0.7',
}

export async function fetchText(url: string, init: RequestInit = {}, fetchImpl: typeof fetch = browserFetch): Promise<{ status: number, body: string, headers: Headers }> {
  let res: Response
  try {
    res = await fetchImpl(url, {
      ...init,
      headers: { ...BROWSER_HEADERS, ...(init.headers as Record<string, string> | undefined) },
      signal: init.signal ?? AbortSignal.timeout(15_000),
    })
  }
  catch (err) {
    throw new ExtractError('network', `Request to ${new URL(url).hostname} failed (${(err as Error).message})`, { platform: new URL(url).hostname })
  }
  return { status: res.status, body: await res.text(), headers: res.headers }
}

/**
 * Last resort when a page stays blocked: a scraping API (residential IPs, captchas and JS
 * challenges handled on their side), e.g. https://api.scrape.do/?token=…&url={url}
 * or https://api.scraperapi.com/?api_key=…&url={url}.
 */
export function scraperUrl(target: string, template = process.env.PRIXLY_SCRAPER_URL): string | null {
  return template?.includes('{url}') ? template.replace('{url}', encodeURIComponent(target)) : null
}

export function fetchViaScraper(target: string): Promise<{ status: number, body: string, headers: Headers }> | null {
  const url = scraperUrl(target)
  return url ? fetchText(url, { signal: AbortSignal.timeout(60_000) }, globalThis.fetch) : null
}

export const humanPause = (minMs: number, maxMs: number) =>
  new Promise(resolve => setTimeout(resolve, minMs + Math.random() * (maxMs - minMs)))
