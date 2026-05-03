import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Document, SortOption, SupportedSource, ChinaRxivPaper } from '@/types'
import { appConfig } from '@/config/app'
import { searchPapers as searchChinaRxiv, getPaperPdfUrl } from '@/utils/chinarxiv'
import { searchPapers as searchPubMed, fetchArticles as fetchPubMedArticles, getPubMedPdfUrl, type PubMedArticle } from '@/utils/pubmed'
import { searchPapers as searchArxiv, arxivToDocument } from '@/utils/arxiv'
import { searchPapers as searchBiorxiv, biorxivToDocument } from '@/utils/biorxiv'

// Convert ChinaRxiv paper to Document type
function chinaRxivToDocument(paper: ChinaRxivPaper): Document {
  return {
    id: paper.id,
    title: paper.title,
    abstract: paper.abstract || null,
    authors: paper.authors || null,
    keywords: paper.subjects || null,
    category: paper.subjects?.[0] || null,
    source: 'ChinaRxiv',
    source_id: paper.id,
    publish_date: paper.date || null,
    pdf_url: paper._links?.pdf || getPaperPdfUrl(paper.id),
    citation_count: 0,
    doi: null,
    metadata: {
      has_full_text: paper.has_full_text,
      has_figures: paper.has_figures,
      has_pdf: paper.has_pdf,
      source_language: paper.source_language,
      source_url: paper.source_url,
    },
    created_at: paper.date || new Date().toISOString(),
    updated_at: paper.date || new Date().toISOString(),
  }
}

// Convert PubMed article to Document type
function pubMedToDocument(article: PubMedArticle): Document {
  return {
    id: `pmid:${article.pmid}`,
    title: article.title,
    abstract: article.abstract || null,
    authors: article.authors.length > 0 ? article.authors : null,
    keywords: null,
    category: article.journal || null,
    source: 'PubMed',
    source_id: article.pmid,
    publish_date: article.pubDate || null,
    pdf_url: getPubMedPdfUrl(article.pmcId, article.doi),
    citation_count: 0,
    doi: article.doi,
    metadata: {
      journal: article.journal,
      pmc_id: article.pmcId,
      source_url: `https://pubmed.ncbi.nlm.nih.gov/${article.pmid}/`,
      has_pdf: !!article.pmcId,
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
}

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
  const selectedSource = ref<SupportedSource | null>('ChinaRxiv')
  const dateFrom = ref<string | null>(null)
  const dateTo = ref<string | null>(null)
  const error = ref<string | null>(null)

  // Cursor for ChinaRxiv pagination
  let nextCursor: string | null = null

  // Actions
  async function search(newQuery?: string, resetPage = true) {
    if (newQuery !== undefined) {
      query.value = newQuery
    }

    if (!query.value.trim()) return

    if (resetPage) {
      page.value = 1
      results.value = []
      nextCursor = null
    }

    isLoading.value = true
    error.value = null

    try {
      const source = selectedSource.value || 'ChinaRxiv'
      let documents: Document[] = []
      let resultTotal = 0

      if (source === 'ChinaRxiv') {
        const result = await searchChinaRxiv({
          q: query.value,
          subject: selectedCategory.value || undefined,
          fromDate: dateFrom.value || undefined,
          toDate: dateTo.value || undefined,
          limit: appConfig.searchPageSize,
          cursor: resetPage ? undefined : (nextCursor || undefined),
        })

        documents = result.data.map(chinaRxivToDocument)
        resultTotal = result.total
        nextCursor = result.next_cursor
        hasMore.value = result.next_cursor !== null
      } else if (source === 'PubMed') {
        const offset = (page.value - 1) * appConfig.searchPageSize

        const searchResult = await searchPubMed({
          q: query.value,
          fromDate: dateFrom.value || undefined,
          toDate: dateTo.value || undefined,
          retMax: appConfig.searchPageSize,
          retStart: offset,
        })

        resultTotal = searchResult.total

        if (searchResult.ids.length > 0) {
          const articles = await fetchPubMedArticles(searchResult.ids)
          documents = articles.map(pubMedToDocument)
        }

        hasMore.value = (offset + appConfig.searchPageSize) < resultTotal
      } else if (source === 'arXiv') {
        const offset = (page.value - 1) * appConfig.searchPageSize

        const searchResult = await searchArxiv({
          q: query.value,
          category: selectedCategory.value || undefined,
          fromDate: dateFrom.value || undefined,
          toDate: dateTo.value || undefined,
          retMax: appConfig.searchPageSize,
          retStart: offset,
        })

        documents = searchResult.articles.map(arxivToDocument)
        resultTotal = searchResult.total
        hasMore.value = (offset + appConfig.searchPageSize) < resultTotal
      } else if (source === 'bioRxiv' || source === 'medRxiv') {
        const server = source === 'medRxiv' ? 'medrxiv' : 'biorxiv'
        const cursor = resetPage ? 0 : (page.value - 1) * appConfig.searchPageSize

        const result = await searchBiorxiv(server, {
          q: query.value,
          category: selectedCategory.value || undefined,
          fromDate: dateFrom.value || undefined,
          toDate: dateTo.value || undefined,
          cursor,
          limit: appConfig.searchPageSize,
        })

        documents = result.collection.map((p) => biorxivToDocument(p, source))
        resultTotal = result.messages.total
        hasMore.value = (cursor + appConfig.searchPageSize) < result.messages.total
      } else {
        error.value = `${source} search is not yet available.`
        hasMore.value = false
      }

      total.value = resultTotal

      if (resetPage) {
        // Dedup initial results by id
        const seen = new Set<string>()
        results.value = documents.filter(d => {
          if (seen.has(d.id)) return false
          seen.add(d.id)
          return true
        })
      } else {
        // Dedup when appending (avoid duplicates from pagination)
        const existingIds = new Set(results.value.map(d => d.id))
        const newDocs = documents.filter(d => !existingIds.has(d.id))
        results.value.push(...newDocs)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Search failed'
      hasMore.value = false
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
    error,
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
