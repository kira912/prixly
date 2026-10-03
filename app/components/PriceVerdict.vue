<script setup lang="ts">
import { LIST_PRICE_MIN_DAYS, type ListPriceCheck, type PriceInsight } from '~~/server/lib/history'

// Avis sur le prix actuel (comparé à l'historique) et sur le prix barré affiché par la plateforme ;
// icône + texte, jamais la couleur seule
const props = defineProps<{ insight: PriceInsight | null, listPrice: ListPriceCheck | null, currency: string, watched: boolean }>()

const days = (n: number) => (n <= 1 ? `${n} jour` : `${n} jours`)

const verdict = computed(() => {
  const i = props.insight
  if (!i) return null
  const avg = formatMoney(i.averageCents, props.currency)
  const period = `des ${days(i.spanDays)} de suivi`
  switch (i.verdict) {
    case 'lowest':
      return { icon: '★', title: 'Plus bas prix observé', text: `${Math.abs(i.diffPct)} % sous la moyenne (${avg}) ${period}.` }
    case 'good':
      return { icon: '✓', title: 'Bon moment pour acheter', text: `${Math.abs(i.diffPct)} % sous la moyenne (${avg}) ${period}.` }
    case 'high':
      return { icon: '!', title: 'Prix élevé', text: `${i.diffPct} % au-dessus de la moyenne (${avg}) ${period} : mieux vaut attendre une baisse.` }
    default:
      return { icon: '=', title: 'Prix habituel', text: `Proche de la moyenne (${avg}) ${period}.` }
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
        title: 'Promo douteuse',
        text: `Le prix barré (${list}) n'a jamais été pratiqué en ${days(l.spanDays)} de suivi : le prix le plus haut relevé est ${formatMoney(l.highestSeenCents, props.currency)}.`,
      }
    case 'observed':
      return { tone: 'good', icon: '✓', title: 'Promo réelle', text: `Le produit a bien été vendu ${list} ou plus pendant le suivi.` }
    default:
      return {
        tone: 'neutral',
        icon: '?',
        title: 'Promo pas encore vérifiable',
        text: props.watched
          ? `Il faut ${LIST_PRICE_MIN_DAYS} jours de suivi pour savoir si le prix barré (${list}) a vraiment été pratiqué.`
          : `Suis le prix pendant ${LIST_PRICE_MIN_DAYS} jours pour savoir si le prix barré (${list}) a vraiment été pratiqué.`,
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
