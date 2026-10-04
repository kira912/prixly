import * as cheerio from 'cheerio'
import { browserFetch, fetchText } from '../http'
import { currencyFromSymbol, parseCount, parseFrenchDeliveryDays, parsePrice, parseRating } from '../parse'
import { ExtractError, type ProductInfo, type ProductRef } from '../types'

export async function extractAmazon(ref: ProductRef, fetchImpl: typeof fetch = browserFetch): Promise<ProductInfo> {
  const { status, body } = await fetchText(ref.url, {}, fetchImpl)
  if (status === 404) throw new ExtractError('not_found', 'Product not found on Amazon.', { platform: 'Amazon' })
  if (status === 503 || (/validateCaptcha|captcha/i.test(body.slice(0, 20_000)) && !body.includes('id="productTitle"'))) {
    throw new ExtractError('blocked', 'Amazon is asking for a captcha.', { platform: 'Amazon' })
  }
  if (status !== 200) throw new ExtractError('network', `Amazon responded ${status}.`, { platform: 'Amazon' })
  return parseAmazonHtml(body, ref)
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
