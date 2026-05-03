// bioRxiv / medRxiv API Client
// Docs: https://api.biorxiv.org/
// Both bioRxiv and medRxiv share the same API structure
// Rate limits: No official limit, be polite

import type { Document, SupportedSource } from '@/types'

const API_BASE = 'https://api.biorxiv.org'
const PROXY_URL = 'https://api.papernow.sunnynow.net/v1/proxy'

export interface BiorxivPaper {
  doi: string
  title: string
  authors: string
  author_corresponding: string
  author_corresponding_institution: string
  date: string           // YYYY-MM-DD
  version: string
  type: string           // "new_results" | "confirmed_results" etc
  category: string
  jatsxml: string        // URL to JATS XML
  abstract: string       // from detail endpoint
}

export interface BiorxivSearchResult {
  messages: {
    status: string
    interval: string
    cursor: number
    count: number
    total: number
  }
  collection: BiorxivPaper[]
}

/**
 * Search bioRxiv or medRxiv papers
 */
export async function searchPapers(
  server: 'biorxiv' | 'medrxiv',
  params: {
    q?: string
    category?: string
    fromDate?: string     // YYYY-MM-DD
    toDate?: string       // YYYY-MM-DD
    cursor?: number       // offset for pagination
    limit?: number        // default 100, max 100
  },
): Promise<BiorxivSearchResult> {
  // bioRxiv/medRxiv API: /details/{server}/{interval}/{cursor}
  // interval format: {from_date}-{to_date} or {doi}
  const interval = params.fromDate && params.toDate
    ? `${params.fromDate}-${params.toDate}`
    : params.fromDate
      ? `${params.fromDate}-2099-12-31`
      : '2013-11-01-2099-12-31'  // bioRxiv started Nov 2013

  const cursor = params.cursor || 0
  const url = `${API_BASE}/details/${server}/${interval}/${cursor}`

  // Use API proxy to bypass CORS
  const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error(`${server} API error: ${res.status}`)

  const data: BiorxivSearchResult = await res.json()

  // Client-side text filtering if query provided (API doesn't support full-text search)
  if (params.q) {
    const q = params.q.toLowerCase()
    data.collection = data.collection.filter((paper) => {
      return paper.title.toLowerCase().includes(q)
        || paper.authors.toLowerCase().includes(q)
    })
    data.messages.count = data.collection.length
  }

  // Category filter
  if (params.category) {
    data.collection = data.collection.filter((paper) =>
      paper.category === params.category,
    )
    data.messages.count = data.collection.length
  }

  // Limit results
  if (params.limit && data.collection.length > params.limit) {
    data.collection = data.collection.slice(0, params.limit)
  }

  return data
}

/**
 * Get paper detail (includes abstract)
 */
export async function getPaperDetail(
  server: 'biorxiv' | 'medrxiv',
  doi: string,
): Promise<BiorxivPaper | null> {
  const url = `${API_BASE}/details/${server}/${doi}`
  const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) return null

  const data: BiorxivSearchResult = await res.json()
  return data.collection[0] || null
}

/**
 * Convert bioRxiv/medRxiv paper to Document type
 */
export function biorxivToDocument(
  paper: BiorxivPaper,
  source: SupportedSource,
): Document {
  const server = source === 'medRxiv' ? 'medrxiv' : 'biorxiv'
  const authors = paper.authors
    ? paper.authors.split(';').map((a) => a.trim()).filter(Boolean)
    : []

  // PDF URL: bioRxiv/medRxiv always has PDF
  const pdfUrl = `https://www.${server}.org/content/${paper.doi}v${paper.version}.full.pdf`
  const absUrl = `https://www.${server}.org/content/${paper.doi}v${paper.version}`

  return {
    id: `${source.toLowerCase()}:${paper.doi}`,
    title: paper.title,
    abstract: paper.abstract || null,
    authors: authors.length > 0 ? authors : null,
    keywords: null,
    category: paper.category || null,
    source,
    source_id: paper.doi,
    publish_date: paper.date || null,
    pdf_url: pdfUrl,
    citation_count: 0,
    doi: paper.doi,
    metadata: {
      has_pdf: true,
      source_url: absUrl,
      version: paper.version,
      type: paper.type,
    },
    created_at: paper.date || new Date().toISOString(),
    updated_at: paper.date || new Date().toISOString(),
  }
}
