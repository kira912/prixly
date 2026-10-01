export type Platform = 'amazon' | 'aliexpress'

export interface ProductRef {
  platform: Platform
  /** ASIN pour Amazon, product id pour AliExpress */
  externalId: string
  /** URL canonique, sans paramètres de tracking */
  url: string
}

export interface ProductInfo extends ProductRef {
  title: string
  image: string | null
  currency: string
  /** Montants en centimes ; null si non trouvé */
  priceCents: number | null
  shippingCents: number | null
  /** Ex. « Livraison gratuite dès 10,00€ d'achat » */
  shippingNote: string | null
  deliveryMinDays: number | null
  deliveryMaxDays: number | null
  /** Texte brut affiché par la plateforme, ex. « vendredi 2 octobre » */
  deliveryText: string | null
  rating: number | null
  reviewCount: number | null
}

export type ExtractErrorCode = 'unsupported' | 'not_found' | 'blocked' | 'parse' | 'network'

export class ExtractError extends Error {
  constructor(public code: ExtractErrorCode, message: string) {
    super(message)
    this.name = 'ExtractError'
  }
}
