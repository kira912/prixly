export type SearchKind = 'new' | 'used'

export interface SearchPlatform {
  id: string
  name: string
  kind: SearchKind
  supported?: boolean
  url: (q: string) => string
}

const enc = encodeURIComponent

export const SEARCH_PLATFORMS: SearchPlatform[] = [
  { id: 'amazon', name: 'Amazon', kind: 'new', supported: true, url: q => `https://www.amazon.fr/s?k=${enc(q)}` },
  { id: 'aliexpress', name: 'AliExpress', kind: 'new', supported: true, url: q => `https://fr.aliexpress.com/w/wholesale-${enc(q.trim().replace(/\s+/g, '-'))}.html` },
  { id: 'temu', name: 'Temu', kind: 'new', url: q => `https://www.temu.com/fr/search_result.html?search_key=${enc(q)}` },
  { id: 'cdiscount', name: 'Cdiscount', kind: 'new', url: q => `https://www.cdiscount.com/search/10/${enc(q).replace(/%20/g, '+')}.html` },
  { id: 'fnac', name: 'Fnac', kind: 'new', url: q => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${enc(q)}` },
  { id: 'idealo', name: 'idealo', kind: 'new', url: q => `https://www.idealo.fr/prechcat.html?q=${enc(q)}` },
  { id: 'google-shopping', name: 'Google Shopping', kind: 'new', url: q => `https://www.google.com/search?tbm=shop&q=${enc(q)}` },

  { id: 'leboncoin', name: 'Leboncoin', kind: 'used', url: q => `https://www.leboncoin.fr/recherche?text=${enc(q)}` },
  { id: 'vinted', name: 'Vinted', kind: 'used', url: q => `https://www.vinted.fr/catalog?search_text=${enc(q)}` },
  { id: 'ebay', name: 'eBay', kind: 'used', url: q => `https://www.ebay.fr/sch/i.html?_nkw=${enc(q)}` },
  { id: 'backmarket', name: 'Back Market', kind: 'used', url: q => `https://www.backmarket.fr/fr-fr/search?q=${enc(q)}` },
  { id: 'amazon-warehouse', name: 'Amazon Seconde Vie', kind: 'used', supported: true, url: q => `https://www.amazon.fr/s?k=${enc(q)}&i=warehouse-deals` },
]

export function searchLinks(query: string, kind?: SearchKind) {
  const q = query.trim()
  if (!q) return []
  return SEARCH_PLATFORMS
    .filter(p => !kind || p.kind === kind)
    .map(({ url, ...p }) => ({ ...p, href: url(q) }))
}

export function looksLikeLink(input: string): boolean {
  return /https?:\/\/\S/i.test(input) || /\b(?:amazon\.[a-z.]+|amzn\.(?:eu|to)|aliexpress\.[a-z]+)\/\S/i.test(input)
}
