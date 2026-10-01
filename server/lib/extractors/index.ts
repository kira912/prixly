import type { Platform, ProductInfo, ProductRef } from '../types'
import { extractAliExpress } from './aliexpress'
import { extractAmazon } from './amazon'

type Extractor = (ref: ProductRef, fetchImpl?: typeof fetch) => Promise<ProductInfo>

const extractors: Record<Platform, Extractor> = {
  amazon: extractAmazon,
  aliexpress: extractAliExpress,
}

export function extractProduct(ref: ProductRef, fetchImpl?: typeof fetch): Promise<ProductInfo> {
  return extractors[ref.platform](ref, fetchImpl)
}
