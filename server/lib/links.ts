import { ExtractError, type ProductRef } from './types'
import { browserFetch } from './http'

const AMAZON_HOST = /(^|\.)amazon\.(fr|de|es|it|nl|be|com|co\.uk|ca|com\.be|pl|se)$/
const AMAZON_SHORT = /^(amzn\.eu|amzn\.to|a\.co)$/
const ALIEXPRESS_HOST = /(^|\.)aliexpress\.(com|us|ru)$/

export function isFollowableHost(host: string): boolean {
  return AMAZON_HOST.test(host) || AMAZON_SHORT.test(host) || ALIEXPRESS_HOST.test(host)
}

export function extractUrl(input: string): string | null {
  const m = input.match(/https?:\/\/[^\s<>"'`]+/i)
  if (m) return m[0].replace(/[),.;!?»]+$/, '')
  const bare = input.match(/\b(?:[a-z0-9-]+\.)*(?:amazon\.[a-z.]+|amzn\.(?:eu|to)|aliexpress\.[a-z]+)\/[^\s<>"'`]*/i)
  return bare ? `https://${bare[0]}` : null
}

export function identify(rawUrl: string): ProductRef | null {
  let url: URL
  try {
    url = new URL(rawUrl)
  }
  catch {
    return null
  }
  const host = url.hostname.toLowerCase()

  if (AMAZON_HOST.test(host)) {
    const asin = url.pathname.match(/\/(?:dp|gp\/product|gp\/aw\/d|product|d)\/([A-Z0-9]{10})(?:[/?]|$)/i)?.[1]
    if (!asin) return null
    const domain = host.replace(/^(www\.|m\.|smile\.)/, '')
    return { platform: 'amazon', externalId: asin.toUpperCase(), url: `https://www.${domain}/dp/${asin.toUpperCase()}` }
  }

  if (ALIEXPRESS_HOST.test(host)) {
    const haystack = safeDecode(url.href)
    const id = haystack.match(/\/(?:item|i)\/(\d{8,20})\.html/)?.[1]
      ?? haystack.match(/[?&](?:productIds?|itemId|objectId)=(\d{8,20})/)?.[1]
    if (!id) return null
    return { platform: 'aliexpress', externalId: id, url: `https://fr.aliexpress.com/item/${id}.html` }
  }

  return null
}

function safeDecode(s: string): string {
  let out = s
  for (let i = 0; i < 3; i++) {
    try {
      const next = decodeURIComponent(out)
      if (next === out) break
      out = next
    }
    catch {
      break
    }
  }
  return out
}

export async function resolveProductRef(input: string, fetchImpl: typeof fetch = browserFetch): Promise<ProductRef> {
  const first = extractUrl(input)
  if (!first) throw new ExtractError('unsupported', 'No link found in the shared text.', { key: 'no_link' })

  let current = first
  for (let hop = 0; hop < 8; hop++) {
    const ref = identify(current)
    if (ref) return ref

    const host = new URL(current).hostname.toLowerCase()
    if (!isFollowableHost(host)) break

    let res: Response
    try {
      res = await fetchImpl(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
      })
    }
    catch {
      throw new ExtractError('network', 'Could not follow the shared link.', { key: 'follow_failed' })
    }

    const location = res.headers.get('location')
    if (res.status >= 300 && res.status < 400 && location) {
      current = new URL(location, current).href
      continue
    }

    const body = await res.text()
    const candidates = body.match(/https?:(?:\/|\\\/){2}[^\s"'<>]+/g) ?? []
    for (const c of candidates) {
      const found = identify(c.replace(/\\\//g, '/').replace(/&amp;/g, '&'))
      if (found) return found
    }
    break
  }

  throw new ExtractError('unsupported', 'This link is not a recognized Amazon or AliExpress product.')
}
