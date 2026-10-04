export type Platform = 'amazon' | 'aliexpress'

export interface ProductRef {
  platform: Platform
  externalId: string
  url: string
}

export interface ProductInfo extends ProductRef {
  title: string
  image: string | null
  currency: string
  priceCents: number | null
  shippingCents: number | null
  listPriceCents: number | null
  shippingNote: string | null
  freeShippingOver: string | null
  shipsFrom: string | null
  deliveryMinDays: number | null
  deliveryMaxDays: number | null
  deliveryText: string | null
  rating: number | null
  reviewCount: number | null
}

export type ExtractErrorCode = 'unsupported' | 'not_found' | 'blocked' | 'parse' | 'network'

export type ExtractErrorKey = ExtractErrorCode | 'no_link' | 'follow_failed'

export class ExtractError extends Error {
  constructor(
    public code: ExtractErrorCode,
    message: string,
    public details: { key?: ExtractErrorKey, platform?: string } = {},
  ) {
    super(message)
    this.name = 'ExtractError'
  }

  get key(): ExtractErrorKey {
    return this.details.key ?? this.code
  }
}
