import type { Product } from '~~/server/database/schema'

/** Envoie un lien au serveur puis ouvre la fiche produit. */
export function useLookup() {
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function lookup(input: string, { replace = false } = {}) {
    loading.value = true
    error.value = null
    try {
      const { product } = await $fetch<{ product: Product }>('/api/products', { method: 'POST', body: { input } })
      await navigateTo(`/product/${product.id}`, { replace })
    }
    catch (err) {
      error.value = errorMessage(err)
    }
    finally {
      loading.value = false
    }
  }

  return { loading, error, lookup }
}
