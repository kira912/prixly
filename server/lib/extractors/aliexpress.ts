import { createHash } from 'node:crypto'
import { browserFetch, cookieJar } from '../http'
import { parseCount, parsePrice, parseRating } from '../parse'
import { ExtractError, type ProductInfo, type ProductRef } from '../types'

const MTOP_API = 'mtop.aliexpress.pdp.pc.query'
const MTOP_APP_KEY = '12574478'
const LOCALE = { lang: 'fr_FR', currency: 'EUR', country: 'FR', site: 'fra' }

const MTOP_URL = `https://acs.aliexpress.com/h5/${MTOP_API}/1.0/`

// The signing token comes back as a cookie (shared jar, so it survives between requests)
function mtopToken(): string {
  return cookieJar.get(MTOP_URL, '_m_h5_tk')?.split('_')[0] ?? ''
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
  const sign = createHash('md5').update(`${mtopToken()}&${t}&${MTOP_APP_KEY}&${data}`).digest('hex')
  const query = new URLSearchParams({ jsv: '2.5.1', appKey: MTOP_APP_KEY, t, sign, api: MTOP_API, v: '1.0', type: 'originaljson', dataType: 'json', data })

  let res: Response
  try {
    res = await fetchImpl(`${MTOP_URL}?${query}`, {
      headers: { 'accept': 'application/json', 'referer': 'https://fr.aliexpress.com/', 'sec-fetch-site': 'same-site', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' },
      signal: AbortSignal.timeout(15_000),
    })
  }
  catch (err) {
    throw new ExtractError('network', `Request to AliExpress failed (${(err as Error).message})`, { platform: 'AliExpress' })
  }

  const json = await res.json().catch(() => null) as { ret?: string[], data?: any } | null
  if (!json) throw new ExtractError('parse', 'Unreadable AliExpress response.', { platform: 'AliExpress' })
  return { ret: json.ret ?? [], data: json.data }
}

export async function extractAliExpress(ref: ProductRef, fetchImpl: typeof fetch = browserFetch): Promise<ProductInfo> {
  let resp = await mtopCall(ref.externalId, fetchImpl)
  if (resp.ret.some(r => /TOKEN_EMPTY|TOKEN_EXOIRED|TOKEN_EXPIRED|ILLEGAL_SIGN/.test(r))) {
    resp = await mtopCall(ref.externalId, fetchImpl)
  }

  const ret = resp.ret.join(' ')
  if (/USER_VALIDATE|RGV587|punish/i.test(ret)) {
    throw new ExtractError('blocked', 'AliExpress is asking for a bot check.', { platform: 'AliExpress' })
  }
  if (!resp.ret.some(r => r.startsWith('SUCCESS'))) {
    throw new ExtractError('network', `AliExpress rejected the request (${ret || 'empty response'}).`, { platform: 'AliExpress' })
  }

  return parseAliExpressResult(resp.data?.result, ref)
}

export function parseAliExpressResult(result: any, ref: ProductRef): ProductInfo {
  if (!result || typeof result !== 'object') throw new ExtractError('not_found', 'Product not found on AliExpress.', { platform: 'AliExpress' })

  const title: string = result.PRODUCT_TITLE?.text ?? result.GLOBAL_DATA?.globalData?.subject ?? ''
  if (!title) throw new ExtractError('not_found', 'Product not found on AliExpress (removed or unavailable).', { platform: 'AliExpress' })

  const priceInfo = result.PRICE?.targetSkuPriceInfo
    ?? result.PRICE?.skuIdStrPriceInfoMap?.[String(result.PRICE?.selectedSkuId)]
  const price = parsePrice(priceInfo?.salePriceString)
  const originalCents = parsePrice(priceInfo?.originalPrice?.formatedAmount ?? priceInfo?.originalPriceString)?.cents
    ?? (typeof result.GLOBAL_DATA?.globalData?.eventInfo?.clcEvent?.originalPriceCent === 'number'
      ? result.GLOBAL_DATA.globalData.eventInfo.clcEvent.originalPriceCent
      : null)

  const biz = result.SHIPPING?.deliveryLayoutInfo?.[0]?.bizData ?? {}
  let shippingCents: number | null = null
  if (biz.shippingFee === 'free') shippingCents = 0
  else if (typeof biz.displayAmount === 'number') shippingCents = Math.round(biz.displayAmount * 100)
  else shippingCents = parsePrice(biz.formattedAmount)?.cents ?? null

  const freeShippingOver = biz.logisticsComposeThreshold && biz.choiceFreeShipping === 'yes' && shippingCents
    ? String(biz.logisticsComposeThreshold)
    : null
  const shipsFrom = typeof biz.shipFromCode === 'string' && /^[A-Z]{2}$/.test(biz.shipFromCode)
    ? biz.shipFromCode
    : (biz.shipFrom ?? null)

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
    listPriceCents: price && originalCents != null && originalCents > price.cents ? originalCents : null,
    shippingCents,
    shippingNote: biz.company ?? null,
    freeShippingOver,
    shipsFrom,
    deliveryMinDays: typeof biz.deliveryDayMin === 'number' ? biz.deliveryDayMin : null,
    deliveryMaxDays: typeof biz.deliveryDayMax === 'number' ? biz.deliveryDayMax : null,
    deliveryText,
    rating: parseRating(result.PC_RATING?.rating),
    reviewCount: typeof result.PC_RATING?.totalValidNum === 'number' ? result.PC_RATING.totalValidNum : parseCount(result.PC_RATING?.totalValidNum),
  }
}
