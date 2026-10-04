<script setup lang="ts">
import type { MarketplaceOffer, Product, Watch } from '~~/server/database/schema'
import type { ListPriceCheck, PriceInsight, PricePoint, PriceStats } from '~~/server/lib/history'

const { t } = useI18n()
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
  if (!follow.value && push.status.value === 'available') push.enable()
  return saveWatch(!follow.value)
}

const targetInput = ref('')
watch(follow, (w) => {
  targetInput.value = w?.targetPriceCents != null
    ? new Intl.NumberFormat(intlLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false }).format(w.targetPriceCents / 100)
    : ''
}, { immediate: true })
const targetInvalid = ref(false)
function saveTarget() {
  const raw = targetInput.value.trim()
  const cents = raw ? Math.round(Number.parseFloat(raw.replace(',', '.')) * 100) : null
  targetInvalid.value = cents != null && !(Number.isFinite(cents) && cents > 0)
  if (!targetInvalid.value) saveWatch(true, cents)
}

const shippingDetails = computed(() => {
  const p = product.value
  if (!p) return ''
  return [
    p.shippingNote,
    p.freeShippingOver ? t('product.freeShippingOver', { amount: p.freeShippingOver }) : null,
    p.shipsFrom ? t('product.shipsFrom', { country: countryName(p.shipsFrom) }) : null,
  ].filter(Boolean).join(' · ')
})

useHead(() => ({ title: product.value ? `${product.value.title} · Prixly` : 'Prixly' }))
</script>

<template>
  <section v-if="error" class="hero">
    <h1>{{ t('product.notFound') }}</h1>
    <NuxtLink to="/" class="btn btn-ghost">
      {{ t('common.back') }}
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
        ★ {{ formatNumber(product.rating) }}
        <template v-if="product.reviewCount">
          · {{ t('product.reviews', { n: formatNumber(product.reviewCount) }, product.reviewCount) }}
        </template>
      </p>

      <dl class="cost-table">
        <div>
          <dt>{{ t('product.price') }}</dt>
          <dd>
            <s v-if="product.listPriceCents" class="muted small list-price">{{ formatMoney(product.listPriceCents, product.currency) }}</s>
            {{ product.priceCents == null ? t('common.unavailable') : formatMoney(product.priceCents, product.currency) }}
          </dd>
        </div>
        <div>
          <dt>{{ t('product.shipping') }}</dt>
          <dd>
            {{ product.shippingCents === 0 ? t('common.free') : formatMoney(product.shippingCents, product.currency) }}
          </dd>
        </div>
        <div class="cost-total">
          <dt>{{ t('product.total') }}</dt>
          <dd>
            {{ formatMoney(total, product.currency) }}
            <PriceDelta v-if="stats" :stats="stats" :currency="product.currency" />
          </dd>
        </div>
        <div>
          <dt>{{ t('product.delay') }}</dt>
          <dd>
            {{ formatDelivery(product) }}
            <span v-if="product.deliveryText && product.deliveryMinDays != null" class="muted small">
              ({{ product.deliveryText }})
            </span>
          </dd>
        </div>
      </dl>
      <p v-if="shippingDetails" class="muted small">
        {{ shippingDetails }}
      </p>
      <PriceVerdict
        :insight="data?.insight ?? null"
        :list-price="data?.listPrice ?? null"
        :currency="product.currency"
        :watched="!!follow"
      />

      <div class="actions">
        <a :href="product.url" target="_blank" rel="noopener noreferrer" class="btn btn-primary">
          {{ t('product.viewOn', { platform: PLATFORM_LABELS[product.platform] }) }}
        </a>
        <button class="btn" :class="follow ? 'btn-tracked' : 'btn-ghost'" :aria-pressed="!!follow" :disabled="saving" @click="toggleWatch">
          {{ follow ? t('product.watching') : t('product.watch') }}
        </button>
        <button class="btn btn-ghost" :disabled="refreshing" @click="refreshPrice">
          {{ refreshing ? t('product.refreshing') : t('product.refresh') }}
        </button>
      </div>
      <p v-if="actionError" class="alert" role="alert">
        {{ actionError }}
      </p>

      <div v-if="follow" class="watch-panel">
        <form class="target-form" @submit.prevent="saveTarget">
          <label for="target">{{ t('product.notifyBelow') }}</label>
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
              {{ t('common.ok') }}
            </button>
          </div>
        </form>
        <p class="muted small">
          {{ t('product.alertInfo') }}
        </p>
        <ClientOnly>
          <PushStatus />
        </ClientOnly>
      </div>

      <p v-if="follow && product.lastError" class="alert" role="status" :title="product.lastError">
        {{ t('product.lastCheckFailed', { when: formatRelative(product.lastCheckedAt!) }) }}
      </p>
      <p class="muted small">
        {{ t('product.checked', { when: formatRelative(product.fetchedAt) }) }}
        <template v-if="follow">
          · {{ t('product.watchedSince', { date: formatDate(follow.createdAt, { dateStyle: 'short' }) }) }}
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
      <h2>{{ t('product.history') }}</h2>

      <template v-if="points.length > 1 && stats">
        <dl class="stat-row">
          <div>
            <dt>{{ t('product.current') }}</dt>
            <dd>{{ formatMoney(stats.currentCents, product.currency) }}</dd>
          </div>
          <div>
            <dt>{{ t('product.lowest') }}</dt>
            <dd>{{ formatMoney(stats.lowestCents, product.currency) }}</dd>
          </div>
          <div>
            <dt>{{ t('product.highest') }}</dt>
            <dd>{{ formatMoney(stats.highestCents, product.currency) }}</dd>
          </div>
        </dl>

        <PriceChart :points="points" :currency="product.currency" :end="product.lastCheckedAt ?? product.fetchedAt" />

        <details class="history-table">
          <summary>{{ t('product.seeChanges', { n: points.length }) }}</summary>
          <table>
            <thead>
              <tr>
                <th scope="col">
                  {{ t('product.since') }}
                </th>
                <th scope="col">
                  {{ t('product.price') }}
                </th>
                <th scope="col">
                  {{ t('product.shipping') }}
                </th>
                <th scope="col">
                  {{ t('product.total') }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in [...points].reverse()" :key="String(p.at)">
                <td>{{ formatDate(p.at, { dateStyle: 'short', timeStyle: 'short' }) }}</td>
                <td>{{ formatMoney(p.priceCents, product.currency) }}</td>
                <td>{{ p.shippingCents === 0 ? t('common.free') : formatMoney(p.shippingCents, product.currency) }}</td>
                <td><strong>{{ formatMoney(p.totalCents, product.currency) }}</strong></td>
              </tr>
            </tbody>
          </table>
        </details>
      </template>
      <p v-else class="muted small">
        {{ t('product.noVariation') }}
        {{ follow ? t('product.autoChecked') : t('product.watchToTrack') }}
      </p>
    </section>
  </article>
</template>
