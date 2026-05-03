// PubMed API Client (NCBI E-utilities)
// Docs: https://www.ncbi.nlm.nih.gov/books/developed-with-entrez/
// E-utilities: https://www.ncbi.nlm.nih.gov/books/developed-with-entrez/
// Rate limits: 3/sec without API key, 10/sec with API key

const BASE_URL = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils'

interface PubMedOptions {
  apiKey?: string  // Include for higher rate limits (10/sec vs 3/sec)
}

const defaultOptions: PubMedOptions = {}

function paramsToString(params: Record<string, string>): string {
  return Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
}

export interface PubMedSearchResult {
  ids: string[]
  total: number
}

export interface PubMedArticle {
  pmid: string
  title: string
  authors: string[]
  abstract: string
  journal: string
  pubDate: string
  doi: string | null
  pmcId: string | null
}

/**
 * Search PubMed using ESearch
 * Returns list of PMIDs matching the query
 */
export async function searchPapers(
  params: {
    q: string
    fromDate?: string  // YYYY/MM/DD
    toDate?: string    // YYYY/MM/DD
    retMax?: number    // max results per page, default 20
    retStart?: number  // offset for pagination
  },
  options: PubMedOptions = defaultOptions,
): Promise<PubMedSearchResult> {
  const p: Record<string, string> = {
    db: 'pubmed',
    term: params.q,
    retmax: String(params.retMax || 20),
    retstart: String(params.retStart || 0),
    retmode: 'json',
    usehistory: 'y',
  }

  if (params.fromDate || params.toDate) {
    const from = params.fromDate || '1900/01/01'
    const to = params.toDate || '2099/12/31'
    p.datetype = 'pdat'
    p.mindate = from
    p.maxdate = to
  }

  if (options.apiKey) {
    p.api_key = options.apiKey
  }

  const url = `${BASE_URL}/esearch.fcgi?${paramsToString(p)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PubMed ESearch error: ${res.status}`)

  const json = await res.json()
  const result = json?.esearchresult
  if (!result) throw new Error('PubMed ESearch: unexpected response format')

  return {
    ids: result.idlist || [],
    total: parseInt(result.count || '0', 10),
  }
}

/**
 * Fetch article details using EFetch
 * Returns parsed article data for given PMIDs
 */
export async function fetchArticles(
  pmids: string[],
  options: PubMedOptions = defaultOptions,
): Promise<PubMedArticle[]> {
  if (pmids.length === 0) return []

  const p: Record<string, string> = {
    db: 'pubmed',
    id: pmids.join(','),
    retmode: 'xml',
    rettype: 'abstract',
  }

  if (options.apiKey) {
    p.api_key = options.apiKey
  }

  const url = `${BASE_URL}/efetch.fcgi?${paramsToString(p)}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`PubMed EFetch error: ${res.status}`)

  const xml = await res.text()
  return parsePubMedXml(xml)
}

/**
 * Parse PubMed XML response into structured articles
 */
function parsePubMedXml(xml: string): PubMedArticle[] {
  const articles: PubMedArticle[] = []

  // Simple XML parsing (no DOM parser needed for this format)
  const articleMatches = xml.matchAll(/<PubmedArticle>([\s\S]*?)<\/PubmedArticle>/g)

  for (const articleMatch of articleMatches) {
    const block = articleMatch[1]

    // PMID
    const pmidMatch = block.match(/<PMID[^>]*>(\d+)<\/PMID>/)
    const pmid = pmidMatch?.[1] || ''
    if (!pmid) continue

    // Title
    const titleMatch = block.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/)
    const title = titleMatch?.[1]?.replace(/<[^>]+>/g, '') || ''

    // Authors
    const authors: string[] = []
    const authorMatches = block.matchAll(/<Author[\s\S]*?<LastName>([^<]+)<\/LastName>[\s\S]*?<ForeName>([^<]+)<\/ForeName>/g)
    for (const am of authorMatches) {
      authors.push(`${am[2]} ${am[1]}`)
    }
    // Fallback: try LastName only
    if (authors.length === 0) {
      const lastNameMatches = block.matchAll(/<LastName>([^<]+)<\/LastName>/g)
      for (const lm of lastNameMatches) {
        authors.push(lm[1])
      }
    }

    // Abstract
    const abstractTexts: string[] = []
    const abstractMatches = block.matchAll(/<AbstractText[^>]*>([\s\S]*?)<\/AbstractText>/g)
    for (const abm of abstractMatches) {
      const labelMatch = abm[0].match(/Label="([^"]+)"/)
      const text = abm[1].replace(/<[^>]+>/g, '').trim()
      if (labelMatch) {
        abstractTexts.push(`${labelMatch[1]}: ${text}`)
      } else {
        abstractTexts.push(text)
      }
    }
    const abstract = abstractTexts.join(' ')

    // Journal
    const journalMatch = block.match(/<Title>([^<]+)<\/Title>/)
    const journal = journalMatch?.[1] || ''

    // PubDate
    const yearMatch = block.match(/<PubDate>[\s\S]*?<Year>(\d+)<\/Year>/)
    const monthMatch = block.match(/<PubDate>[\s\S]*?<Month>([^<]+)<\/Month>/)
    const pubDate = yearMatch
      ? (monthMatch ? `${yearMatch[1]} ${monthMatch[1]}` : yearMatch[1])
      : ''

    // DOI
    const doiMatch = block.match(/<ArticleId IdType="doi">([^<]+)<\/ArticleId>/)
    const doi = doiMatch?.[1] || null

    // PMC ID
    const pmcMatch = block.match(/<ArticleId IdType="pmc">([^<]+)<\/ArticleId>/)
    const pmcId = pmcMatch?.[1] || null

    articles.push({ pmid, title, authors, abstract, journal, pubDate, doi, pmcId })
  }

  return articles
}

/**
 * Get PubMed PDF URL (via PMC if available, or publisher link)
 */
export function getPubMedPdfUrl(pmcId: string | null, doi: string | null): string | null {
  if (pmcId) {
    return `https://www.ncbi.nlm.nih.gov/pmc/articles/${pmcId}/pdf/`
  }
  if (doi) {
    return `https://doi.org/${doi}`
  }
  return null
}
