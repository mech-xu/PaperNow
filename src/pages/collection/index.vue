<template>
  <view class="collection-page">
    <!-- Back to Home -->
    <view class="nav-back" @tap="goHome">
      <text class="nav-back-icon">‹</text>
    </view>

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

    <!-- Collection List -->
    <view
      v-else
      class="collection-list"
    >
      <view
        v-for="item in collectionStore.collections"
        :key="item.id"
        class="collection-item"
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
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useCollectionStore } from '@/stores/collection'
import { useAuthGuard } from '@/composables/useAuthGuard'
import type { UserCollection } from '@/types'

const collectionStore = useCollectionStore()
const { requireAuth } = useAuthGuard()

onShow(() => {
  if (!requireAuth()) return
  collectionStore.fetchCollections()
})

function formatAuthors(authors: string[] | null): string {
  if (!authors?.length) return ''
  if (authors.length <= 3) return authors.join(', ')
  return authors.slice(0, 3).join(', ') + ' et al.'
}

function goToDetail(item: UserCollection) {
  uni.navigateTo({ url: `/pages/detail/index?id=${item.document_id}` })
}

function goToSearch() {
  uni.switchTab({ url: '/pages/search/index' })
}

function goHome() {
  uni.switchTab({ url: '/pages/home/index' })
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

.loading {
  text-align: center;
  padding: 60px 24px;
}

.loading-text {
  font-size: 14px;
  color: #999;
}

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

.nav-back {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 999;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}

.nav-back-icon {
  font-size: 22px;
  color: #333;
  line-height: 1;
}
</style>
