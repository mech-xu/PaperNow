// PaperNow API - Cloudflare Worker
// Domain: api.papernow.sunnynow.net
// API Version: v1
// This worker handles server-side API routes that need service_role access

import { createClient } from '@supabase/supabase-js'

interface Env {
  SUPABASE_URL: string
  SUPABASE_SERVICE_KEY: string
  APP_NAME: string
  APP_VERSION: string
  API_PREFIX: string
  FRONTEND_DOMAIN: string
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
      // GET /v1/papers/:id - 文献详情
      // ============================================
      const paperDetailMatch = path.match(/^\/papers\/([0-9a-f-]+)$/)
      if (paperDetailMatch && request.method === 'GET') {
        const paperId = paperDetailMatch[1]

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
      // GET /v1/papers/:id/pdf - PDF 代理下载
      // ============================================
      const paperPdfMatch = path.match(/^\/papers\/([0-9a-f-]+)\/pdf$/)
      if (paperPdfMatch && request.method === 'GET') {
        const paperId = paperPdfMatch[1]

        // 获取文献的 PDF URL
        const { data: paper, error } = await supabase
          .from('documents')
          .select('id, title, pdf_url, source, source_id')
          .eq('id', paperId)
          .single()

        if (error || !paper) {
          return jsonResponse({ error: 'Not Found', message: `Paper ${paperId} not found` }, 404, headers)
        }

        const doc = paper as SupabaseDocument
        if (!doc.pdf_url) {
          return jsonResponse({ error: 'No PDF', message: 'This paper does not have a PDF available' }, 404, headers)
        }

        try {
          // 代理下载 PDF（处理跨域问题）
          const pdfResponse = await fetch(doc.pdf_url, {
            headers: {
              'User-Agent': 'PaperNow/1.0 (mailto:papernow@sunnynow.net)',
              'Accept': 'application/pdf',
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
          pdfHeaders.set('Content-Type', 'application/pdf')
          pdfHeaders.set('Content-Disposition', `inline; filename="${doc.source_id || paperId}.pdf"`)
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
