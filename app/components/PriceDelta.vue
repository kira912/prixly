<script setup lang="ts">
import type { PriceStats } from '~~/server/lib/history'

const props = defineProps<{ stats: PriceStats, currency: string }>()
const { t } = useI18n()

const delta = computed(() => {
  const { currentCents: cur, previousCents: prev } = props.stats
  if (cur == null || prev == null || cur === prev) return null
  return { cents: cur - prev, ratio: (cur - prev) / prev }
})
const isLowest = computed(() => delta.value && props.stats.currentCents === props.stats.lowestCents)
</script>

<template>
  <span v-if="delta" class="delta" :data-trend="delta.cents < 0 ? 'down' : 'up'">
    {{ delta.cents < 0 ? '↓' : '↑' }}
    {{ formatMoney(Math.abs(delta.cents), currency) }}
    <span class="delta-pct">({{ new Intl.NumberFormat(intlLocale(), { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).format(delta.ratio) }})</span>
    <template v-if="isLowest"> · {{ t('delta.lowest') }}</template>
  </span>
</template>
