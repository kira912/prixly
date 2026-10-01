<script setup lang="ts">
import type { PriceStats } from '~~/server/lib/history'

// Variation du total par rapport au palier précédent ; flèche + texte, jamais la couleur seule
const props = defineProps<{ stats: PriceStats, currency: string }>()

const delta = computed(() => {
  const { currentCents: cur, previousCents: prev } = props.stats
  if (cur == null || prev == null || cur === prev) return null
  return { cents: cur - prev, pct: Math.round(((cur - prev) / prev) * 100) }
})
const isLowest = computed(() => delta.value && props.stats.currentCents === props.stats.lowestCents)
</script>

<template>
  <span v-if="delta" class="delta" :data-trend="delta.cents < 0 ? 'down' : 'up'">
    {{ delta.cents < 0 ? '↓' : '↑' }}
    {{ formatMoney(Math.abs(delta.cents), currency) }}
    <span class="delta-pct">({{ delta.pct > 0 ? '+' : '' }}{{ delta.pct }} %)</span>
    <template v-if="isLowest"> · plus bas</template>
  </span>
</template>
