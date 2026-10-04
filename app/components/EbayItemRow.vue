<script setup lang="ts">
import type { EbayItem } from '~~/server/lib/ebay'

const props = defineProps<{
  item: EbayItem
  units?: number
  note?: string
}>()
const { t } = useI18n()

const totalCents = computed(() => props.item.priceCents + (props.item.shippingCents ?? 0))

const shippingLabel = computed(() => {
  const s = props.item.shippingCents
  if (s == null) return t('ebay.item.shippingUnknown')
  if (s === 0) return t('ebay.item.shippingFree')
  return t('ebay.item.shipping', { amount: formatMoney(s, props.item.currency) })
})

function endsIn(date: string): string {
  const hours = (new Date(date).getTime() - Date.now()) / 3_600_000
  if (hours < 1) return t('ebay.item.endsSoon')
  if (hours < 48) return t('ebay.item.hoursLeft', { n: Math.round(hours) })
  return t('ebay.item.daysLeft', { n: Math.round(hours / 24) })
}
</script>

<template>
  <a :href="item.url" target="_blank" rel="noopener noreferrer" class="product-row">
    <img v-if="item.image" :src="item.image" alt="" loading="lazy" referrerpolicy="no-referrer">
    <div v-else class="img-placeholder" />
    <div class="product-row-body">
      <span class="product-row-title" :title="item.title">{{ item.title }}</span>
      <span class="muted small">
        <span v-if="item.condition" class="badge" :data-condition="item.isNew ? 'new' : 'used'">{{ item.condition }}</span>
        <template v-if="item.auction"> {{ t('ebay.item.auction') }}<template v-if="item.endsAt"> · {{ endsIn(item.endsAt) }}</template></template>
        <template v-if="item.country && item.country !== 'FR'"> · {{ t('ebay.item.shipsFrom', { country: countryName(item.country) }) }}</template>
      </span>
      <span v-if="note" class="ai-note small">{{ note }}</span>
    </div>
    <div class="product-row-price">
      <strong>{{ formatMoney(totalCents, item.currency) }}</strong>
      <span v-if="units && units > 1" class="muted small">{{ t('ebay.item.lot', { n: units, price: formatMoney(Math.round(totalCents / units), item.currency) }) }}</span>
      <span v-else class="muted small">{{ shippingLabel }}</span>
    </div>
  </a>
</template>
