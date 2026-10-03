<script setup lang="ts">
import { SEARCH_KIND_LABELS, searchLinks, type SearchKind } from '~/utils/search'

// Recherche multi-plateformes : liens vers la recherche de chaque site, rien n'est scrapé.
// La requête vit dans l'URL (?q=…) : partageable, et le bouton retour la retrouve.
const route = useRoute()
const query = computed(() => (typeof route.query.q === 'string' ? route.query.q.trim() : ''))
const input = ref(query.value)
watch(query, (q) => { input.value = q })

const KINDS: SearchKind[] = ['new', 'used']
const groups = computed(() => KINDS.map(kind => ({ kind, label: SEARCH_KIND_LABELS[kind], links: searchLinks(query.value, kind) })))

// Recherches récentes : confort propre à l'appareil, l'appli marche sans
const RECENT_KEY = 'prixly:recent-searches'
const recent = ref<string[]>([])
onMounted(() => {
  try {
    recent.value = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]')
  }
  catch {}
  remember(query.value)
})
watch(query, remember)
function remember(q: string) {
  if (!q) return
  recent.value = [q, ...recent.value.filter(r => r.toLowerCase() !== q.toLowerCase())].slice(0, 6)
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value))
  }
  catch {}
}

function submit() {
  const q = input.value.trim()
  if (!q) return
  // Un lien collé ici part vers l'analyse produit habituelle
  if (looksLikeLink(q)) return navigateTo({ path: '/share', query: { text: q } })
  navigateTo({ query: { q } })
}

useHead(() => ({ title: query.value ? `${query.value} · Recherche · Prixly` : 'Rechercher · Prixly' }))
</script>

<template>
  <section class="hero">
    <h1>Où le trouver ?</h1>
    <p class="lead">
      Cherche un produit sur toutes les plateformes, neuf ou d'occasion, en une seule saisie.
    </p>
    <form class="search-form" role="search" @submit.prevent="submit">
      <label for="q" class="sr-only">Produit recherché</label>
      <input
        id="q"
        v-model="input"
        type="search"
        enterkeyhint="search"
        placeholder="Ex. machine à pain Moulinex"
        autocomplete="off"
      >
      <button type="submit" class="btn btn-primary" :disabled="!input.trim()">
        Rechercher
      </button>
    </form>
    <ClientOnly>
      <p v-if="!query && recent.length" class="recent-searches small">
        <span class="muted">Récemment :</span>
        <NuxtLink v-for="r in recent" :key="r" :to="{ query: { q: r } }" class="chip">
          {{ r }}
        </NuxtLink>
      </p>
    </ClientOnly>
  </section>

  <template v-if="query">
    <EbayResults :query="query" />

    <section v-for="g in groups" :key="g.kind" class="home-section">
      <h2>Chercher ailleurs · {{ g.label }}</h2>
      <ul class="search-links">
        <li v-for="l in g.links" :key="l.id">
          <a :href="l.href" target="_blank" rel="noopener noreferrer" class="search-link">
            <span class="search-link-name">{{ l.name }}</span>
            <span v-if="l.hint" class="muted small">{{ l.hint }}</span>
            <span v-if="l.supported" class="supported-tag small">suivi Prixly</span>
            <span class="search-link-arrow" aria-hidden="true">↗</span>
          </a>
        </li>
      </ul>
    </section>

    <aside class="callout home-section">
      <h2>Trouvé ?</h2>
      <p class="muted small">
        Pour un produit Amazon ou AliExpress (marqués « suivi Prixly »), partage-le à Prixly
        ou colle son lien sur l'accueil : coût total avec le port, avis sur le prix, suivi et alertes de baisse.
      </p>
    </aside>
  </template>
</template>
