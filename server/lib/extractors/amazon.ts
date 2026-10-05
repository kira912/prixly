import * as cheerio from 'cheerio'
import { browserFetch, cookieJar, fetchText, fetchViaScraper, humanPause } from '../http'
import { currencyFromSymbol, parseCount, parseFrenchDeliveryDays, parsePrice, parseRating } from '../parse'
import { ExtractError, type ProductInfo, type ProductRef } from '../types'

type Page = Awaited<ReturnType<typeof fetchText>>

export async function extractAmazon(ref: ProductRef, fetchImpl: typeof fetch = browserFetch): Promise<ProductInfo> {
  let page = await fetchProductPage(ref.url, fetchImpl)

  // A flagged session keeps getting blocked: start over as a new visitor, once
  if (blockKind(page) && fetchImpl === browserFetch && cookieJar.getCookieString(ref.url)) {
    cookieJar.clearSite(ref.url)
    await humanPause(1500, 4000)
    page = await fetchProductPage(ref.url, fetchImpl)
  }

  const kind = blockKind(page)
  if (kind) {
    const viaScraper = await fetchViaScraper(ref.url)
    if (viaScraper && !blockKind(viaScraper)) page = viaScraper
    else if (kind === 'challenge') throw new ExtractError('blocked', 'Amazon is asking for a JavaScript bot check.', { platform: 'Amazon' })
    else throw new ExtractError('blocked', 'Amazon is asking for a captcha.', { platform: 'Amazon' })
  }

  if (page.status === 404) throw new ExtractError('not_found', 'Product not found on Amazon.', { platform: 'Amazon' })
  if (page.status !== 200) throw new ExtractError('network', `Amazon responded ${page.status}.`, { platform: 'Amazon' })

  // Prices and offers depend on the delivery address, guessed from the IP (the US on Vercel):
  // a store that does not ship there shows a third-party offer at any price
  const local = LOCAL_ADDRESS[new URL(ref.url).hostname]
  const country = deliveryCountry(page.body)
  if (fetchImpl === browserFetch && local && country && country !== local.country) {
    if (await setDeliveryAddress(page.body, ref.url, local.location, fetchImpl)) {
      const again = await fetchText(ref.url, {}, fetchImpl)
      if (again.status === 200 && isProductPage(again.body)) page = again
    }
  }
  return parseAmazonHtml(page.body, ref)
}

// amazon.nl / amazon.com.be want a postcode with a city id: the country alone is enough there
const LOCAL_ADDRESS: Record<string, { country: string, location: Record<string, string> }> = {
  'www.amazon.fr': { country: 'FR', location: { locationType: 'LOCATION_INPUT', zipCode: '75001' } },
  'www.amazon.de': { country: 'DE', location: { locationType: 'LOCATION_INPUT', zipCode: '10115' } },
  'www.amazon.es': { country: 'ES', location: { locationType: 'LOCATION_INPUT', zipCode: '28001' } },
  'www.amazon.it': { country: 'IT', location: { locationType: 'LOCATION_INPUT', zipCode: '00184' } },
  'www.amazon.nl': { country: 'NL', location: { locationType: 'COUNTRY', district: 'NL', countryCode: 'NL' } },
  'www.amazon.com.be': { country: 'BE', location: { locationType: 'COUNTRY', district: 'BE', countryCode: 'BE' } },
}

/** Country of the delivery address the page was priced for. */
export function deliveryCountry(html: string): string | null {
  return html.match(/"zipCode":(?:null|"[^"]*"),"countryCode":"([A-Z]{2})"/)?.[1] ?? null
}

/** Sets a local address like a visitor would with "Update location"; kept in the session cookies. */
async function setDeliveryAddress(html: string, pageUrl: string, location: Record<string, string>, fetchImpl: typeof fetch): Promise<boolean> {
  const { origin } = new URL(pageUrl)
  const ajax = { 'referer': pageUrl, 'x-requested-with': 'XMLHttpRequest', 'sec-fetch-site': 'same-origin', 'sec-fetch-mode': 'cors', 'sec-fetch-dest': 'empty' }
  try {
    const modal = JSON.parse(cheerio.load(html)('#nav-global-location-data-modal-action').attr('data-a-modal') ?? 'null')
    if (!modal?.url) return false
    await humanPause(800, 2000)
    const selections = await fetchText(new URL(modal.url, origin).href, { headers: { ...ajax, ...modal.ajaxHeaders } }, fetchImpl)
    const csrf = selections.body.match(/CSRF_TOKEN\s*:\s*"([^"]+)"/)?.[1]
    if (!csrf) return false

    await humanPause(800, 2000)
    const res = await fetchText(`${origin}/portal-migration/hz/glow/address-change?actionSource=glow`, {
      method: 'POST',
      headers: { ...ajax, 'content-type': 'application/json', 'anti-csrftoken-a2z': csrf },
      body: JSON.stringify({ ...location, deviceType: 'web', storeContext: 'generic', pageType: 'Detail', actionSource: 'glow' }),
    }, fetchImpl)
    const ok = /"successful":1/.test(res.body)
    if (!ok) console.warn(`[amazon] could not set the delivery address on ${origin} (${res.status})`)
    return ok
  }
  catch (err) {
    console.warn(`[amazon] could not set the delivery address on ${origin}`, err)
    return false
  }
}

/** Loads the page; on the "Continue shopping" interstitial, clicks the button like a visitor would. */
async function fetchProductPage(url: string, fetchImpl: typeof fetch): Promise<Page> {
  const page = await fetchText(url, {}, fetchImpl)
  if (blockKind(page) !== 'captcha') return page

  const submit = continueShoppingUrl(page.body, url)
  if (!submit) return page
  await humanPause(1200, 3500)
  const next = await fetchText(submit.href, { headers: { 'referer': url, 'sec-fetch-site': 'same-origin' } }, fetchImpl)
  if (next.status === 200 && isProductPage(next.body)) return next
  return blockKind(next) ? next : fetchText(url, {}, fetchImpl)
}

const isProductPage = (html: string) => html.includes('id="productTitle"')

/** 'challenge': AWS WAF JavaScript challenge (needs a real browser); 'captcha': Amazon's own captcha page. */
export function blockKind({ status, body, headers }: Page): 'challenge' | 'captcha' | null {
  if (status === 404) return null
  if (headers.get('x-amzn-waf-action') || (status === 202 && /awswaf|challenge\.js/.test(body))) return 'challenge'
  if (status === 503 || (/validateCaptcha|captcha/i.test(body.slice(0, 20_000)) && !isProductPage(body))) return 'captcha'
  return null
}

/**
 * The "Cliquez sur le bouton ci-dessous pour continuer vos achats" page is a form whose answer is
 * already filled in hidden fields: submitting it is enough. Returns null for the image captcha.
 */
export function continueShoppingUrl(html: string, pageUrl: string): URL | null {
  const $ = cheerio.load(html)
  const form = $('form[action*="validateCaptcha"]').first()
  if (!form.length || form.find('img[src*="captcha" i], #captchacharacters').length) return null

  const inputs = form.find('input[name]').toArray()
  if (inputs.some(el => ($(el).attr('type') ?? 'text').toLowerCase() === 'text' && !$(el).attr('value'))) return null

  const url = new URL(form.attr('action')!, pageUrl)
  for (const el of inputs) url.searchParams.append($(el).attr('name')!, $(el).attr('value') ?? '')
  return url
}

export function parseAmazonHtml(html: string, ref: ProductRef, now = new Date()): ProductInfo {
  const $ = cheerio.load(html)

  const title = $('#productTitle').first().text().replace(/\s+/g, ' ').trim()
  if (!title) throw new ExtractError('parse', 'Product title not found in the Amazon page.', { platform: 'Amazon' })

  const { priceCents, currency } = readPrice($, html)
  const delivery = readDelivery($, now)

  return {
    ...ref,
    title,
    image: readImage($),
    currency,
    priceCents,
    listPriceCents: readListPrice($, priceCents),
    ...delivery,
    rating: parseRating($('#acrPopover').attr('title')),
    reviewCount: parseCount($('#acrCustomerReviewText').first().text()),
  }
}

function readPrice($: cheerio.CheerioAPI, html: string): { priceCents: number | null, currency: string } {
  for (const m of html.matchAll(/\{"displayPrice":"[^"]*","priceAmount":([\d.]+),"currencySymbol":"([^"]*)"[^{}]*?"buyingOptionType":"(\w+)"/g)) {
    if (m[3] === 'NEW') {
      return { priceCents: Math.round(Number.parseFloat(m[1]!) * 100), currency: currencyFromSymbol(m[2]) }
    }
  }

  const selectors = [
    '#corePriceDisplay_desktop_feature_div .apex-pricetopay-value .a-offscreen',
    '#corePrice_feature_div .apex-pricetopay-value .a-offscreen',
    '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
    '#corePrice_feature_div .a-price .a-offscreen',
    '#priceblock_ourprice',
    '#priceblock_dealprice',
    '.a-price .a-offscreen',
  ]
  for (const sel of selectors) {
    for (const el of $(sel).toArray()) {
      const p = parsePrice($(el).text())
      if (p) return { priceCents: p.cents, currency: p.currency }
    }
  }
  return { priceCents: null, currency: 'EUR' }
}

function readListPrice($: cheerio.CheerioAPI, priceCents: number | null): number | null {
  if (priceCents == null) return null
  const el = $('#corePriceDisplay_desktop_feature_div, #corePrice_feature_div')
    .find('.basisPrice .a-offscreen, .apex-basisprice-value .a-offscreen')
    .first()
  const cents = parsePrice(el.text())?.cents
  return cents != null && cents > priceCents ? cents : null
}

function readImage($: cheerio.CheerioAPI): string | null {
  const img = $('#landingImage, #imgBlkFront, #main-image').first()
  const hires = img.attr('data-old-hires')
  if (hires) return hires

  const dynamic = img.attr('data-a-dynamic-image')
  if (dynamic) {
    try {
      const sizes = JSON.parse(dynamic) as Record<string, [number, number]>
      const best = Object.entries(sizes).sort((a, b) => b[1][0] * b[1][1] - a[1][0] * a[1][1])[0]
      if (best) return best[0]
    }
    catch {}
  }
  return img.attr('src') ?? $('meta[property="og:image"]').attr('content') ?? null
}

function readDelivery($: cheerio.CheerioAPI, now: Date): Pick<ProductInfo, 'shippingCents' | 'shippingNote' | 'freeShippingOver' | 'shipsFrom' | 'deliveryMinDays' | 'deliveryMaxDays' | 'deliveryText'> {
  const el = $('#mir-layout-DELIVERY_BLOCK [data-csa-c-delivery-price]').first()
  if (!el.length) {
    return { shippingCents: null, shippingNote: null, freeShippingOver: null, shipsFrom: null, deliveryMinDays: null, deliveryMaxDays: null, deliveryText: null }
  }

  const rawPrice = el.attr('data-csa-c-delivery-price')?.trim() ?? ''
  const shippingCents = /gratuit|free/i.test(rawPrice) ? 0 : (parsePrice(rawPrice)?.cents ?? null)
  const condition = el.attr('data-csa-c-delivery-condition')?.trim() || null
  const deliveryText = el.attr('data-csa-c-delivery-time')?.trim() || null
  const days = parseFrenchDeliveryDays(deliveryText, now)

  return {
    shippingCents,
    shippingNote: condition ? `${rawPrice} ${condition}` : null,
    freeShippingOver: null,
    shipsFrom: null,
    deliveryText,
    deliveryMinDays: days?.min ?? null,
    deliveryMaxDays: days?.max ?? null,
  }
}
