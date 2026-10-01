import { Impit } from 'impit'
import { ExtractError } from './types'

/**
 * Client HTTP qui imite Chrome jusqu'à la poignée de main TLS et HTTP/2 (JA3/JA4, ordre des en-têtes).
 * Le fetch de Node (undici) a une empreinte TLS qui ne ressemble à aucun navigateur : même avec un UA de navigateur,
 * Amazon et AliExpress le repèrent vite. impit pose lui-même User-Agent, Accept, Sec-Fetch-*… cohérents
 * avec l'empreinte : on ne surcharge que la langue. (Constaté en 2026-10 : le profil « firefox » d'impit
 * reçoit un captcha Amazon systématique, « chrome142 » passe.)
 * PRIXLY_PROXY_URL (http://, socks5://…) fait passer toutes les requêtes par un proxy, résidentiel de préférence.
 */
const impit = new Impit({
  browser: 'chrome142',
  proxyUrl: process.env.PRIXLY_PROXY_URL || undefined,
  // Les redirections sont suivies par appel (redirect: 'manual' pour les liens courts)
  followRedirects: true,
})

/** Même contrat que fetch pour ce qu'on en utilise (status, headers, text, json) : les extracteurs restent testables avec un faux fetch. */
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
    throw new ExtractError('network', `Requête impossible vers ${new URL(url).hostname} (${(err as Error).message})`)
  }
  return { status: res.status, body: await res.text(), headers: res.headers }
}
