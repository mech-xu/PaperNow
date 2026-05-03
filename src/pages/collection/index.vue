<template>
  <view class="collection-page">
    <!-- Header -->
    <view class="header">
      <text class="page-title">我的收藏</text>
      <text
        v-if="collectionStore.collections.length > 0"
        class="count"
      >
        {{ collectionStore.collections.length }} 篇
      </text>
    </view>

    <!-- Tag Filter Bar -->
    <view
      v-if="collectionStore.tags.length > 0"
      class="tag-bar"
    >
      <scroll-view
        scroll-x
        class="tag-scroll"
      >
        <view class="tag-list">
          <TagChip
            v-for="tag in collectionStore.tags"
            :key="tag.id"
            :tag="tag"
            :is-selected="collectionStore.selectedTagId === tag.id"
            :tag-count="getTagCount(tag.id)"
            mode="filter"
            :deletable="false"
            @tap="handleTagFilter"
          />
        </view>
      </scroll-view>
    </view>

    <!-- Reading Status Filter -->
    <view class="status-filter">
      <view
        v-for="opt in statusOptions"
        :key="opt.value ?? 'all'"
        class="status-option"
        :class="{ active: collectionStore.selectedReadingStatus === opt.value }"
        @tap="handleStatusFilter(opt.value)"
      >
        <text class="status-option-text">{{ opt.label }}</text>
      </view>
    </view>

    <!-- Loading -->
    <view
      v-if="collectionStore.isLoading"
      class="loading"
    >
      <text class="loading-text">加载中...</text>
    </view>

    <!-- Empty State -->
    <view
      v-else-if="collectionStore.collections.length === 0"
      class="empty-state"
    >
      <text class="empty-icon">📚</text>
      <text class="empty-text">暂无收藏文献</text>
      <text class="empty-hint">搜索并收藏感兴趣的预印本文献</text>
      <text
        class="empty-action"
        @tap="goToSearch"
      >
        去搜索
      </text>
    </view>

    <!-- Filtered Empty State -->
    <view
      v-else-if="collectionStore.filteredCollections.length === 0"
      class="empty-state"
    >
      <text class="empty-icon">🔍</text>
      <text class="empty-text">当前筛选无结果</text>
      <text
        class="empty-action"
        @tap="clearFilters"
      >
        清除筛选
      </text>
    </view>

    <!-- Collection List -->
    <view
      v-else
      class="collection-list"
    >
      <view
        v-for="item in collectionStore.filteredCollections"
        :key="item.id"
        class="collection-item"
      >
        <!-- Document Info -->
        <view
          class="item-content"
          @tap="goToDetail(item)"
        >
          <text class="item-title">{{ item.document?.title }}</text>
          <text
            v-if="item.document?.authors?.length"
            class="item-authors"
          >
            {{ formatAuthors(item.document.authors) }}
          </text>
          <view class="item-meta">
            <text
              v-if="item.document?.source"
              class="source-badge"
            >
              {{ item.document.source }}
            </text>
            <text
              v-if="item.document?.publish_date"
              class="item-date"
            >
              {{ item.document.publish_date }}
            </text>
          </view>
        </view>

        <!-- Tags -->
        <view
          v-if="item.tags && item.tags.length > 0"
          class="item-tags"
        >
          <TagChip
            v-for="tag in item.tags"
            :key="tag.id"
            :tag="tag"
            mode="display"
            :deletable="true"
            @delete="handleRemoveTag(item.id, $event)"
          />
        </view>

        <!-- Actions Row -->
        <view class="item-actions">
          <!-- Reading Status -->
          <ReadingStatusBadge
            :status="item.reading_status"
            :compact="true"
            @change="handleStatusChange(item.id, $event)"
          />

          <!-- Add Tag Button -->
          <text
            class="action-link"
            @tap="openAddTagDialog(item.id)"
          >
            + 标签
          </text>

          <!-- Local Save -->
          <text
            class="action-link"
            :class="{ saved: localStorage.isPaperSaved(item.document_id) }"
            @tap="handleLocalSave(item)"
          >
            {{ localStorage.isPaperSaved(item.document_id) ? '已保存' : '本地保存' }}
          </text>

          <!-- Remove -->
          <text
            class="action-link action-remove"
            @tap="handleRemove(item)"
          >
            移除
          </text>
        </view>
      </view>
    </view>

    <!-- Add Tag Dialog -->
    <view
      v-if="showTagDialog"
      class="dialog-overlay"
      @tap="closeTagDialog"
    >
      <view
        class="dialog"
        @tap.stop
      >
        <text class="dialog-title">添加标签</text>

        <!-- Existing Tags -->
        <view
          v-if="collectionStore.tags.length > 0"
          class="dialog-section"
        >
          <text class="dialog-section-label">选择已有标签</text>
          <view class="dialog-tag-list">
            <TagChip
              v-for="tag in collectionStore.tags"
              :key="tag.id"
              :tag="tag"
              mode="filter"
              :is-selected="isTagSelectedForItem(tag.id)"
              :deletable="false"
              @tap="handleToggleTagOnItem(tag.id)"
            />
          </view>
        </view>

        <!-- Create New Tag -->
        <view class="dialog-section">
          <text class="dialog-section-label">新建标签</text>
          <view class="new-tag-form">
            <input
              v-model="newTagName"
              type="text"
              placeholder="标签名称"
              class="new-tag-input"
            >
            <input
              v-model="newTagColor"
              type="text"
              placeholder="#0066cc"
              class="new-tag-color-input"
            >
            <text
              class="new-tag-btn"
              @tap="handleCreateAndAddTag"
            >
              创建
            </text>
          </view>
        </view>

        <text
          class="dialog-close"
          @tap="closeTagDialog"
        >
          关闭
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useCollectionStore } from '@/stores/collection'
import { useAuthGuard } from '@/composables/useAuthGuard'
import { useLocalStorage } from '@/composables/useLocalStorage'
import TagChip from '@/components/business/TagChip.vue'
import ReadingStatusBadge from '@/components/business/ReadingStatusBadge.vue'
import type { ReadingStatus, UserCollection } from '@/types'

const collectionStore = useCollectionStore()
const { requireAuth } = useAuthGuard()
const localStorage = useLocalStorage()

// Tag dialog state
const showTagDialog = ref(false)
const targetCollectionId = ref('')
const newTagName = ref('')
const newTagColor = ref('#0066cc')

const statusOptions: { label: string; value: ReadingStatus | null }[] = [
  { label: '全部', value: null },
  { label: '未读', value: 'unread' },
  { label: '在读', value: 'reading' },
  { label: '已读', value: 'read' },
]

onShow(() => {
  if (!requireAuth()) return
  loadData()
})

async function loadData() {
  await Promise.all([
    collectionStore.fetchCollections(),
    collectionStore.fetchTags(),
  ])
}

function getTagCount(tagId: string): number {
  return collectionStore.collections.filter(c =>
    c.tags?.some(t => t.id === tagId)
  ).length
}

function formatAuthors(authors: string[] | null): string {
  if (!authors?.length) return ''
  if (authors.length <= 3) return authors.join(', ')
  return authors.slice(0, 3).join(', ') + ' et al.'
}

function handleTagFilter(tag: { id: string }) {
  collectionStore.selectedTagId =
    collectionStore.selectedTagId === tag.id ? null : tag.id
}

function handleStatusFilter(status: ReadingStatus | null) {
  collectionStore.selectedReadingStatus = status
}

function clearFilters() {
  collectionStore.selectedTagId = null
  collectionStore.selectedReadingStatus = null
}

function goToDetail(item: UserCollection) {
  uni.navigateTo({ url: `/pages/detail/index?id=${item.document_id}` })
}

function goToSearch() {
  uni.switchTab({ url: '/pages/search/index' })
}

async function handleStatusChange(collectionId: string, status: ReadingStatus) {
  try {
    await collectionStore.updateReadingStatus(collectionId, status)
  } catch (err) {
    uni.showToast({ title: '更新失败', icon: 'none' })
  }
}

async function handleRemove(item: UserCollection) {
  try {
    await collectionStore.removeFromCollection(item.id)
    uni.showToast({ title: '已移除', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '移除失败', icon: 'none' })
  }
}

async function handleRemoveTag(collectionId: string, tagId: string) {
  try {
    await collectionStore.removeTagFromCollection(collectionId, tagId)
  } catch (err) {
    uni.showToast({ title: '移除标签失败', icon: 'none' })
  }
}

function handleLocalSave(item: UserCollection) {
  if (!item.document) return

  if (localStorage.isPaperSaved(item.document_id)) {
    localStorage.removePaper(item.document_id)
    uni.showToast({ title: '已取消本地保存', icon: 'none' })
  } else {
    const success = localStorage.savePaper({
      id: item.document_id,
      title: item.document.title,
      authors: item.document.authors,
      abstract: item.document.abstract,
      source: item.document.source,
      source_id: item.document.source_id,
      pdf_url: item.document.pdf_url,
    })
    if (success) {
      uni.showToast({ title: '已保存到本地', icon: 'none' })
    } else {
      uni.showToast({ title: localStorage.storageError.value || '保存失败', icon: 'none' })
    }
  }
}

// --- Tag Dialog ---

function openAddTagDialog(collectionId: string) {
  targetCollectionId.value = collectionId
  newTagName.value = ''
  newTagColor.value = '#0066cc'
  showTagDialog.value = true
}

function closeTagDialog() {
  showTagDialog.value = false
  targetCollectionId.value = ''
}

function isTagSelectedForItem(tagId: string): boolean {
  if (!targetCollectionId.value) return false
  const item = collectionStore.collections.find(c => c.id === targetCollectionId.value)
  return item?.tags?.some(t => t.id === tagId) || false
}

async function handleToggleTagOnItem(tagId: string) {
  if (!targetCollectionId.value) return

  try {
    if (isTagSelectedForItem(tagId)) {
      await collectionStore.removeTagFromCollection(targetCollectionId.value, tagId)
    } else {
      await collectionStore.addTagToCollection(targetCollectionId.value, tagId)
    }
  } catch (err) {
    uni.showToast({ title: '操作失败', icon: 'none' })
  }
}

async function handleCreateAndAddTag() {
  if (!newTagName.value.trim()) {
    uni.showToast({ title: '请输入标签名称', icon: 'none' })
    return
  }

  try {
    // 创建标签
    const newTag = await collectionStore.createTag(
      newTagName.value.trim(),
      newTagColor.value || '#0066cc',
    )

    // 关联到当前收藏记录
    if (targetCollectionId.value && newTag) {
      await collectionStore.addTagToCollection(targetCollectionId.value, (newTag as { id: string }).id)
    }

    newTagName.value = ''
    newTagColor.value = '#0066cc'
  } catch (err) {
    uni.showToast({ title: '创建标签失败', icon: 'none' })
  }
}
</script>

<style scoped>
.collection-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 20px;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.count {
  font-size: 13px;
  color: #999;
}

/* Tag Filter Bar */
.tag-bar {
  padding: 0 16px 8px;
}

.tag-scroll {
  white-space: nowrap;
}

.tag-list {
  display: flex;
  gap: 8px;
  padding-bottom: 4px;
}

/* Reading Status Filter */
.status-filter {
  display: flex;
  gap: 0;
  padding: 0 16px 12px;
}

.status-option {
  flex: 1;
  text-align: center;
  padding: 6px 0;
  border-bottom: 2px solid transparent;
}

.status-option.active {
  border-bottom-color: #0066cc;
}

.status-option-text {
  font-size: 13px;
  color: #666;
}

.status-option.active .status-option-text {
  color: #0066cc;
  font-weight: 600;
}

/* Loading */
.loading {
  text-align: center;
  padding: 60px 24px;
}

.loading-text {
  font-size: 14px;
  color: #999;
}

/* Empty State */
.empty-state {
  text-align: center;
  padding: 60px 24px;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #999;
  display: block;
  margin-bottom: 16px;
}

.empty-action {
  font-size: 14px;
  color: #0066cc;
  font-weight: 500;
}

/* Collection List */
.collection-list {
  padding: 0 16px;
}

.collection-item {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.item-content {
  margin-bottom: 8px;
}

.item-title {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  display: block;
  margin-bottom: 4px;
}

.item-authors {
  font-size: 12px;
  color: #666;
  display: block;
  margin-bottom: 6px;
}

.item-meta {
  display: flex;
  align-items: center;
  gap: 8px;
}

.source-badge {
  font-size: 11px;
  color: #0066cc;
  background: #e6f0ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.item-date {
  font-size: 12px;
  color: #999;
}

/* Item Tags */
.item-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

/* Item Actions */
.item-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.action-link {
  font-size: 12px;
  color: #0066cc;
  font-weight: 500;
}

.action-link.saved {
  color: #38a169;
}

.action-remove {
  color: #e53e3e;
  margin-left: auto;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  max-height: 80vh;
  overflow-y: auto;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16px;
}

.dialog-section {
  margin-bottom: 16px;
}

.dialog-section-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.dialog-tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.new-tag-form {
  display: flex;
  gap: 8px;
  align-items: center;
}

.new-tag-input {
  flex: 1;
  height: 36px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0 8px;
  font-size: 14px;
  background: #fafafa;
}

.new-tag-color-input {
  width: 80px;
  height: 36px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0 8px;
  font-size: 14px;
  background: #fafafa;
}

.new-tag-btn {
  font-size: 14px;
  color: #fff;
  background: #0066cc;
  padding: 8px 16px;
  border-radius: 8px;
  font-weight: 500;
}

.dialog-close {
  display: block;
  text-align: center;
  font-size: 14px;
  color: #666;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
</style>
