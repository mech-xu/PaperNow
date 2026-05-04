<template>
  <view class="detail-page">
    <!-- Loading -->
    <view
      v-if="isLoading"
      class="loading"
    >
      <text>加载中...</text>
    </view>

    <!-- Error -->
    <view
      v-else-if="error"
      class="error-state"
    >
      <text class="error-text">{{ error }}</text>
      <button
        class="btn btn-primary"
        @tap="loadDocument"
      >
        重试
      </button>
    </view>

    <!-- Document Detail -->
    <view
      v-else-if="document"
      class="content"
    >
      <!-- Title -->
      <text class="title">{{ document.title }}</text>

      <!-- Authors -->
      <text
        v-if="document.authors?.length"
        class="authors"
      >
        {{ document.authors.join(', ') }}
      </text>

      <!-- Source & Date -->
      <view class="meta-row">
        <text
          v-if="document.source"
          class="source-badge"
        >
          {{ document.source }}
        </text>
        <text
          v-if="document.publish_date"
          class="date"
        >
          {{ document.publish_date }}
        </text>
        <text
          v-if="document.citation_count > 0"
          class="citations"
        >
          引用 {{ document.citation_count }}
        </text>
      </view>

      <!-- Category -->
      <view
        v-if="document.category"
        class="category"
      >
        <text class="category-label">分类:</text>
        <text class="category-value">{{ document.category }}</text>
      </view>

      <!-- Keywords -->
      <view
        v-if="document.keywords?.length"
        class="keywords"
      >
        <text class="section-label">关键词</text>
        <view class="keyword-list">
          <text
            v-for="kw in document.keywords"
            :key="kw"
            class="keyword-chip"
          >
            {{ kw }}
          </text>
        </view>
      </view>

      <!-- Abstract -->
      <view
        v-if="document.abstract"
        class="section"
      >
        <text class="section-label">摘要</text>
        <text class="abstract-text">{{ document.abstract }}</text>
      </view>

      <!-- DOI -->
      <view
        v-if="document.doi"
        class="section"
      >
        <text class="section-label">DOI</text>
        <text
          class="doi-link"
          @tap="openDoi"
        >
          {{ document.doi }}
        </text>
      </view>

      <!-- Source URL -->
      <view
        v-if="sourceUrl"
        class="section"
      >
        <text class="section-label">原文链接</text>
        <text
          class="doi-link"
          @tap="openSourceUrl"
        >
          {{ sourceUrl }}
        </text>
      </view>

      <!-- Actions -->
      <view class="actions">
        <button
          class="btn"
          :class="isCollected ? 'btn-collected' : 'btn-uncollected'"
          @tap="handleCollect"
        >
          {{ isCollected ? '★ 已收藏' : '☆ 收藏' }}
        </button>
        <button
          class="btn btn-secondary"
          @tap="handleLocalSave"
        >
          {{ isLocalSaved ? '已保存' : '本地保存' }}
        </button>
        <button
          class="btn btn-secondary"
          :class="{ 'btn-disabled': !hasPdf }"
          :disabled="!hasPdf"
          @tap="hasPdf && handleDownloadPdf()"
        >
          PDF
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'
import { useSearchStore } from '@/stores/search'
import { useCollectionStore } from '@/stores/collection'
import { useLocalStorage } from '@/composables/useLocalStorage'
import type { Document } from '@/types'

const auth = useAuthStore()
const searchStore = useSearchStore()
const collectionStore = useCollectionStore()
const localStorage = useLocalStorage()

const document = ref<Document | null>(null)
const isLoading = ref(true)
const error = ref('')
const isCollected = ref(false)
const isLocalSaved = ref(false)
const documentId = ref('')

const hasPdf = computed(() => {
  if (!document.value) return false
  // Check explicit has_pdf flag in metadata
  const meta = document.value.metadata as Record<string, unknown> | undefined
  if (meta?.has_pdf === false) return false
  // Check if pdf_url exists
  return !!document.value.pdf_url
})

const sourceUrl = computed(() => {
  const meta = document.value?.metadata as Record<string, unknown> | undefined
  return (meta?.source_url as string) || null
})

onLoad((query) => {
  if (query?.id) {
    documentId.value = query.id
    loadDocument()
  }
})

async function loadDocument() {
  isLoading.value = true
  error.value = ''

  try {
    // First: check searchStore results (from external API)
    const fromSearch = searchStore.results.find(d => d.id === documentId.value)
    if (fromSearch) {
      document.value = fromSearch
    } else {
      // Fallback 1: check locally saved papers
      const localPaper = localStorage.getPaper(documentId.value)
      if (localPaper) {
        document.value = localPaper as unknown as Document
      } else {
        // Fallback 2: fetch from Supabase documents table
        const { supabase } = await import('@/utils/supabase')
        const { data: dbDoc } = await supabase
          .from('documents')
          .select('*')
          .eq('id', documentId.value)
          .single()

        if (dbDoc) {
          document.value = dbDoc as Document
        } else {
          error.value = '文献信息不可用，请重新搜索'
          isLoading.value = false
          return
        }
      }
    }

    // Check if collected
    isCollected.value = collectionStore.isCollected(documentId.value)

    // Check if locally saved
    isLocalSaved.value = localStorage.isPaperSaved(documentId.value)
  } catch (err) {
    error.value = err instanceof Error ? err.message : '加载失败'
  } finally {
    isLoading.value = false
  }
}

async function handleCollect() {
  if (!auth.isAuthenticated) {
    uni.navigateTo({ url: '/pages/auth/login' })
    return
  }

  if (!document.value) return

  try {
    // Ensure document exists in Supabase before toggling collection
    await ensureDocumentInDb()

    const nowCollected = await collectionStore.toggleCollection(documentId.value)
    isCollected.value = nowCollected
    uni.showToast({ title: nowCollected ? '已收藏' : '已取消收藏', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

/**
 * Sanitize date string for PostgreSQL DATE column.
 * Handles: "2026 Apr", "2026 Apr 15", "2026-04-28", etc.
 * Returns YYYY-MM-DD or null.
 */
function sanitizeDate(date: string | null | undefined): string | null {
  if (!date) return null
  // Already ISO format
  if (/^\d{4}-\d{2}-\d{2}$/.test(date)) return date
  // "2026 Apr" or "2026 Apr 15"
  const monthMap: Record<string, string> = {
    jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
    jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
  }
  const match = date.match(/^(\d{4})\s+(\w{3})(?:\s+(\d{1,2}))?$/i)
  if (match) {
    const year = match[1]
    const month = monthMap[match[2].toLowerCase()]
    const day = match[3] ? match[3].padStart(2, '0') : '01'
    if (month) return `${year}-${month}-${day}`
  }
  // Try Date.parse as fallback
  const parsed = new Date(date)
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0]
  }
  return null
}

async function ensureDocumentInDb() {
  if (!document.value) return

  // Upsert document into Supabase (handles both new and existing)
  const { supabase } = await import('@/utils/supabase')
  const doc = document.value
  const { error } = await supabase.from('documents').upsert({
    id: doc.id,
    title: doc.title,
    abstract: doc.abstract,
    authors: doc.authors,
    keywords: doc.keywords,
    category: doc.category,
    source: doc.source,
    source_id: doc.source_id,
    publish_date: sanitizeDate(doc.publish_date),
    pdf_url: doc.pdf_url,
    citation_count: doc.citation_count,
    doi: doc.doi,
    metadata: doc.metadata,
  }, {
    onConflict: 'id',
  })

  if (error) {
    console.error('[ensureDocumentInDb]', error)
  }
}

function handleLocalSave() {
  if (!document.value) return

  if (isLocalSaved.value) {
    localStorage.removePaper(documentId.value)
    isLocalSaved.value = false
    uni.showToast({ title: '已取消本地保存', icon: 'none' })
  } else {
    const success = localStorage.savePaper({
      id: documentId.value,
      title: document.value.title,
      authors: document.value.authors,
      abstract: document.value.abstract,
      source: document.value.source,
      source_id: document.value.source_id,
      pdf_url: document.value.pdf_url,
    })
    if (success) {
      isLocalSaved.value = true
      uni.showToast({ title: '已保存到本地', icon: 'none' })
    } else {
      uni.showToast({ title: localStorage.storageError.value || '保存失败', icon: 'none' })
    }
  }
}

function handleDownloadPdf() {
  // Use API proxy to avoid CORS issues with direct PDF URLs
  const apiBase = 'https://api.papernow.sunnynow.net'
  const proxyUrl = `${apiBase}/v1/papers/${documentId.value}/pdf`
  window.open(proxyUrl, '_blank')
}

function openDoi() {
  if (document.value?.doi) {
    window.open(`https://doi.org/${document.value.doi}`, '_blank')
  }
}

function openSourceUrl() {
  if (sourceUrl.value) {
    window.open(sourceUrl.value, '_blank')
  }
}
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding: 16px;
}

.loading,
.error-state {
  text-align: center;
  padding: 60px 24px;
}

.error-text {
  font-size: 14px;
  color: #e53e3e;
  display: block;
  margin-bottom: 16px;
}

.content {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.4;
  display: block;
  margin-bottom: 10px;
}

.authors {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 12px;
}

.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
}

.source-badge {
  font-size: 12px;
  color: #0066cc;
  background: #e6f0ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.date,
.citations {
  font-size: 12px;
  color: #999;
}

.category {
  margin-bottom: 16px;
}

.category-label {
  font-size: 13px;
  color: #999;
}

.category-value {
  font-size: 13px;
  color: #333;
  margin-left: 4px;
}

.section {
  margin-bottom: 16px;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}

.section-label {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 8px;
}

.keywords {
  margin-bottom: 16px;
}

.keyword-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.keyword-chip {
  font-size: 12px;
  color: #0066cc;
  background: #f0f7ff;
  padding: 3px 8px;
  border-radius: 4px;
}

.abstract-text {
  font-size: 14px;
  color: #444;
  line-height: 1.6;
  display: block;
}

.doi-link {
  font-size: 13px;
  color: #0066cc;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.actions {
  display: flex;
  gap: 12px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid #f0f0f0;
}

.btn {
  flex: 1;
  height: 44px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #0066cc;
  color: #fff;
}

.btn-uncollected {
  background: #fff;
  color: #0066cc;
  border: 1px solid #0066cc;
}

.btn-collected {
  background: #0066cc;
  color: #fff;
}

.btn-secondary {
  background: #fff;
  color: #0066cc;
  border: 1px solid #0066cc;
}

.btn-disabled {
  background: #f5f5f5;
  color: #ccc;
  border-color: #e0e0e0;
  cursor: not-allowed;
}
</style>
