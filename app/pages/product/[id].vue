<script setup lang="ts">
import type { MarketplaceOffer, Product, Watch } from '~~/server/database/schema'
import type { ListPriceCheck, PriceInsight, PricePoint, PriceStats } from '~~/server/lib/history'

const route = useRoute()
const { data, error, refresh: reload } = await useFetch<{ product: Product, points: PricePoint[], stats: PriceStats, insight: PriceInsight | null, listPrice: ListPriceCheck | null, watch: Watch | null, offers: MarketplaceOffer[] }>(
  () => `/api/products/${route.params.id}`,
)

const product = computed(() => data.value?.product)
const total = computed(() => (product.value ? totalCents(product.value) : null))
const points = computed(() => data.value?.points ?? [])
const stats = computed(() => data.value?.stats)
const follow = computed(() => data.value?.watch ?? null)
const push = usePush()

const refreshing = ref(false)
const actionError = ref<string | null>(null)
async function refreshPrice() {
  refreshing.value = true
  actionError.value = null
  try {
    await $fetch(`/api/products/${route.params.id}/refresh`, { method: 'POST' })
    await reload()
  }
  catch (err) {
    actionError.value = errorMessage(err)
  }
  finally {
    refreshing.value = false
  }
}

const saving = ref(false)
async function saveWatch(watching: boolean, targetPriceCents: number | null = follow.value?.targetPriceCents ?? null) {
  saving.value = true
  actionError.value = null
  try {
    await $fetch(`/api/products/${route.params.id}/watch`, { method: 'PUT', body: { watching, targetPriceCents } })
    await reload()
  }
  catch (err) {
    actionError.value = errorMessage(err)
  }
  finally {
    saving.value = false
  }
}

function toggleWatch() {
  // La demande de permission part tout de suite, dans le geste de clic, en parallèle de l'enregistrement du suivi
  if (!follow.value && push.status.value === 'available') push.enable()
  return saveWatch(!follow.value)
}

// Prix cible saisi en euros (« 3,50 »), stocké en centimes
const targetInput = ref('')
watch(follow, (w) => {
  targetInput.value = w?.targetPriceCents != null ? (w.targetPriceCents / 100).toFixed(2).replace('.', ',') : ''
}, { immediate: true })
const targetInvalid = ref(false)
function saveTarget() {
  const raw = targetInput.value.trim()
  const cents = raw ? Math.round(Number.parseFloat(raw.replace(',', '.')) * 100) : null
  targetInvalid.value = cents != null && !(Number.isFinite(cents) && cents > 0)
  if (!targetInvalid.value) saveWatch(true, cents)
}

useHead(() => ({ title: product.value ? `${product.value.title} · Prixly` : 'Prixly' }))
</script>

<template>
  <section v-if="error" class="hero">
    <h1>Produit introuvable</h1>
    <NuxtLink to="/" class="btn btn-ghost">
      Retour
    </NuxtLink>
  </section>

  <article v-else-if="product" class="product">
    <div class="product-media">
      <img v-if="product.image" :src="product.image" :alt="product.title" referrerpolicy="no-referrer">
    </div>

    <div class="product-info">
      <span class="badge" :data-platform="product.platform">{{ PLATFORM_LABELS[product.platform] }}</span>
      <h1 class="product-title">
        {{ product.title }}
      </h1>
      <p v-if="product.rating" class="muted small">
        ★ {{ product.rating.toLocaleString('fr-FR') }}
        <template v-if="product.reviewCount">
          · {{ product.reviewCount.toLocaleString('fr-FR') }} avis
        </template>
      </p>

      <dl class="cost-table">
        <div>
          <dt>Prix</dt>
          <dd>
            <s v-if="product.listPriceCents" class="muted small list-price">{{ formatMoney(product.listPriceCents, product.currency) }}</s>
            {{ product.priceCents == null ? 'Indisponible' : formatMoney(product.priceCents, product.currency) }}
          </dd>
        </div>
        <div>
          <dt>Livraison</dt>
          <dd>
            {{ product.shippingCents === 0 ? 'Gratuite' : formatMoney(product.shippingCents, product.currency) }}
          </dd>
        </div>
        <div class="cost-total">
          <dt>Total</dt>
          <dd>
            {{ formatMoney(total, product.currency) }}
            <PriceDelta v-if="stats" :stats="stats" :currency="product.currency" />
          </dd>
        </div>
        <div>
          <dt>Délai</dt>
          <dd>
            {{ formatDelivery(product) }}
            <span v-if="product.deliveryText && product.deliveryMinDays != null" class="muted small">
              ({{ product.deliveryText }})
            </span>
          </dd>
        </div>
      </dl>
      <p v-if="product.shippingNote" class="muted small">
        {{ product.shippingNote }}
      </p>
      <PriceVerdict
        :insight="data?.insight ?? null"
        :list-price="data?.listPrice ?? null"
        :currency="product.currency"
        :watched="!!follow"
      />

      <div class="actions">
        <a :href="product.url" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          Voir sur {{ PLATFORM_LABELS[product.platform] }}
        </a>
        <button class="btn" :class="follow ? 'btn-tracked' : 'btn-ghost'" :aria-pressed="!!follow" :disabled="saving" @click="toggleWatch">
          {{ follow ? '✓ Prix suivi' : 'Suivre le prix' }}
        </button>
        <button class="btn btn-ghost" :disabled="refreshing" @click="refreshPrice">
          {{ refreshing ? 'Mise à jour…' : 'Actualiser' }}
        </button>
      </div>
      <p v-if="actionError" class="alert" role="alert">
        {{ actionError }}
      </p>

      <div v-if="follow" class="watch-panel">
        <form class="target-form" @submit.prevent="saveTarget">
          <label for="target">Me prévenir si le total passe sous</label>
          <div class="target-input">
            <input
              id="target"
              v-model="targetInput"
              inputmode="decimal"
              placeholder="—"
              :aria-invalid="targetInvalid"
              autocomplete="off"
            >
            <span aria-hidden="true">€</span>
            <button class="btn btn-ghost" type="submit" :disabled="saving">
              OK
            </button>
          </div>
        </form>
        <p class="muted small">
          Tu recevras aussi une alerte à chaque baisse d'au moins 5 % (ou 0,50 €) et à chaque nouveau prix le plus bas.
        </p>
        <ClientOnly>
          <PushStatus />
        </ClientOnly>
      </div>

      <p v-if="follow && product.lastError" class="alert" role="status">
        Dernier relevé automatique en échec ({{ formatRelative(product.lastCheckedAt!) }}) : {{ product.lastError }}
      </p>
      <p class="muted small">
        Relevé {{ formatRelative(product.fetchedAt) }}
        <template v-if="follow">
          · suivi depuis le {{ new Date(follow.createdAt).toLocaleDateString('fr-FR') }}, relevé automatique toutes les 6 h
        </template>
      </p>
    </div>

    <MarketplaceOffers
      v-if="product.platform === 'amazon'"
      :product="product"
      :offers="data?.offers ?? []"
      @updated="reload"
    />

    <section class="history">
      <h2>Évolution du prix total</h2>

      <template v-if="points.length > 1 && stats">
        <dl class="stat-row">
          <div>
            <dt>Actuel</dt>
            <dd>{{ formatMoney(stats.currentCents, product.currency) }}</dd>
          </div>
          <div>
            <dt>Plus bas</dt>
            <dd>{{ formatMoney(stats.lowestCents, product.currency) }}</dd>
          </div>
          <div>
            <dt>Plus haut</dt>
            <dd>{{ formatMoney(stats.highestCents, product.currency) }}</dd>
          </div>
        </dl>

        <PriceChart :points="points" :currency="product.currency" :end="product.lastCheckedAt ?? product.fetchedAt" />

        <details class="history-table">
          <summary>Voir les {{ points.length }} changements</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  Depuis le
                </th>
                <th scope="col">
                  Prix
                </th>
                <th scope="col">
                  Livraison
                </th>
                <th scope="col">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in [...points].reverse()" :key="String(p.at)">
                <td>{{ new Date(p.at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) }}</td>
                <td>{{ formatMoney(p.priceCents, product.currency) }}</td>
                <td>{{ p.shippingCents === 0 ? 'Gratuite' : formatMoney(p.shippingCents, product.currency) }}</td>
                <td><strong>{{ formatMoney(p.totalCents, product.currency) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </details>
      </template>
      <p v-else class="muted small">
        Pas encore de variation de prix.
        {{ follow ? 'Le prix est relevé automatiquement toutes les 6 h.' : 'Suis ce produit pour relever son prix automatiquement et être prévenu des baisses.' }}
      </p>
    </section>
  </article>
</template>
