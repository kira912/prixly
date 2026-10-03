<script setup lang="ts">
import type { EbayItem } from '~~/server/lib/ebay'

const props = defineProps<{ query: string }>()

const CONDITIONS = [
  { value: '', label: 'Tout' },
  { value: 'new', label: 'Neuf' },
  { value: 'used', label: 'Occasion' },
] as const
const condition = ref<'' | 'new' | 'used'>('')
const sort = ref<'relevance' | 'price'>('relevance')

// Côté client seulement : la page et ses liens s'affichent tout de suite, les annonces arrivent ensuite
const { data, status, error } = useFetch('/api/search', {
  query: computed(() => ({ q: props.query, condition: condition.value || undefined, sort: sort.value === 'price' ? 'price' : undefined })),
  server: false,
  lazy: true,
})

const items = computed<EbayItem[]>(() => data.value?.items ?? [])

function total(i: EbayItem): string {
  return formatMoney(i.priceCents + (i.shippingCents ?? 0), i.currency)
}

function shippingLabel(i: EbayItem): string {
  if (i.shippingCents == null) return 'port à vérifier'
  if (i.shippingCents === 0) return 'port offert'
  return `port ${formatMoney(i.shippingCents, i.currency)}`
}

function endsIn(date: string): string {
  const hours = (new Date(date).getTime() - Date.now()) / 3_600_000
  if (hours < 1) return 'se termine bientôt'
  if (hours < 48) return `encore ${Math.round(hours)} h`
  return `encore ${Math.round(hours / 24)} j`
}
</script>

<template>
  <!-- Rien tant que la réponse n'est pas là, ni si les clés eBay ne sont pas configurées -->
  <section v-if="status === 'pending' || error || data?.configured" class="home-section" aria-live="polite">
    <div class="section-header">
      <h2>Annonces eBay</h2>
      <span v-if="data?.configured" class="muted small">{{ data.total.toLocaleString('fr-FR') }} résultats</span>
    </div>

    <div class="result-controls">
      <div class="segmented" role="group" aria-label="État">
        <button
          v-for="c in CONDITIONS"
          :key="c.value"
          type="button"
          :aria-pressed="condition === c.value"
          @click="condition = c.value"
        >
          {{ c.label }}
        </button>
      </div>
      <label class="small">
        <span class="sr-only">Trier par</span>
        <select v-model="sort" class="sort-select">
          <option value="relevance">Pertinence</option>
          <option value="price">Moins cher (port compris)</option>
        </select>
      </label>
    </div>

    <p v-if="error" class="alert" role="alert">
      {{ errorMessage(error) }}
    </p>
    <div v-else-if="status === 'pending'" class="loading-state">
      <div class="spinner" aria-hidden="true" />
      <span class="muted small">Recherche sur eBay…</span>
    </div>
    <p v-else-if="!items.length" class="muted">
      Aucune annonce eBay livrable en France pour cette recherche.
    </p>
    <ul v-else class="product-list">
      <li v-for="i in items" :key="i.id">
        <a :href="i.url" target="_blank" rel="noopener noreferrer" class="product-row">
          <img v-if="i.image" :src="i.image" alt="" loading="lazy" referrerpolicy="no-referrer">
          <div v-else class="img-placeholder" />
          <div class="product-row-body">
            <span class="product-row-title" :title="i.title">{{ i.title }}</span>
            <span class="muted small">
              <span v-if="i.condition" class="badge" :data-condition="i.isNew ? 'new' : 'used'">{{ i.condition }}</span>
              <template v-if="i.auction"> Enchère<template v-if="i.endsAt"> · {{ endsIn(i.endsAt) }}</template></template>
              <template v-if="i.country && i.country !== 'FR'"> · expédié de {{ i.country }}</template>
            </span>
          </div>
          <div class="product-row-price">
            <strong>{{ total(i) }}</strong>
            <span class="muted small">{{ shippingLabel(i) }}</span>
          </div>
        </a>
      </li>
    </ul>
  </section>
</template>
