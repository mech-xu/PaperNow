// ChinaRxiv API Client
// Docs: https://chinarxiv.org/api/v1
// OpenAPI: https://chinarxiv.org/openapi.json
// Rate limits: 30/min anonymous, 300/min with X-API-Email header

import type {
  ChinaRxivPaperList,
  ChinaRxivPaperDetail,
  ChinaRxivPaperText,
  ChinaRxivPaperFigures,
} from '@/types'

const BASE_URL = 'https://chinarxiv.org/api/v1'

interface ChinaRxivOptions {
  email?: string  // Include for higher rate limits (300/min vs 30/min)
}

const defaultOptions: ChinaRxivOptions = {}

function headers(options: ChinaRxivOptions): HeadersInit {
  const h: Record<string, string> = {
    'Accept': 'application/json',
  }
  if (options.email) {
    h['X-API-Email'] = options.email
  }
  return h
}

/**
 * Search and list papers from ChinaRxiv
 * Supports full-text search, date filtering, and cursor-based pagination
 */
export async function searchPapers(
  params: {
    q?: string
    searchField?: 'title' | 'author' | 'abstract'
    subject?: string
    fromDate?: string
    toDate?: string
    hasFullText?: boolean
    hasFigures?: boolean
    hasPdf?: boolean
    limit?: number  // 1-100, default 20
    cursor?: string
  },
  options: ChinaRxivOptions = defaultOptions,
): Promise<ChinaRxivPaperList> {
  const url = new URL(`${BASE_URL}/papers`)

  if (params.q) url.searchParams.set('q', params.q)
  if (params.searchField) url.searchParams.set('search_field', params.searchField)
  if (params.subject) url.searchParams.set('subject', params.subject)
  if (params.fromDate) url.searchParams.set('from_date', params.fromDate)
  if (params.toDate) url.searchParams.set('to_date', params.toDate)
  if (params.hasFullText !== undefined) url.searchParams.set('has_full_text', String(params.hasFullText))
  if (params.hasFigures !== undefined) url.searchParams.set('has_figures', String(params.hasFigures))
  if (params.hasPdf !== undefined) url.searchParams.set('has_pdf', String(params.hasPdf))
  if (params.limit !== undefined) url.searchParams.set('limit', String(params.limit))
  if (params.cursor) url.searchParams.set('cursor', params.cursor)

  const res = await fetch(url.toString(), { headers: headers(options) })
  if (!res.ok) throw new Error(`ChinaRxiv API error: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Get paper details by ID
 */
export async function getPaper(
  paperId: string,
  options: ChinaRxivOptions = defaultOptions,
): Promise<ChinaRxivPaperDetail> {
  const res = await fetch(`${BASE_URL}/papers/${paperId}`, { headers: headers(options) })
  if (!res.ok) throw new Error(`ChinaRxiv API error: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Get paper full text in Markdown format
 */
export async function getPaperText(
  paperId: string,
  options: ChinaRxivOptions = defaultOptions,
): Promise<ChinaRxivPaperText> {
  const res = await fetch(`${BASE_URL}/papers/${paperId}/text`, { headers: headers(options) })
  if (!res.ok) throw new Error(`ChinaRxiv API error: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Get paper translated figures
 */
export async function getPaperFigures(
  paperId: string,
  options: ChinaRxivOptions = defaultOptions,
): Promise<ChinaRxivPaperFigures> {
  const res = await fetch(`${BASE_URL}/papers/${paperId}/figures`, { headers: headers(options) })
  if (!res.ok) throw new Error(`ChinaRxiv API error: ${res.status} ${res.statusText}`)
  return res.json()
}

/**
 * Get paper PDF (redirects to PDF URL)
 */
export function getPaperPdfUrl(paperId: string): string {
  return `${BASE_URL}/papers/${paperId}/pdf`
}

/**
 * List all subjects with paper counts
 */
export async function getSubjects(
  options: ChinaRxivOptions = defaultOptions,
): Promise<{ subjects: Array<{ name: string; count?: number; category?: string }> }> {
  const res = await fetch(`${BASE_URL}/subjects`, { headers: headers(options) })
  if (!res.ok) throw new Error(`ChinaRxiv API error: ${res.status} ${res.statusText}`)
  return res.json()
}
