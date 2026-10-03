<script setup lang="ts">
import type { Curation } from '~~/server/lib/curate'
import type { EbayItem } from '~~/server/lib/ebay'

const props = defineProps<{ query: string }>()

const CONDITIONS = [
  { value: '', label: 'Tout' },
  { value: 'new', label: 'Neuf' },
  { value: 'used', label: 'Occasion' },
] as const
const condition = ref<'' | 'new' | 'used'>('')
const sort = ref<'relevance' | 'price'>('relevance')

const params = computed(() => ({ q: props.query, condition: condition.value || undefined, sort: sort.value === 'price' ? 'price' : undefined }))

// Côté client seulement : la page et ses liens s'affichent tout de suite, les annonces arrivent ensuite
const { data, status, error } = useFetch('/api/search', { query: params, server: false, lazy: true })

const items = computed<EbayItem[]>(() => data.value?.items ?? [])

// Tri par l'IA : à la demande (chaque tri coûte), oublié dès que la recherche ou les filtres changent
const curation = ref<Curation | null>(null)
const curating = ref(false)
const curateError = ref('')
watch(params, () => {
  curation.value = null
  curateError.value = ''
})

async function curate() {
  curating.value = true
  curateError.value = ''
  try {
    curation.value = await $fetch<Curation>('/api/search/curate', { query: params.value })
  }
  catch (err) {
    curateError.value = errorMessage(err)
  }
  finally {
    curating.value = false
  }
}

const KIND_LABELS = { accessory: 'accessoire', for_parts: 'pour pièces', unrelated: 'autre produit' } as const
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

    <div v-if="data?.assistant && items.length" class="ai-bar">
      <button v-if="!curation" type="button" class="btn btn-ghost" :disabled="curating" @click="curate">
        <span v-if="curating" class="spinner spinner-sm" aria-hidden="true" />
        {{ curating ? 'Tri en cours…' : '✨ Trier avec l\'IA' }}
      </button>
      <template v-else>
        <span class="muted small">Triées par l'IA : regroupées par produit, accessoires et pièces écartés.</span>
        <button type="button" class="btn btn-ghost" @click="curation = null">
          Liste brute
        </button>
      </template>
    </div>
    <p v-if="curateError" class="alert" role="alert">
      {{ curateError }}
    </p>

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

    <template v-else-if="curation">
      <p v-if="!curation.groups.length && !curation.unsorted.length" class="muted">
        Aucune annonce ne correspond vraiment à la recherche : essaie des termes plus précis.
      </p>
      <div v-for="g in curation.groups" :key="g.label" class="ai-group">
        <h3 class="ai-group-title">
          {{ g.label }}
          <span class="muted small">{{ g.entries.length }} annonce{{ g.entries.length > 1 ? 's' : '' }} · dès {{ formatMoney(g.fromCents, g.entries[0]!.item.currency) }}</span>
        </h3>
        <ul class="product-list">
          <li v-for="e in g.entries" :key="e.item.id">
            <EbayItemRow :item="e.item" :units="e.units" :note="e.note" />
          </li>
        </ul>
      </div>
      <div v-if="curation.unsorted.length" class="ai-group">
        <h3 class="ai-group-title">
          Non classées
        </h3>
        <ul class="product-list">
          <li v-for="i in curation.unsorted" :key="i.id">
            <EbayItemRow :item="i" />
          </li>
        </ul>
      </div>
      <details v-if="curation.hidden.length" class="ai-hidden">
        <summary class="muted small">
          {{ curation.hidden.length }} annonce{{ curation.hidden.length > 1 ? 's' : '' }} écartée{{ curation.hidden.length > 1 ? 's' : '' }}
        </summary>
        <ul class="product-list">
          <li v-for="e in curation.hidden" :key="e.item.id">
            <EbayItemRow :item="e.item" :note="[KIND_LABELS[e.kind], e.note].filter(Boolean).join(' · ')" />
          </li>
        </ul>
      </details>
    </template>

    <ul v-else class="product-list">
      <li v-for="i in items" :key="i.id">
        <EbayItemRow :item="i" />
      </li>
    </ul>
  </section>
</template>
