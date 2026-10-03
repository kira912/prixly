import { describe, expect, it } from 'vitest'
import { looksLikeLink, searchLinks } from '../app/utils/search'

describe('searchLinks', () => {
  it('encode la recherche pour chaque plateforme', () => {
    const links = searchLinks('  machine à pain  ')
    expect(links.find(l => l.id === 'amazon')?.href).toBe('https://www.amazon.fr/s?k=machine%20%C3%A0%20pain')
    expect(links.find(l => l.id === 'aliexpress')?.href).toBe('https://fr.aliexpress.com/w/wholesale-machine-%C3%A0-pain.html')
    expect(links.find(l => l.id === 'cdiscount')?.href).toBe('https://www.cdiscount.com/search/10/machine+%C3%A0+pain.html')
    expect(links.find(l => l.id === 'leboncoin')?.href).toBe('https://www.leboncoin.fr/recherche?text=machine%20%C3%A0%20pain')
  })

  it('n\'injecte rien dans l\'URL', () => {
    for (const l of searchLinks('a&b=c/../#x?y')) {
      expect(new URL(l.href).hash).toBe('')
      expect(l.href).not.toContain('&b=c')
      expect(l.href).not.toContain('#x')
    }
  })

  it('filtre neuf / occasion', () => {
    expect(searchLinks('vélo', 'used').every(l => l.kind === 'used')).toBe(true)
    expect(searchLinks('vélo', 'new').some(l => l.id === 'leboncoin')).toBe(false)
  })

  it('ne renvoie rien pour une recherche vide', () => {
    expect(searchLinks('   ')).toEqual([])
  })
})

describe('looksLikeLink', () => {
  it.each([
    'https://amzn.eu/d/abc',
    'Regarde ! https://a.aliexpress.com/_xyz',
    'amazon.fr/dp/B06VW5BH2K',
  ])('lien : %s', (input) => {
    expect(looksLikeLink(input)).toBe(true)
  })

  it.each(['machine à pain moulinex', 'iPhone 13 128 Go', 'amazon basics câble'])('recherche : %s', (input) => {
    expect(looksLikeLink(input)).toBe(false)
  })
})
