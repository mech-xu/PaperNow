// arXiv API Client
// Docs: https://info.arxiv.org/help/api/index.html
// Rate limits: 1 request per 3 seconds (polite)

import type { Document } from '@/types'

const BASE_URL = 'https://export.arxiv.org/api/query'
const PROXY_URL = 'https://api.papernow.sunnynow.net/v1/proxy'

export interface ArXivArticle {
  id: string          // e.g. "2301.00001"
  title: string
  authors: string[]
  abstract: string
  categories: string[]
  primaryCategory: string
  published: string
  updated: string
  doi: string | null
  pdfUrl: string      // always available on arXiv
  absUrl: string
}

export interface ArXivSearchResult {
  articles: ArXivArticle[]
  total: number
  startIndex: number
}

/**
 * Search arXiv papers
 */
export async function searchPapers(
  params: {
    q: string
    category?: string       // e.g. "cs.AI", "physics:hep-th"
    fromDate?: string       // YYYY-MM-DD
    toDate?: string
    retMax?: number         // max 2000, default 10
    retStart?: number       // offset
  },
): Promise<ArXivSearchResult> {
  // Build search query
  let query = `all:${params.q}`
  if (params.category) {
    query = `cat:${params.category} AND ${query}`
  }

  // Build URL - use + for spaces (arXiv convention)
  const searchQuery = query.replace(/ /g, '+')
  const urlStr = `${BASE_URL}?search_query=${searchQuery}&start=${params.retStart || 0}&max_results=${params.retMax || 20}&sortBy=relevance&sortOrder=descending`

  // Use API proxy to bypass CORS
  const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(urlStr)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error(`arXiv API error: ${res.status}`)

  const xml = await res.text()
  return parseArXivResponse(xml)
}

function parseArXivResponse(xml: string): ArXivSearchResult {
  const parser = new DOMParser()
  const doc = parser.parseFromString(xml, 'text/xml')

  const totalEl = doc.querySelector('opensearch\\:totalResults, totalResults')
  const startIndexEl = doc.querySelector('opensearch\\:startIndex, startIndex')
  const total = parseInt(totalEl?.textContent || '0', 10)
  const startIndex = parseInt(startIndexEl?.textContent || '0', 10)

  const entries = doc.querySelectorAll('entry')
  const articles: ArXivArticle[] = []

  entries.forEach((entry) => {
    const idEl = entry.querySelector('id')
    const titleEl = entry.querySelector('title')
    const summaryEl = entry.querySelector('summary')
    const publishedEl = entry.querySelector('published')
    const doiEl = entry.querySelector('arxiv\\:doi, doi')

    // Extract arXiv ID from the URL: http://arxiv.org/abs/2301.00001v1 -> 2301.00001
    const fullId = idEl?.textContent?.trim() || ''
    const idMatch = fullId.match(/\/abs\/(.+?)(v\d+)?$/)
    const arxivId = idMatch ? idMatch[1] : fullId.split('/').pop() || ''

    const authors: string[] = []
    entry.querySelectorAll('author > name').forEach((nameEl) => {
      const name = nameEl.textContent?.trim()
      if (name) authors.push(name)
    })

    const categories: string[] = []
    entry.querySelectorAll('category').forEach((catEl) => {
      const term = catEl.getAttribute('term')
      if (term) categories.push(term)
    })

    const primaryCatEl = entry.querySelector('arxiv\\:primary_category, primary_category')
    const primaryCategory = primaryCatEl?.getAttribute('term') || categories[0] || ''

    // PDF URL - arXiv always has PDF
    const pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`
    const absUrl = `https://arxiv.org/abs/${arxivId}`

    articles.push({
      id: arxivId,
      title: titleEl?.textContent?.trim().replace(/\s+/g, ' ') || '',
      authors,
      abstract: summaryEl?.textContent?.trim().replace(/\s+/g, ' ') || '',
      categories,
      primaryCategory,
      published: publishedEl?.textContent?.trim() || '',
      updated: '',
      doi: doiEl?.textContent?.trim() || null,
      pdfUrl,
      absUrl,
    })
  })

  return { articles, total, startIndex }
}

/**
 * Convert arXiv article to Document type
 */
export function arxivToDocument(article: ArXivArticle): Document {
  return {
    id: `arxiv:${article.id}`,
    title: article.title,
    abstract: article.abstract || null,
    authors: article.authors.length > 0 ? article.authors : null,
    keywords: article.categories.length > 0 ? article.categories : null,
    category: article.primaryCategory || null,
    source: 'arXiv',
    source_id: article.id,
    publish_date: article.published ? article.published.split('T')[0] : null,
    pdf_url: article.pdfUrl,
    citation_count: 0,
    doi: article.doi,
    metadata: {
      has_pdf: true,
      source_url: article.absUrl,
      primary_category: article.primaryCategory,
    },
    created_at: article.published || new Date().toISOString(),
    updated_at: article.published || new Date().toISOString(),
  }
}
