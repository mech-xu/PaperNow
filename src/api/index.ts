// PaperNow API - Cloudflare Worker
// Domain: api.papernow.sunnynow.net
// API Version: v1
// This worker handles server-side API routes that need service_role access

import { createClient } from '@supabase/supabase-js'

// Cloudflare Workers type declarations
declare const caches: CacheStorage & { default: Cache }
interface KVNamespace {
  get(key: string, options?: { type?: 'text' | 'json' | 'arrayBuffer' | 'stream' }): Promise<string | null>
  put(key: string, value: string | ReadableStream | ArrayBuffer, options?: { expirationTtl?: number; expiration?: number; metadata?: unknown }): Promise<void>
  delete(key: string): Promise<void>
  list(options?: { prefix?: string; limit?: number; cursor?: string }): Promise<{ keys: Array<{ name: string; expiration?: number; metadata?: unknown }>; list_complete: boolean; cursor?: string }>
}

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  APP_NAME: string
  APP_VERSION: string
  API_PREFIX: string
  FRONTEND_DOMAIN: string
  CACHE_KV?: KVNamespace // Optional: Workers KV for L2 cache
}

interface SupabaseDocument {
  id: string
  title: string
  abstract: string | null
  authors: string[] | null
  keywords: string[] | null
  category: string | null
  source: string
  source_id: string | null
  publish_date: string | null
  pdf_url: string | null
  citation_count: number
  doi: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

interface IngestPayload {
  title: string
  abstract?: string
  authors?: string[]
  keywords?: string[]
  category?: string
  source: string
  source_id: string
  publish_date?: string
  pdf_url?: string
  citation_count?: number
  doi?: string
  metadata?: Record<string, unknown>
}

function corsHeaders(origin: string): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  }
}

function jsonResponse(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return Response.json(data, { status, headers })
}

function getSupabaseAdmin(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/**
 * 验证请求是否携带有效的 service_role 密钥
 * 用于写入操作（ingest, sync）
 */
function verifyServiceKey(request: Request, env: Env): boolean {
  const authHeader = request.headers.get('Authorization')
  if (!authHeader) return false
  const token = authHeader.replace('Bearer ', '')
  return token === env.SUPABASE_SERVICE_KEY
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get('Origin') || `https://${env.FRONTEND_DOMAIN}`

    // CORS: 生产环境严格限制前端域名
    const allowedOrigins = [
      `https://${env.FRONTEND_DOMAIN}`,           // papernow.sunnynow.net
      'http://localhost:5173',                      // 本地开发
    ]
    const corsOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
    const headers = corsHeaders(corsOrigin)

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers })
    }

    const prefix = env.API_PREFIX || '/v1'

    // Health check (no version prefix)
    if (url.pathname === '/health') {
      return jsonResponse(
        {
          status: 'ok',
          app: env.APP_NAME,
          version: env.APP_VERSION,
          api_prefix: prefix,
          timestamp: new Date().toISOString(),
        },
        200,
        headers,
      )
    }

    // API v1 routes
    if (url.pathname.startsWith(prefix)) {
      const path = url.pathname.slice(prefix.length)
      const supabase = getSupabaseAdmin(env)

      // ============================================
      // GET /v1/papers - 文献列表
      // ============================================
      if (path === '/papers' && request.method === 'GET') {
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 100)
        const offset = parseInt(url.searchParams.get('offset') || '0')
        const source = url.searchParams.get('source')
        const category = url.searchParams.get('category')

        let query = supabase
          .from('documents')
          .select('id, title, source, source_id, publish_date, citation_count, category, authors', { count: 'exact' })
          .order('created_at', { ascending: false })
          .range(offset, offset + limit - 1)

        if (source) query = query.eq('source', source)
        if (category) query = query.eq('category', category)

        const { data, error, count } = await query

        if (error) {
          return jsonResponse({ error: 'Database error', message: error.message }, 500, headers)
        }

        return jsonResponse({
          data,
          total: count || 0,
          limit,
          offset,
        }, 200, headers)
      }

      // ============================================
      // POST /v1/papers/ingest - 文献入库（需 service_role 鉴权）
      // ============================================
      if (path === '/papers/ingest' && request.method === 'POST') {
        if (!verifyServiceKey(request, env)) {
          return jsonResponse({ error: 'Unauthorized', message: 'Valid service_role key required' }, 401, headers)
        }

        let body: IngestPayload
        try {
          body = await request.json() as IngestPayload
        } catch {
          return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body' }, 400, headers)
        }

        // 验证必填字段
        if (!body.title || !body.source || !body.source_id) {
          return jsonResponse({
            error: 'Bad Request',
            message: 'Missing required fields: title, source, source_id',
          }, 400, headers)
        }

        // Upsert: 如果 (source, source_id) 已存在则更新，否则插入
        const { data, error } = await supabase
          .from('documents')
          .upsert({
            title: body.title,
            abstract: body.abstract || null,
            authors: body.authors || null,
            keywords: body.keywords || null,
            category: body.category || null,
            source: body.source,
            source_id: body.source_id,
            publish_date: body.publish_date || null,
            pdf_url: body.pdf_url || null,
            citation_count: body.citation_count || 0,
            doi: body.doi || null,
            metadata: body.metadata || {},
          }, {
            onConflict: 'source,source_id',
          })
          .select()
          .single()

        if (error) {
          return jsonResponse({ error: 'Database error', message: error.message }, 500, headers)
        }

        return jsonResponse({ data, action: 'ingested' }, 201, headers)
      }

      // ============================================
      // POST /v1/papers/sync - 批量同步文献（需 service_role 鉴权）
      // ============================================
      if (path === '/papers/sync' && request.method === 'POST') {
        if (!verifyServiceKey(request, env)) {
          return jsonResponse({ error: 'Unauthorized', message: 'Valid service_role key required' }, 401, headers)
        }

        let body: { papers: IngestPayload[] }
        try {
          body = await request.json() as { papers: IngestPayload[] }
        } catch {
          return jsonResponse({ error: 'Bad Request', message: 'Invalid JSON body' }, 400, headers)
        }

        if (!Array.isArray(body.papers) || body.papers.length === 0) {
          return jsonResponse({ error: 'Bad Request', message: 'papers array is required and must not be empty' }, 400, headers)
        }

        if (body.papers.length > 100) {
          return jsonResponse({ error: 'Bad Request', message: 'Maximum 100 papers per sync request' }, 400, headers)
        }

        const rows = body.papers.map((p) => ({
          title: p.title,
          abstract: p.abstract || null,
          authors: p.authors || null,
          keywords: p.keywords || null,
          category: p.category || null,
          source: p.source,
          source_id: p.source_id,
          publish_date: p.publish_date || null,
          pdf_url: p.pdf_url || null,
          citation_count: p.citation_count || 0,
          doi: p.doi || null,
          metadata: p.metadata || {},
        }))

        const { data, error } = await supabase
          .from('documents')
          .upsert(rows, {
            onConflict: 'source,source_id',
          })
          .select()

        if (error) {
          return jsonResponse({ error: 'Database error', message: error.message }, 500, headers)
        }

        return jsonResponse({
          data,
          count: data?.length || 0,
          action: 'synced',
        }, 200, headers)
      }

      // ============================================
      // GET /v1/papers/:id/pdf - PDF 代理下载 (must match before :id)
      // ============================================
      const paperPdfMatch = path.match(/^\/papers\/(.+)\/pdf$/)
      if (paperPdfMatch && request.method === 'GET') {
        const paperId = decodeURIComponent(paperPdfMatch[1])

        // Resolve PDF URL: check Supabase first, then derive from ID format
        let pdfUrl: string | null = null
        let sourceId = paperId

        // Check Supabase for stored document
        const { data: paper, error } = await supabase
          .from('documents')
          .select('id, title, pdf_url, source, source_id')
          .eq('id', paperId)
          .single()

        if (!error && paper) {
          const doc = paper as SupabaseDocument
          pdfUrl = doc.pdf_url
          sourceId = doc.source_id || paperId
        }

        // If not in Supabase, derive PDF URL from ID format
        if (!pdfUrl) {
          if (paperId.startsWith('chinaxiv-')) {
            // ChinaRxiv: use API endpoint which redirects to actual PDF on Backblaze B2
            pdfUrl = `https://chinarxiv.org/api/v1/papers/${paperId}/pdf`
            sourceId = paperId
          } else if (paperId.startsWith('pmid:')) {
            // PubMed ID: redirect to PubMed page (no direct PDF for most)
            const pmid = paperId.replace('pmid:', '')
            return Response.redirect(`https://pubmed.ncbi.nlm.nih.gov/${pmid}/`, 302)
          } else if (paperId.startsWith('arxiv:')) {
            // arXiv: always has PDF
            const arxivId = paperId.replace('arxiv:', '')
            pdfUrl = `https://arxiv.org/pdf/${arxivId}.pdf`
            sourceId = arxivId
          } else if (paperId.startsWith('biorxiv:')) {
            // bioRxiv: DOI-based PDF
            const doi = paperId.replace('biorxiv:', '')
            pdfUrl = `https://www.biorxiv.org/content/${doi}v1.full.pdf`
            sourceId = doi
          } else if (paperId.startsWith('medrxiv:')) {
            // medRxiv: DOI-based PDF
            const doi = paperId.replace('medrxiv:', '')
            pdfUrl = `https://www.medrxiv.org/content/${doi}v1.full.pdf`
            sourceId = doi
          } else {
            return jsonResponse({ error: 'Not Found', message: `Paper ${paperId} not found` }, 404, headers)
          }
        }

        if (!pdfUrl) {
          return jsonResponse({ error: 'No PDF', message: 'This paper does not have a PDF available' }, 404, headers)
        }

        try {
          // 代理下载 PDF（处理跨域问题）
          const pdfResponse = await fetch(pdfUrl, {
            headers: {
              'User-Agent': 'PaperNow/1.0 (mailto:papernow@sunnynow.net)',
              'Accept': 'application/pdf,*/*',
            },
            redirect: 'follow',
          })

          if (!pdfResponse.ok) {
            return jsonResponse({
              error: 'PDF Fetch Failed',
              message: `Failed to fetch PDF from source: ${pdfResponse.status}`,
            }, 502, headers)
          }

          // 返回 PDF 流
          const pdfHeaders = new Headers(headers)
          const contentType = pdfResponse.headers.get('Content-Type') || 'application/pdf'
          pdfHeaders.set('Content-Type', contentType)
          pdfHeaders.set('Content-Disposition', `inline; filename="${sourceId}.pdf"`)
          pdfHeaders.set('Cache-Control', 'public, max-age=86400')

          return new Response(pdfResponse.body, {
            status: 200,
            headers: pdfHeaders,
          })
        } catch (fetchError) {
          return jsonResponse({
            error: 'PDF Fetch Failed',
            message: fetchError instanceof Error ? fetchError.message : 'Network error',
          }, 502, headers)
        }
      }

      // ============================================
      // GET /v1/papers/:id - 文献详情
      // ============================================
      const paperDetailMatch = path.match(/^\/papers\/(.+)$/)
      if (paperDetailMatch && request.method === 'GET') {
        const paperId = decodeURIComponent(paperDetailMatch[1])

        const { data, error } = await supabase
          .from('documents')
          .select('*')
          .eq('id', paperId)
          .single()

        if (error) {
          if (error.code === 'PGRST116') {
            return jsonResponse({ error: 'Not Found', message: `Paper ${paperId} not found` }, 404, headers)
          }
          return jsonResponse({ error: 'Database error', message: error.message }, 500, headers)
        }

        return jsonResponse({ data }, 200, headers)
      }

      // ============================================
      // GET /v1/collections/:token - 分享链接解析
      // ============================================
      const shareTokenMatch = path.match(/^\/collections\/([0-9a-f-]+)$/)
      if (shareTokenMatch && request.method === 'GET') {
        const token = shareTokenMatch[1]

        // 查找文件夹
        const { data: folder, error } = await supabase
          .from('collab_folders')
          .select('id, name, description, is_public, share_token, created_at, owner_id')
          .eq('share_token', token)
          .single()

        if (error || !folder) {
          return jsonResponse({ error: 'Not Found', message: 'Invalid or expired share link' }, 404, headers)
        }

        // 获取文件夹中的文献
        const { data: documents, error: docError } = await supabase
          .from('collab_folder_documents')
          .select('id, notes, created_at, document:documents(id, title, authors, abstract, source, publish_date, pdf_url)')
          .eq('folder_id', (folder as { id: string }).id)
          .order('created_at', { ascending: false })

        if (docError) {
          return jsonResponse({ error: 'Database error', message: docError.message }, 500, headers)
        }

        return jsonResponse({
          data: {
            folder,
            documents: documents || [],
          },
        }, 200, headers)
      }

      // ============================================
      // GET /v1/sources - 获取可用数据源列表
      // ============================================
      if (path === '/sources' && request.method === 'GET') {
        const { data, error } = await supabase
          .from('documents')
          .select('source')

        if (error) {
          return jsonResponse({ error: 'Database error', message: error.message }, 500, headers)
        }

        // 统计各来源文献数
        const sourceCounts: Record<string, number> = {}
        for (const row of (data as { source: string }[])) {
          sourceCounts[row.source] = (sourceCounts[row.source] || 0) + 1
        }

        return jsonResponse({
          data: Object.entries(sourceCounts).map(([source, count]) => ({ source, count })),
        }, 200, headers)
      }

      // ============================================
      // GET /v1/categories - 获取学科分类列表
      // ============================================
      if (path === '/categories' && request.method === 'GET') {
        const { data, error } = await supabase
          .from('documents')
          .select('category')
          .not('category', 'is', null)

        if (error) {
          return jsonResponse({ error: 'Database error', message: error.message }, 500, headers)
        }

        // 统计各分类文献数
        const categoryCounts: Record<string, number> = {}
        for (const row of (data as { category: string }[])) {
          if (row.category) {
            categoryCounts[row.category] = (categoryCounts[row.category] || 0) + 1
          }
        }

        return jsonResponse({
          data: Object.entries(categoryCounts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count),
        }, 200, headers)
      }

      // ============================================
      // GET /v1/proxy - External API proxy (CORS bypass) with L1+L2 cache
      // ============================================
      if (path === '/proxy' && request.method === 'GET') {
        const targetUrl = url.searchParams.get('url')
        if (!targetUrl) {
          return jsonResponse({ error: 'Bad Request', message: 'Missing url parameter' }, 400, headers)
        }

        // Only allow whitelisted domains
        const allowedDomains = [
          'export.arxiv.org',       // arXiv API
          'api.biorxiv.org',       // bioRxiv/medRxiv API
        ]
        const targetHost = new URL(targetUrl).hostname
        if (!allowedDomains.includes(targetHost)) {
          return jsonResponse({ error: 'Forbidden', message: `Domain ${targetHost} is not allowed` }, 403, headers)
        }

        try {
          // Determine cache TTL based on target URL
          const cacheTtl = getProxyCacheTtl(targetUrl)
          const kvKey = buildCacheKey(targetUrl)

          // L1: Check Cache API (datacenter-local, fastest)
          const cache = caches.default
          const cacheRequest = new Request(targetUrl, { method: 'GET' })
          const cachedResponse = await cache.match(cacheRequest)
          if (cachedResponse) {
            const responseHeaders = new Headers(headers)
            responseHeaders.set('X-Cache', 'L1-HIT')
            const contentType = cachedResponse.headers.get('Content-Type')
            if (contentType) responseHeaders.set('Content-Type', contentType)
            return new Response(cachedResponse.body, {
              status: 200,
              headers: responseHeaders,
            })
          }

          // L2: Check Workers KV (globally replicated)
          if (env.CACHE_KV) {
            const kvValue = await env.CACHE_KV.get(kvKey, { type: 'arrayBuffer' })
            if (kvValue) {
              // Populate L1 from L2
              const contentType = 'application/json'
              const l2Response = new Response(kvValue, {
                headers: {
                  'Content-Type': contentType,
                  'Cache-Control': `public, max-age=${cacheTtl}`,
                },
              })
              await cache.put(cacheRequest, l2Response.clone())

              const responseHeaders = new Headers(headers)
              responseHeaders.set('X-Cache', 'L2-HIT')
              responseHeaders.set('Content-Type', contentType)
              return new Response(kvValue, {
                status: 200,
                headers: responseHeaders,
              })
            }
          }

          // L3: Fetch from upstream
          const proxyResponse = await fetch(targetUrl, {
            headers: {
              'User-Agent': 'PaperNow/1.0 (mailto:papernow@sunnynow.net)',
            },
            redirect: 'follow',
          })

          if (!proxyResponse.ok) {
            return jsonResponse({ error: 'Proxy Fetch Failed', message: `Upstream returned ${proxyResponse.status}` }, 502, headers)
          }

          const body = await proxyResponse.arrayBuffer()
          const contentType = proxyResponse.headers.get('Content-Type') || 'application/json'

          // Store in L2 (Workers KV) with TTL
          if (env.CACHE_KV) {
            try {
              await env.CACHE_KV.put(kvKey, body, { expirationTtl: cacheTtl })
            } catch (kvErr) {
              console.error('[KV put error]', kvKey, kvErr)
            }
          }

          // Store in L1 (Cache API)
          const cachedUpstream = new Response(body, {
            headers: {
              'Content-Type': contentType,
              'Cache-Control': `public, max-age=${cacheTtl}`,
            },
          })
          await cache.put(cacheRequest, cachedUpstream)

          const proxyHeaders = new Headers(headers)
          proxyHeaders.set('Content-Type', contentType)
          proxyHeaders.set('X-Cache', 'MISS')
          return new Response(body, {
            status: 200,
            headers: proxyHeaders,
          })
        } catch (fetchError) {
          return jsonResponse({
            error: 'Proxy Fetch Failed',
            message: fetchError instanceof Error ? fetchError.message : 'Network error',
          }, 502, headers)
        }
      }

      // ============================================
      // DELETE /v1/users/:id - Delete user account and all data
      // ============================================
      if (path.match(/^\/users\/(.+)$/) && request.method === 'DELETE') {
        const match = path.match(/^\/users\/(.+)$/)!
        const userId = decodeURIComponent(match[1])

        // Verify the requesting user is deleting their own account (or is admin)
        const authHeader = request.headers.get('Authorization')
        if (!authHeader) {
          return jsonResponse({ error: 'Unauthorized', message: 'Missing Authorization header' }, 401, headers)
        }

        // Get the requesting user's ID from the Supabase auth token
        const token = authHeader.replace('Bearer ', '')
        const { data: { user: requestingUser }, error: authError } = await supabase.auth.getUser(token)
        if (authError || !requestingUser) {
          return jsonResponse({ error: 'Unauthorized', message: 'Invalid token' }, 401, headers)
        }

        // Only allow deleting own account (admin override handled separately)
        if (requestingUser.id !== userId) {
          return jsonResponse({ error: 'Forbidden', message: 'Can only delete your own account' }, 403, headers)
        }

        // Delete the user from auth.users - CASCADE will delete all related data
        // (profiles, user_collections, user_tags, document_tags, collab_folders, etc.)
        const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

        if (deleteError) {
          return jsonResponse({ error: 'Delete Failed', message: deleteError.message }, 500, headers)
        }

        return jsonResponse({ success: true, message: 'Account deleted' }, 200, headers)
      }

      // ============================================
      // Admin endpoints (basic auth: admin/admin)
      // ============================================
      const adminAuth = request.headers.get('Authorization')
      const isAdmin = adminAuth === `Basic ${btoa('admin:admin')}`

      if (path.startsWith('/admin') && !isAdmin) {
        return new Response('Unauthorized', {
          status: 401,
          headers: { 'WWW-Authenticate': 'Basic realm="PaperNow Admin"' },
        })
      }

      // GET /v1/admin/users - List all users
      if (path === '/admin/users' && request.method === 'GET') {
        const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })

        const { data, error } = await adminClient
          .from('profiles')
          .select('id, display_name, bio, created_at')

        if (error) {
          return jsonResponse({ error: 'Database error', message: error.message }, 500, headers)
        }

        // Get collection counts per user
        const { data: collCounts } = await adminClient
          .from('user_collections')
          .select('user_id')

        const countMap: Record<string, number> = {}
        if (collCounts) {
          for (const c of collCounts) {
            countMap[c.user_id] = (countMap[c.user_id] || 0) + 1
          }
        }

        // Get emails from auth.users via admin API
        const { data: authUsers } = await adminClient.auth.admin.listUsers()
        const emailMap: Record<string, string> = {}
        if (authUsers?.users) {
          for (const u of authUsers.users) {
            emailMap[u.id] = u.email || ''
          }
        }

        const users = (data || []).map((u: any) => ({
          ...u,
          email: emailMap[u.id] || '',
          collection_count: countMap[u.id] || 0,
        }))

        return jsonResponse({ users }, 200, headers)
      }

      // DELETE /v1/admin/users/:id - Admin delete user
      if (path.match(/^\/admin\/users\/(.+)$/) && request.method === 'DELETE') {
        const match = path.match(/^\/admin\/users\/(.+)$/)!
        const userId = decodeURIComponent(match[1])

        const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY, {
          auth: { autoRefreshToken: false, persistSession: false },
        })
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId)

        if (deleteError) {
          return jsonResponse({ error: 'Delete Failed', message: deleteError.message }, 500, headers)
        }

        return jsonResponse({ success: true, message: `User ${userId} deleted` }, 200, headers)
      }

      // POST /v1/admin/cache/purge - Purge Workers KV cache
      if (path === '/admin/cache/purge' && request.method === 'POST') {
        if (!env.CACHE_KV) {
          return jsonResponse({ error: 'No KV binding', message: 'CACHE_KV not configured' }, 400, headers)
        }

        // List and delete all keys
        let deleted = 0
        let cursor: string | undefined
        do {
          const list = await env.CACHE_KV.list({ cursor, limit: 1000 })
          for (const key of list.keys) {
            await env.CACHE_KV.delete(key.name)
            deleted++
          }
          cursor = list.list_complete ? undefined : list.cursor
        } while (cursor)

        return jsonResponse({ success: true, deleted }, 200, headers)
      }

      // GET /v1/admin/cache/stats - Cache statistics
      if (path === '/admin/cache/stats' && request.method === 'GET') {
        if (!env.CACHE_KV) {
          return jsonResponse({ error: 'No KV binding' }, 400, headers)
        }

        let count = 0
        let cursor: string | undefined
        do {
          const list = await env.CACHE_KV.list({ cursor, limit: 1000 })
          count += list.keys.length
          cursor = list.list_complete ? undefined : list.cursor
        } while (cursor)

        return jsonResponse({ keyCount: count }, 200, headers)
      }

      // Route not found within API v1
      return jsonResponse(
        {
          error: 'Not Found',
          message: `No route matches ${url.pathname}`,
          hint: `API endpoints are under ${prefix}/`,
          available_routes: [
            'GET  /v1/papers',
            'GET  /v1/papers/:id',
            'POST /v1/papers/ingest',
            'POST /v1/papers/sync',
            'GET  /v1/papers/:id/pdf',
            'GET  /v1/collections/:token',
            'GET  /v1/sources',
            'GET  /v1/categories',
            'DELETE /v1/users/:id',
            'GET  /v1/admin/users',
            'DELETE /v1/admin/users/:id',
            'POST /v1/admin/cache/purge',
            'GET  /v1/admin/cache/stats',
          ],
        },
        404,
        headers,
      )
    }

    // Route not found
    return jsonResponse(
      {
        error: 'Not Found',
        message: `No route matches ${url.pathname}`,
        hint: `API endpoints are under ${prefix}/`,
        health_check: '/health',
      },
      404,
      headers,
    )
  },
}

// ============================================
// Cache helper functions for proxy endpoint
// ============================================

/**
 * Build cache key from target URL
 * Format: proxy:{host}:{path_parts_joined}
 * e.g., proxy:api.biorxiv.org:details:biorxiv:2024-11-01:2025-05-03:0
 */
function buildCacheKey(targetUrl: string): string {
  const u = new URL(targetUrl)
  const parts = u.pathname.split('/').filter(Boolean)
  return `proxy:${u.hostname}:${parts.join(':')}`
}

/**
 * Determine cache TTL based on target URL
 * - Past date ranges: 7 days (papers don't change)
 * - Current date range: 1 hour (new papers posted throughout day)
 * - arXiv: 1 hour (arXiv updates daily)
 */
function getProxyCacheTtl(targetUrl: string): number {
  const u = new URL(targetUrl)

  // arXiv: cache 1 hour (updates daily)
  if (u.hostname === 'export.arxiv.org') {
    return 3600
  }

  // bioRxiv/medRxiv: check if date range is in the past
  // URL format: /details/{server}/{from_date}/{to_date}/{cursor}
  const parts = u.pathname.split('/').filter(Boolean)
  if (parts.length >= 4 && parts[0] === 'details') {
    const toDate = parts[3] // YYYY-MM-DD
    const today = new Date().toISOString().split('T')[0]
    if (toDate < today) {
      return 7 * 24 * 3600 // 7 days for past ranges
    }
    return 3600 // 1 hour for current range
  }

  // Default: 1 hour
  return 3600
}
