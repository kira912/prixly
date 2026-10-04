<script setup lang="ts">
import { LIST_PRICE_MIN_DAYS, type ListPriceCheck, type PriceInsight } from '~~/server/lib/history'

const props = defineProps<{ insight: PriceInsight | null, listPrice: ListPriceCheck | null, currency: string, watched: boolean }>()
const { t } = useI18n()

const verdict = computed(() => {
  const i = props.insight
  if (!i) return null
  const avg = formatMoney(i.averageCents, props.currency)
  const period = t('verdict.period', { days: formatDays(i.spanDays) })
  const below = t('verdict.belowAverage', { pct: Math.abs(i.diffPct), avg, period })
  switch (i.verdict) {
    case 'lowest':
      return { icon: '★', title: t('verdict.lowestTitle'), text: below }
    case 'good':
      return { icon: '✓', title: t('verdict.goodTitle'), text: below }
    case 'high':
      return { icon: '!', title: t('verdict.highTitle'), text: t('verdict.highText', { pct: i.diffPct, avg, period }) }
    default:
      return { icon: '=', title: t('verdict.usualTitle'), text: t('verdict.usualText', { avg, period }) }
  }
})

const promo = computed(() => {
  const l = props.listPrice
  if (!l) return null
  const list = formatMoney(l.listPriceCents, props.currency)
  switch (l.status) {
    case 'never_seen':
      return {
        tone: 'bad',
        icon: '!',
        title: t('verdict.dubiousTitle'),
        text: t('verdict.dubiousText', { list, days: formatDays(l.spanDays), highest: formatMoney(l.highestSeenCents, props.currency) }),
      }
    case 'observed':
      return { tone: 'good', icon: '✓', title: t('verdict.realTitle'), text: t('verdict.realText', { list }) }
    default:
      return {
        tone: 'neutral',
        icon: '?',
        title: t('verdict.pendingTitle'),
        text: t(props.watched ? 'verdict.pendingWatched' : 'verdict.pendingNotWatched', { n: LIST_PRICE_MIN_DAYS, list }),
      }
  }
})
</script>

<template>
  <div v-if="verdict || promo" class="verdicts">
    <p v-if="verdict" class="verdict" :data-verdict="insight!.verdict">
      <span class="verdict-icon" aria-hidden="true">{{ verdict.icon }}</span>
      <span><strong>{{ verdict.title }}</strong> · {{ verdict.text }}</span>
    </p>
    <p v-if="promo" class="verdict" :data-tone="promo.tone">
      <span class="verdict-icon" aria-hidden="true">{{ promo.icon }}</span>
      <span><strong>{{ promo.title }}</strong> · {{ promo.text }}</span>
    </p>
  </div>
</template>
