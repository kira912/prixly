import { Impit } from 'impit'
import { ExtractError } from './types'

const impit = new Impit({
  browser: 'chrome142',
  proxyUrl: process.env.PRIXLY_PROXY_URL || undefined,
  followRedirects: true,
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
