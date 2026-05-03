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

      <!-- Actions -->
      <view class="actions">
        <button
          class="btn btn-primary"
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
          v-if="document.pdf_url"
          class="btn btn-secondary"
          @tap="handleDownloadPdf"
        >
          下载 PDF
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from '@/stores/auth'
import { useCollectionStore } from '@/stores/collection'
import { useLocalStorage } from '@/composables/useLocalStorage'
import type { Document } from '@/types'

const auth = useAuthStore()
const collectionStore = useCollectionStore()
const localStorage = useLocalStorage()

const document = ref<Document | null>(null)
const isLoading = ref(true)
const error = ref('')
const isCollected = ref(false)
const isLocalSaved = ref(false)
const documentId = ref('')

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
    const { data, error: err } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId.value)
      .single()

    if (err) throw err
    document.value = data as Document

    // Check if collected (from store or direct query)
    isCollected.value = collectionStore.isCollected(documentId.value)
    if (!isCollected.value && auth.isAuthenticated) {
      const { data: coll } = await supabase
        .from('user_collections')
        .select('id')
        .eq('document_id', documentId.value)
        .eq('user_id', auth.user!.id)
        .single()
      isCollected.value = !!coll
    }

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

  try {
    const nowCollected = await collectionStore.toggleCollection(documentId.value)
    isCollected.value = nowCollected
    uni.showToast({ title: nowCollected ? '已收藏' : '已取消收藏', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
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
  if (document.value?.pdf_url) {
    window.open(document.value.pdf_url, '_blank')
  }
}

function openDoi() {
  if (document.value?.doi) {
    window.open(`https://doi.org/${document.value.doi}`, '_blank')
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

.btn-secondary {
  background: #fff;
  color: #0066cc;
  border: 1px solid #0066cc;
}
</style>
