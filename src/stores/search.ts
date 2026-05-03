import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/utils/supabase'
import type { Document, SortOption, SupportedSource } from '@/types'
import { appConfig } from '@/config/app'

export const useSearchStore = defineStore('search', () => {
  // State
  const query = ref('')
  const results = ref<Document[]>([])
  const total = ref(0)
  const page = ref(1)
  const isLoading = ref(false)
  const hasMore = ref(false)
  const sortBy = ref<SortOption>('relevance')
  const selectedCategory = ref<string | null>(null)
  const selectedSource = ref<SupportedSource | null>(null)
  const dateFrom = ref<string | null>(null)
  const dateTo = ref<string | null>(null)

  // Actions
  async function search(newQuery?: string, resetPage = true) {
    if (newQuery !== undefined) {
      query.value = newQuery
    }

    if (!query.value.trim()) return

    if (resetPage) {
      page.value = 1
      results.value = []
    }

    isLoading.value = true
    try {
      const offset = (page.value - 1) * appConfig.searchPageSize

      const { data, error } = await supabase.rpc('search_documents', {
        search_query: query.value,
        p_category: selectedCategory.value,
        p_source: selectedSource.value,
        p_date_from: dateFrom.value,
        p_date_to: dateTo.value,
        p_sort_by: sortBy.value,
        p_limit: appConfig.searchPageSize,
        p_offset: offset,
      })

      if (error) throw error

      const documents = (data || []) as Document[]

      if (resetPage) {
        results.value = documents
      } else {
        results.value.push(...documents)
      }

      hasMore.value = documents.length === appConfig.searchPageSize
    } finally {
      isLoading.value = false
    }
  }

  async function loadMore() {
    if (!hasMore.value || isLoading.value) return
    page.value++
    await search(undefined, false)
  }

  function resetFilters() {
    selectedCategory.value = null
    selectedSource.value = null
    dateFrom.value = null
    dateTo.value = null
    sortBy.value = 'relevance'
  }

  return {
    query,
    results,
    total,
    page,
    isLoading,
    hasMore,
    sortBy,
    selectedCategory,
    selectedSource,
    dateFrom,
    dateTo,
    search,
    loadMore,
    resetFilters,
  }
})
