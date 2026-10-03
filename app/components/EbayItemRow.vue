<script setup lang="ts">
import type { EbayItem } from '~~/server/lib/ebay'

const props = defineProps<{
  item: EbayItem
  /** Lot : nombre d'exemplaires, pour afficher le prix à l'unité */
  units?: number
  /** Remarque de l'IA */
  note?: string
}>()

const totalCents = computed(() => props.item.priceCents + (props.item.shippingCents ?? 0))

const shippingLabel = computed(() => {
  const s = props.item.shippingCents
  if (s == null) return 'port à vérifier'
  if (s === 0) return 'port offert'
  return `port ${formatMoney(s, props.item.currency)}`
})

function endsIn(date: string): string {
  const hours = (new Date(date).getTime() - Date.now()) / 3_600_000
  if (hours < 1) return 'se termine bientôt'
  if (hours < 48) return `encore ${Math.round(hours)} h`
  return `encore ${Math.round(hours / 24)} j`
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
        <template v-if="item.auction"> Enchère<template v-if="item.endsAt"> · {{ endsIn(item.endsAt) }}</template></template>
        <template v-if="item.country && item.country !== 'FR'"> · expédié de {{ item.country }}</template>
      </span>
      <span v-if="note" class="ai-note small">{{ note }}</span>
    </div>
    <div class="product-row-price">
      <strong>{{ formatMoney(totalCents, item.currency) }}</strong>
      <span v-if="units && units > 1" class="muted small">lot de {{ units }} · {{ formatMoney(Math.round(totalCents / units), item.currency) }}/u</span>
      <span v-else class="muted small">{{ shippingLabel }}</span>
    </div>
  </a>
</template>
