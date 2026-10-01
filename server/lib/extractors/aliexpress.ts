import { createHash } from 'node:crypto'
import { browserFetch } from '../http'
import { parseCount, parsePrice, parseRating } from '../parse'
import { ExtractError, type ProductInfo, type ProductRef } from '../types'

/**
 * AliExpress charge prix et livraison côté client via l'API interne « mtop ».
 * On l'appelle directement : il faut d'abord obtenir un jeton (_m_h5_tk) posé en cookie,
 * puis signer chaque requête avec md5(token&t&appKey&data).
 */
const MTOP_API = 'mtop.aliexpress.pdp.pc.query'
const MTOP_APP_KEY = '12574478'
const LOCALE = { lang: 'fr_FR', currency: 'EUR', country: 'FR', site: 'fra' }

let cookieJar = ''

function tokenFromCookies(cookies: string): string {
  return cookies.match(/_m_h5_tk=([^_;]+)/)?.[1] ?? ''
}

async function mtopCall(productId: string, fetchImpl: typeof fetch): Promise<{ ret: string[], data: any }> {
  const data = JSON.stringify({
    productId,
    _lang: LOCALE.lang,
    _currency: LOCALE.currency,
    country: LOCALE.country,
    province: '',
    city: '',
    channel: '',
    pdp_ext_f: '',
    pdpNPI: '',
    sourceType: '',
    clientType: 'pc',
    ext: JSON.stringify({ foreignChannel: 'SEO', fromSysForeign: true, site: LOCALE.site, lang: LOCALE.lang, currency: LOCALE.currency, crawler: false, x_object_id: productId }),
  })
  const t = Date.now().toString()
  const sign = createHash('md5').update(`${tokenFromCookies(cookieJar)}&${t}&${MTOP_APP_KEY}&${data}`).digest('hex')
  const query = new URLSearchParams({ jsv: '2.5.1', appKey: MTOP_APP_KEY, t, sign, api: MTOP_API, v: '1.0', type: 'originaljson', dataType: 'json', data })

  let res: Response
  try {
    res = await fetchImpl(`https://acs.aliexpress.com/h5/${MTOP_API}/1.0/?${query}`, {
      headers: { 'accept': 'application/json', 'referer': 'https://fr.aliexpress.com/', 'cookie': cookieJar },
      signal: AbortSignal.timeout(15_000),
    })
  }
  catch (err) {
    throw new ExtractError('network', `Requête impossible vers AliExpress (${(err as Error).message})`)
  }

  const set = res.headers.getSetCookie?.() ?? []
  if (set.length) {
    const jar = new Map(cookieJar.split('; ').filter(Boolean).map(c => [c.split('=')[0], c] as const))
    for (const c of set) {
      const pair = c.split(';')[0]!
      jar.set(pair.split('=')[0], pair)
    }
    cookieJar = [...jar.values()].join('; ')
  }

  const json = await res.json().catch(() => null) as { ret?: string[], data?: any } | null
  if (!json) throw new ExtractError('parse', 'Réponse AliExpress illisible.')
  return { ret: json.ret ?? [], data: json.data }
}

function countryName(code: unknown): string | undefined {
  if (typeof code !== 'string' || !/^[A-Z]{2}$/.test(code)) return undefined
  try {
    return new Intl.DisplayNames(['fr'], { type: 'region' }).of(code)
  }
  catch {
    return undefined
  }
}

export async function extractAliExpress(ref: ProductRef, fetchImpl: typeof fetch = browserFetch): Promise<ProductInfo> {
  let resp = await mtopCall(ref.externalId, fetchImpl)
  // Premier appel ou jeton expiré : la réponse pose un nouveau cookie, on rejoue une fois
  if (resp.ret.some(r => /TOKEN_EMPTY|TOKEN_EXOIRED|TOKEN_EXPIRED|ILLEGAL_SIGN/.test(r))) {
    resp = await mtopCall(ref.externalId, fetchImpl)
  }

  const ret = resp.ret.join(' ')
  if (/USER_VALIDATE|RGV587|punish/i.test(ret)) {
    throw new ExtractError('blocked', 'AliExpress demande une vérification anti-robot : réessaie plus tard.')
  }
  if (!resp.ret.some(r => r.startsWith('SUCCESS'))) {
    throw new ExtractError('network', `AliExpress a refusé la requête (${ret || 'réponse vide'}).`)
  }

  return parseAliExpressResult(resp.data?.result, ref)
}

export function parseAliExpressResult(result: any, ref: ProductRef): ProductInfo {
  if (!result || typeof result !== 'object') throw new ExtractError('not_found', 'Produit introuvable sur AliExpress.')

  const title: string = result.PRODUCT_TITLE?.text ?? result.GLOBAL_DATA?.globalData?.subject ?? ''
  if (!title) throw new ExtractError('not_found', 'Produit introuvable sur AliExpress (retiré ou indisponible).')

  const priceInfo = result.PRICE?.targetSkuPriceInfo
    ?? result.PRICE?.skuIdStrPriceInfoMap?.[String(result.PRICE?.selectedSkuId)]
  const price = parsePrice(priceInfo?.salePriceString)

  const biz = result.SHIPPING?.deliveryLayoutInfo?.[0]?.bizData ?? {}
  let shippingCents: number | null = null
  if (biz.shippingFee === 'free') shippingCents = 0
  else if (typeof biz.displayAmount === 'number') shippingCents = Math.round(biz.displayAmount * 100)
  else shippingCents = parsePrice(biz.formattedAmount)?.cents ?? null

  const notes: string[] = []
  if (biz.company) notes.push(biz.company)
  if (biz.logisticsComposeThreshold && biz.choiceFreeShipping === 'yes' && shippingCents) {
    notes.push(`gratuite dès ${biz.logisticsComposeThreshold} d'achat`)
  }
  const shipFrom = countryName(biz.shipFromCode) ?? biz.shipFrom
  if (shipFrom) notes.push(`expédié depuis ${shipFrom}`)

  const deliveryText = biz.displayEtaMinDate && biz.displayEtaMaxDate
    ? `${biz.displayEtaMinDate} – ${biz.displayEtaMaxDate}`
    : (biz.deliveryDate ?? null)

  const images: string[] = result.HEADER_IMAGE_PC?.imagePathList ?? []
  const image = images[0] ?? result.GLOBAL_DATA?.globalData?.image ?? null

  return {
    ...ref,
    title,
    image: image ? image.replace(/^\/\//, 'https://') : null,
    currency: price?.currency ?? LOCALE.currency,
    priceCents: price?.cents ?? null,
    shippingCents,
    shippingNote: notes.length ? notes.join(' · ') : null,
    deliveryMinDays: typeof biz.deliveryDayMin === 'number' ? biz.deliveryDayMin : null,
    deliveryMaxDays: typeof biz.deliveryDayMax === 'number' ? biz.deliveryDayMax : null,
    deliveryText,
    rating: parseRating(result.PC_RATING?.rating),
    reviewCount: typeof result.PC_RATING?.totalValidNum === 'number' ? result.PC_RATING.totalValidNum : parseCount(result.PC_RATING?.totalValidNum),
  }
}
