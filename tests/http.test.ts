import { describe, expect, it } from 'vitest'
import { blockKind, continueShoppingUrl, deliveryCountry } from '../server/lib/extractors/amazon'
import { CookieJar, scraperUrl } from '../server/lib/http'

const page = (status: number, body: string, headers: Record<string, string> = {}) => ({ status, body, headers: new Headers(headers) })

describe('CookieJar', () => {
  it('sends domain cookies to subdomains only', () => {
    const jar = new CookieJar()
    jar.setCookie('session-id=123; Domain=.amazon.fr; Expires=Tue, 05-Oct-2100 07:14:07 GMT; Path=/; Secure', 'https://www.amazon.fr/dp/X')
    jar.setCookie('i18n-prefs=EUR; Domain=.amazon.fr; Path=/', 'https://www.amazon.fr/dp/X')
    jar.setCookie('session-id=999; Domain=.amazon.de; Path=/', 'https://www.amazon.de/dp/X')
    expect(jar.getCookieString('https://www.amazon.fr/gp/cart')).toBe('session-id=123; i18n-prefs=EUR')
    expect(jar.getCookieString('https://notamazon.fr/')).toBe('')
    expect(jar.get('https://www.amazon.de/', 'session-id')).toBe('999')
  })

  it('drops expired cookies and clears a site', () => {
    const jar = new CookieJar()
    jar.setCookie('a=1; Domain=.amazon.fr', 'https://www.amazon.fr/')
    jar.setCookie('b=2', 'https://www.amazon.fr/')
    jar.setCookie('a=; Domain=.amazon.fr; Max-Age=0', 'https://www.amazon.fr/')
    expect(jar.getCookieString('https://www.amazon.fr/')).toBe('b=2')
    jar.clearSite('https://www.amazon.fr/')
    expect(jar.toJSON()).toEqual([])
  })

  it('round-trips through JSON', () => {
    const jar = new CookieJar()
    jar.setCookie('_m_h5_tk=abc_123; Domain=.aliexpress.com; Max-Age=3600', 'https://acs.aliexpress.com/h5/x')
    const copy = new CookieJar()
    copy.load(JSON.parse(JSON.stringify(jar.toJSON())))
    expect(copy.get('https://acs.aliexpress.com/', '_m_h5_tk')).toBe('abc_123')
  })
})

describe('Amazon block detection', () => {
  it('recognises the AWS WAF challenge', () => {
    expect(blockKind(page(202, '<script src="https://x.token.awswaf.com/challenge.js"></script>', { 'x-amzn-waf-action': 'challenge' }))).toBe('challenge')
  })

  it('recognises the captcha page, not a product page', () => {
    expect(blockKind(page(200, '<form action="/errors/validateCaptcha"></form>'))).toBe('captcha')
    expect(blockKind(page(503, 'Sorry'))).toBe('captcha')
    expect(blockKind(page(200, '<span id="productTitle">x</span> captcha'))).toBeNull()
    expect(blockKind(page(404, 'not found'))).toBeNull()
  })
})

describe('continueShoppingUrl', () => {
  it('submits the pre-filled "continue shopping" form', () => {
    const html = `<form method="get" action="/errors/validateCaptcha" name="">
      <input type=hidden name="amzn" value="abc+/=" /><input type=hidden name="amzn-r" value="&#047;dp&#047;B06VW5BH2K" />
      <input type=hidden name="field-keywords" value="KXAEXP" />
      <button type="submit" class="a-button-text" alt="Continuer les achats">Continuer les achats</button></form>`
    const url = continueShoppingUrl(html, 'https://www.amazon.fr/dp/B06VW5BH2K')!
    expect(url.origin + url.pathname).toBe('https://www.amazon.fr/errors/validateCaptcha')
    expect(Object.fromEntries(url.searchParams)).toEqual({ 'amzn': 'abc+/=', 'amzn-r': '/dp/B06VW5BH2K', 'field-keywords': 'KXAEXP' })
  })

  it('gives up on the image captcha', () => {
    const html = `<form method="get" action="/errors/validateCaptcha"><input type=hidden name="amzn" value="a" />
      <img src="https://images-na.ssl-images-amazon.com/captcha/xyz/Captcha_abc.jpg">
      <input id="captchacharacters" name="field-keywords" type="text"></form>`
    expect(continueShoppingUrl(html, 'https://www.amazon.fr/dp/X')).toBeNull()
  })
})

describe('scraperUrl', () => {
  it('fills the {url} placeholder', () => {
    expect(scraperUrl('https://www.amazon.fr/dp/X?th=1', 'https://api.scrape.do/?token=t&url={url}'))
      .toBe('https://api.scrape.do/?token=t&url=https%3A%2F%2Fwww.amazon.fr%2Fdp%2FX%3Fth%3D1')
    expect(scraperUrl('https://a.fr', undefined)).toBeNull()
  })
})

describe('deliveryCountry', () => {
  it('reads the country the page was priced for', () => {
    expect(deliveryCountry('{"buyingOptionTypes":["NEW"],"zipCode":"75001","countryCode":"FR","productAsin":"X"}')).toBe('FR')
    expect(deliveryCountry('{"buyingOptionTypes":["NEW"],"zipCode":null,"countryCode":"US","productAsin":"X"}')).toBe('US')
    expect(deliveryCountry('<html></html>')).toBeNull()
  })
})
