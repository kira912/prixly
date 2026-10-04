<script setup lang="ts">
import type { MarketplaceOffer, Product } from '~~/server/database/schema'
import { AMAZON_MARKETPLACES, marketplaceOf } from '~~/server/lib/marketplaces'

const props = defineProps<{ product: Product, offers: MarketplaceOffer[] }>()
const emit = defineEmits<{ updated: [] }>()
const { t } = useI18n()

const loading = ref(false)
const error = ref<string | null>(null)

async function compare() {
  loading.value = true
  error.value = null
  try {
    await $fetch(`/api/products/${props.product.id}/compare`, { method: 'POST' })
    emit('updated')
  }
  catch (err) {
    error.value = errorMessage(err)
  }
  finally {
    loading.value = false
  }
}

const rows = computed(() => {
  const own = marketplaceOf(props.product.url)
  const all = [
    ...(own
      ? [{ marketplace: own, url: props.product.url, status: props.product.priceCents == null ? 'unavailable' : 'ok', priceCents: props.product.priceCents, currency: props.product.currency, error: null, own: true }]
      : []),
    ...props.offers.map(o => ({ ...o, own: false })),
  ] as Array<Pick<MarketplaceOffer, 'marketplace' | 'url' | 'status' | 'priceCents' | 'currency' | 'error'> & { own: boolean }>

  const base = props.product.priceCents
  const priced = all.filter(r => r.priceCents != null && r.currency === props.product.currency)
  const cheapest = priced.length > 1 ? Math.min(...priced.map(r => r.priceCents!)) : null
  return all
    .map((r) => {
      const m = AMAZON_MARKETPLACES.find(m => m.code === r.marketplace)
      const comparable = r.priceCents != null && base != null && r.currency === props.product.currency && !r.own
      return {
        ...r,
        flag: m?.flag ?? '',
        domain: m?.host.replace(/^www\./, '') ?? r.marketplace,
        diffCents: comparable ? r.priceCents! - base! : null,
        cheapest: cheapest != null && r.priceCents === cheapest,
      }
    })
    .sort((a, b) => (a.priceCents ?? Infinity) - (b.priceCents ?? Infinity))
})

const fetchedAt = computed(() => props.offers[0]?.fetchedAt ?? null)
</script>

<template>
  <section class="offers">
    <div class="section-header">
      <h2>{{ t('offers.title') }}</h2>
      <button class="btn btn-ghost" :disabled="loading" @click="compare">
        {{ loading ? t('offers.comparing') : offers.length ? t('offers.update') : t('offers.compare') }}
      </button>
    </div>

    <p v-if="!offers.length && !loading" class="muted small">
      {{ t('offers.intro') }}
    </p>
    <div v-if="loading && !offers.length" class="loading-state" aria-live="polite">
      <div class="spinner" />
      <p class="muted small">
        {{ t('offers.checking') }}
      </p>
    </div>

    <template v-if="offers.length">
      <table class="offers-table">
        <thead>
          <tr>
            <th scope="col">
              {{ t('offers.country') }}
            </th>
            <th scope="col">
              {{ t('offers.price') }}
            </th>
            <th scope="col">
              <span class="sr-only">{{ t('offers.diff') }}</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.marketplace" :data-cheapest="r.cheapest || undefined">
            <td>
              <a :href="r.url" target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">{{ r.flag }}</span> {{ r.domain }}
              </a>
              <span v-if="r.own" class="muted small"> · {{ t('offers.thisProduct') }}</span>
            </td>
            <td>
              <template v-if="r.status === 'ok'">
                <strong>{{ formatMoney(r.priceCents, r.currency ?? product.currency) }}</strong>
                <span v-if="r.cheapest" class="cheapest-tag">{{ t('offers.cheapest') }}</span>
              </template>
              <span v-else class="muted small" :title="r.error ?? undefined">{{ t(`offers.status.${r.status}`) }}</span>
            </td>
            <td class="offer-diff">
              <span v-if="r.diffCents != null && r.diffCents !== 0" class="delta" :data-trend="r.diffCents < 0 ? 'down' : 'up'">
                {{ r.diffCents < 0 ? '−' : '+' }}{{ formatMoney(Math.abs(r.diffCents), product.currency) }}
              </span>
              <span v-else-if="r.diffCents === 0" class="muted small">{{ t('offers.samePrice') }}</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted small">
        {{ t('offers.footnote', { when: fetchedAt ? formatRelative(fetchedAt) : '' }) }}
      </p>
    </template>

    <p v-if="error" class="alert" role="alert">
      {{ error }}
    </p>
  </section>
</template>
