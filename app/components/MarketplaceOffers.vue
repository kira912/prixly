<script setup lang="ts">
import type { MarketplaceOffer, Product } from '~~/server/database/schema'
import { AMAZON_MARKETPLACES, marketplaceOf } from '~~/server/lib/marketplaces'

// Prix du même produit sur les autres Amazon européens ; comparaison sur le prix de l'article seul :
// Amazon calcule port et délai d'après la localisation du serveur (IP), pas celle de l'utilisateur
const props = defineProps<{ product: Product, offers: MarketplaceOffer[] }>()
const emit = defineEmits<{ updated: [] }>()

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

const STATUS_LABELS: Record<MarketplaceOffer['status'], string> = {
  ok: '',
  unavailable: 'Indisponible',
  not_found: 'Non vendu',
  error: 'Échec du relevé',
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
        country: m?.country ?? r.marketplace,
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
      <h2>Prix sur les autres Amazon</h2>
      <button class="btn btn-ghost" :disabled="loading" @click="compare">
        {{ loading ? 'Comparaison…' : offers.length ? 'Mettre à jour' : 'Comparer' }}
      </button>
    </div>

    <p v-if="!offers.length && !loading" class="muted small">
      Compare le prix de ce produit sur Amazon Allemagne, Espagne, Italie, Pays-Bas et Belgique.
    </p>
    <div v-if="loading && !offers.length" class="loading-state" aria-live="polite">
      <div class="spinner" />
      <p class="muted small">
        Relevé des 5 pays…
      </p>
    </div>

    <template v-if="offers.length">
      <table class="offers-table">
        <thead>
          <tr>
            <th scope="col">
              Pays
            </th>
            <th scope="col">
              Prix
            </th>
            <th scope="col">
              <span class="sr-only">Écart avec le prix actuel</span>
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="r in rows" :key="r.marketplace" :data-cheapest="r.cheapest || undefined">
            <td>
              <a :href="r.url" target="_blank" rel="noopener noreferrer">
                <span aria-hidden="true">{{ r.flag }}</span> {{ r.domain }}
              </a>
              <span v-if="r.own" class="muted small"> · ce produit</span>
            </td>
            <td>
              <template v-if="r.status === 'ok'">
                <strong>{{ formatMoney(r.priceCents, r.currency ?? product.currency) }}</strong>
                <span v-if="r.cheapest" class="cheapest-tag">le moins cher</span>
              </template>
              <span v-else class="muted small" :title="r.error ?? undefined">{{ STATUS_LABELS[r.status] }}</span>
            </td>
            <td class="offer-diff">
              <span v-if="r.diffCents != null && r.diffCents !== 0" class="delta" :data-trend="r.diffCents < 0 ? 'down' : 'up'">
                {{ r.diffCents < 0 ? '−' : '+' }}{{ formatMoney(Math.abs(r.diffCents), product.currency) }}
              </span>
              <span v-else-if="r.diffCents === 0" class="muted small">même prix</span>
            </td>
          </tr>
        </tbody>
      </table>
      <p class="muted small">
        Prix de l'article seul, relevé {{ fetchedAt ? formatRelative(fetchedAt) : '' }}. Frais de port vers la France et délai à vérifier sur chaque site ; la TVA est ajustée au taux français au paiement.
      </p>
    </template>

    <p v-if="error" class="alert" role="alert">
      {{ error }}
    </p>
  </section>
</template>
