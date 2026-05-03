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
 * API: /details/{server}/{from_date}/{to_date}/{cursor}
 * Note: API has no search query param - returns all papers in date range.
 * We use a short date range (recent) and filter client-side.
 */
export async function searchPapers(
  server: 'biorxiv' | 'medrxiv',
  params: {
    q?: string
    category?: string
    fromDate?: string     // YYYY-MM-DD
    toDate?: string       // YYYY-MM-DD
    cursor?: number       // offset for pagination
    limit?: number        // default 30, max 100
  },
): Promise<BiorxivSearchResult> {
  const fromDate = params.fromDate || getDefaultFromDate()
  const toDate = params.toDate || getToday()
  const cursor = params.cursor || 0
  const limit = params.limit || 30

  // API format: /details/{server}/{from_date}/{to_date}/{cursor}
  // Note: API returns fixed 30 items per page, no count parameter
  const url = `${API_BASE}/details/${server}/${fromDate}/${toDate}/${cursor}`

  // Use API proxy to bypass CORS
  const proxyUrl = `${PROXY_URL}?url=${encodeURIComponent(url)}`
  const res = await fetch(proxyUrl)
  if (!res.ok) throw new Error(`${server} API error: ${res.status}`)

  const raw = await res.json()

  // Normalize messages (API returns array or object depending on version)
  const msgs = Array.isArray(raw.messages) ? raw.messages[0] : raw.messages
  let collection: BiorxivPaper[] = raw.collection || []
  const totalPapers = msgs?.total || collection.length

  // Deduplicate by DOI (API returns multiple versions of same paper)
  collection = deduplicateByDoi(collection)

  // Client-side text filtering (API doesn't support full-text search)
  if (params.q) {
    const q = params.q.toLowerCase()
    const matched: BiorxivPaper[] = []
    let currentCursor = cursor
    let pagesFetched = 1
    const maxPages = 10 // fetch up to 10 pages (300 papers) to find matches

    // Filter first page
    for (const paper of collection) {
      if (paper.title.toLowerCase().includes(q)
        || paper.authors.toLowerCase().includes(q)) {
        matched.push(paper)
      }
    }

    // Fetch more pages until we have enough matches or hit max pages
    while (matched.length < limit && pagesFetched < maxPages) {
      currentCursor += collection.length
      const nextUrl = `${API_BASE}/details/${server}/${fromDate}/${toDate}/${currentCursor}`
      const nextProxyUrl = `${PROXY_URL}?url=${encodeURIComponent(nextUrl)}`
      const nextRes = await fetch(nextProxyUrl)
      if (!nextRes.ok) break
      const nextRaw = await nextRes.json()
      collection = nextRaw.collection || []
      if (collection.length === 0) break
      pagesFetched++

      // Deduplicate and filter
      collection = deduplicateByDoi(collection)
      for (const paper of collection) {
        if (paper.title.toLowerCase().includes(q)
          || paper.authors.toLowerCase().includes(q)) {
          if (!matched.some(m => m.doi === paper.doi)) {
            matched.push(paper)
          }
        }
      }
    }

    collection = matched.slice(0, limit)
  }

  // Final dedup by DOI to ensure no duplicates
  collection = deduplicateByDoi(collection)

  // Category filter
  if (params.category) {
    collection = collection.filter((paper) =>
      paper.category === params.category,
    )
  }

  // Limit results
  if (collection.length > limit) {
    collection = collection.slice(0, limit)
  }

  const data: BiorxivSearchResult = {
    messages: {
      status: msgs?.status || 'ok',
      interval: msgs?.interval || '',
      cursor: msgs?.cursor || 0,
      count: collection.length,
      total: totalPapers,
    },
    collection,
  }

  return data
}

/**
 * Deduplicate papers by DOI, keeping the latest version
 */
function deduplicateByDoi(papers: BiorxivPaper[]): BiorxivPaper[] {
  const seen = new Map<string, BiorxivPaper>()
  for (const paper of papers) {
    const existing = seen.get(paper.doi)
    if (!existing || Number(paper.version) > Number(existing.version)) {
      seen.set(paper.doi, paper)
    }
  }
  return Array.from(seen.values())
}

function getDefaultFromDate(): string {
  const d = new Date()
  d.setMonth(d.getMonth() - 6) // Last 6 months for reasonable match rate
  return d.toISOString().split('T')[0]
}

function getToday(): string {
  return new Date().toISOString().split('T')[0]
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

  const raw = await res.json()
  const collection = raw.collection || []
  return collection[0] || null
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
