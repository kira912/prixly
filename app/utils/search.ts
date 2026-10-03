/**
 * Recherche multi-plateformes par liens : Prixly ne scrape aucune page de résultats,
 * il ouvre la recherche de chaque site avec la requête déjà saisie.
 * Fichier sans dépendance Nuxt : importé tel quel par les tests.
 */

export type SearchKind = 'new' | 'used'

export interface SearchPlatform {
  id: string
  name: string
  kind: SearchKind
  /** Ce qu'on y trouve, quand ce n'est pas évident */
  hint?: string
  /** Prixly sait lire la fiche produit : on peut la lui partager pour le coût total et le suivi */
  supported?: boolean
  url: (q: string) => string
}

const enc = encodeURIComponent

export const SEARCH_PLATFORMS: SearchPlatform[] = [
  { id: 'amazon', name: 'Amazon', kind: 'new', supported: true, url: q => `https://www.amazon.fr/s?k=${enc(q)}` },
  { id: 'aliexpress', name: 'AliExpress', kind: 'new', supported: true, hint: 'moins cher, livraison plus longue', url: q => `https://fr.aliexpress.com/w/wholesale-${enc(q.trim().replace(/\s+/g, '-'))}.html` },
  { id: 'temu', name: 'Temu', kind: 'new', hint: 'petits prix, qualité variable', url: q => `https://www.temu.com/fr/search_result.html?search_key=${enc(q)}` },
  { id: 'cdiscount', name: 'Cdiscount', kind: 'new', url: q => `https://www.cdiscount.com/search/10/${enc(q).replace(/%20/g, '+')}.html` },
  { id: 'fnac', name: 'Fnac', kind: 'new', url: q => `https://www.fnac.com/SearchResult/ResultList.aspx?Search=${enc(q)}` },
  { id: 'idealo', name: 'idealo', kind: 'new', hint: 'comparateur : des centaines de boutiques', url: q => `https://www.idealo.fr/prechcat.html?q=${enc(q)}` },
  { id: 'google-shopping', name: 'Google Shopping', kind: 'new', hint: 'toutes les boutiques', url: q => `https://www.google.com/search?tbm=shop&q=${enc(q)}` },

  { id: 'leboncoin', name: 'Leboncoin', kind: 'used', hint: 'annonces près de chez toi', url: q => `https://www.leboncoin.fr/recherche?text=${enc(q)}` },
  { id: 'vinted', name: 'Vinted', kind: 'used', hint: 'mode, maison, enfants', url: q => `https://www.vinted.fr/catalog?search_text=${enc(q)}` },
  { id: 'ebay', name: 'eBay', kind: 'used', hint: 'neuf et occasion, enchères', url: q => `https://www.ebay.fr/sch/i.html?_nkw=${enc(q)}` },
  { id: 'backmarket', name: 'Back Market', kind: 'used', hint: 'high-tech reconditionné, garanti', url: q => `https://www.backmarket.fr/fr-fr/search?q=${enc(q)}` },
  { id: 'amazon-seconde-vie', name: 'Amazon Seconde Vie', kind: 'used', supported: true, hint: 'retours Amazon vérifiés', url: q => `https://www.amazon.fr/s?k=${enc(q)}&i=warehouse-deals` },
]

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  new: 'Neuf',
  used: 'Occasion et reconditionné',
}

export function searchLinks(query: string, kind?: SearchKind) {
  const q = query.trim()
  if (!q) return []
  return SEARCH_PLATFORMS
    .filter(p => !kind || p.kind === kind)
    .map(({ url, ...p }) => ({ ...p, href: url(q) }))
}

/**
 * Le texte saisi ou partagé contient-il un lien ? Sinon, c'est une recherche.
 * (Même idée que extractUrl côté serveur, sans l'importer : server/lib/links tire le client HTTP natif.)
 */
export function looksLikeLink(input: string): boolean {
  return /https?:\/\/\S/i.test(input) || /\b(?:amazon\.[a-z.]+|amzn\.(?:eu|to)|aliexpress\.[a-z]+)\/\S/i.test(input)
}
