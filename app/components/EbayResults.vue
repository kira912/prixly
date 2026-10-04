<script setup lang="ts">
import type { Curation } from '~~/server/lib/curate'
import type { EbayItem } from '~~/server/lib/ebay'

const props = defineProps<{ query: string }>()
const { t, locale } = useI18n()

const CONDITIONS = ['', 'new', 'used'] as const
const route = useRoute()
const conditionFromRoute = () => (route.query.condition === 'new' || route.query.condition === 'used' ? route.query.condition : '')
const condition = ref<'' | 'new' | 'used'>(conditionFromRoute())
watch(() => route.query.condition, () => { condition.value = conditionFromRoute() })
const sort = ref<'relevance' | 'price'>('relevance')

const params = computed(() => ({ q: props.query, condition: condition.value || undefined, sort: sort.value === 'price' ? 'price' : undefined }))

const { data, status, error } = useFetch('/api/search', { query: params, server: false, lazy: true, watch: [locale] })

const items = computed<EbayItem[]>(() => data.value?.items ?? [])

const curation = ref<Curation | null>(null)
const curating = ref(false)
const curateError = ref('')
watch([params, locale], () => {
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
</script>

<template>
  <section v-if="status === 'pending' || error || data?.configured" class="home-section" aria-live="polite">
    <div class="section-header">
      <h2>{{ t('ebay.title') }}</h2>
      <span v-if="data?.configured" class="muted small">{{ t('ebay.results', { n: formatNumber(data.total) }, data.total) }}</span>
    </div>

    <div class="result-controls">
      <div class="segmented" role="group" :aria-label="t('ebay.condition')">
        <button
          v-for="c in CONDITIONS"
          :key="c"
          type="button"
          :aria-pressed="condition === c"
          @click="condition = c"
        >
          {{ t(`ebay.${c || 'all'}`) }}
        </button>
      </div>
      <label class="small">
        <span class="sr-only">{{ t('ebay.sortBy') }}</span>
        <select v-model="sort" class="sort-select">
          <option value="relevance">{{ t('ebay.relevance') }}</option>
          <option value="price">{{ t('ebay.cheapest') }}</option>
        </select>
      </label>
    </div>

    <div v-if="data?.assistant && items.length" class="ai-bar">
      <button v-if="!curation" type="button" class="btn btn-ghost" :disabled="curating" @click="curate">
        <span v-if="curating" class="spinner spinner-sm" aria-hidden="true" />
        {{ curating ? t('ebay.aiSorting') : t('ebay.aiSort') }}
      </button>
      <template v-else>
        <span class="muted small">{{ t('ebay.aiSorted') }}</span>
        <button type="button" class="btn btn-ghost" @click="curation = null">
          {{ t('ebay.rawList') }}
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
      <span class="muted small">{{ t('ebay.searching') }}</span>
    </div>
    <p v-else-if="!items.length" class="muted">
      {{ t('ebay.none') }}
    </p>

    <template v-else-if="curation">
      <p v-if="!curation.groups.length && !curation.unsorted.length" class="muted">
        {{ t('ebay.noMatch') }}
      </p>
      <div v-for="g in curation.groups" :key="g.label" class="ai-group">
        <h3 class="ai-group-title">
          {{ g.label || t('ebay.otherListings') }}
          <span class="muted small">{{ t('ebay.listings', { n: g.entries.length }, g.entries.length) }} · {{ t('ebay.from', { price: formatMoney(g.fromCents, g.entries[0]!.item.currency) }) }}</span>
        </h3>
        <ul class="product-list">
          <li v-for="e in g.entries" :key="e.item.id">
            <EbayItemRow :item="e.item" :units="e.units" :note="e.note" />
          </li>
        </ul>
      </div>
      <div v-if="curation.unsorted.length" class="ai-group">
        <h3 class="ai-group-title">
          {{ t('ebay.unsorted') }}
        </h3>
        <ul class="product-list">
          <li v-for="i in curation.unsorted" :key="i.id">
            <EbayItemRow :item="i" />
          </li>
        </ul>
      </div>
      <details v-if="curation.hidden.length" class="ai-hidden">
        <summary class="muted small">
          {{ t('ebay.hidden', { n: curation.hidden.length }, curation.hidden.length) }}
        </summary>
        <ul class="product-list">
          <li v-for="e in curation.hidden" :key="e.item.id">
            <EbayItemRow :item="e.item" :note="[t(`ebay.kinds.${e.kind}`), e.note].filter(Boolean).join(' · ')" />
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
