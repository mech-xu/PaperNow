<template>
  <view class="home-page">
    <!-- Header -->
    <view class="header">
      <text class="logo">PaperNow</text>
      <text class="subtitle">预印本文献管理与协作平台</text>
    </view>

    <!-- Quick Actions -->
    <view class="actions">
      <view
        class="action-card"
        @tap="goToSearch"
      >
        <text class="action-icon">🔍</text>
        <text class="action-label">搜索文献</text>
      </view>
      <view
        class="action-card"
        @tap="goToCollection"
      >
        <text class="action-icon">📚</text>
        <text class="action-label">我的收藏</text>
      </view>
      <view
        class="action-card"
        @tap="goToCollaboration"
      >
        <text class="action-icon">👥</text>
        <text class="action-label">协作空间</text>
      </view>
    </view>

    <!-- Source Selector -->
    <view class="sources">
      <text class="section-title">数据来源</text>
      <view class="source-list">
        <view
          v-for="source in availableSources"
          :key="source.name"
          class="source-item"
          :class="{ active: selectedSource === source.name }"
          @tap="selectedSource = source.name"
        >
          <view class="source-info">
            <text class="source-name">{{ source.name }}</text>
            <text class="source-desc">{{ source.desc }}</text>
          </view>
          <view
            class="source-radio"
            :class="{ checked: selectedSource === source.name }"
          >
            <text v-if="selectedSource === source.name" class="radio-dot">●</text>
          </view>
        </view>
      </view>
    </view>

    <!-- Auth Status -->
    <view class="auth-status">
      <text
        v-if="auth.isAuthenticated"
        class="auth-text"
      >
        已登录: {{ auth.displayName }}
      </text>
      <text
        v-else
        class="auth-text auth-text-muted"
        @tap="goToLogin"
      >
        点击登录
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useSearchStore } from '@/stores/search'
import type { SupportedSource } from '@/types'

const auth = useAuthStore()
const searchStore = useSearchStore()

const availableSources: { name: SupportedSource; desc: string }[] = [
  { name: 'PubMed', desc: '生物医学' },
  { name: 'ChinaRxiv', desc: '中文预印本翻译' },
]

const selectedSource = ref<SupportedSource>(searchStore.selectedSource || 'PubMed')

// Sync source selection to searchStore
watch(selectedSource, (val) => {
  searchStore.selectedSource = val
})

function goToSearch() {
  searchStore.selectedSource = selectedSource.value
  uni.switchTab({ url: '/pages/search/index' })
}

function goToCollection() {
  if (!auth.isAuthenticated) {
    uni.navigateTo({ url: '/pages/auth/login' })
    return
  }
  uni.switchTab({ url: '/pages/collection/index' })
}

function goToCollaboration() {
  if (!auth.isAuthenticated) {
    uni.navigateTo({ url: '/pages/auth/login' })
    return
  }
  uni.switchTab({ url: '/pages/collaboration/index' })
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}
</script>

<style scoped>
.home-page {
  min-height: 100vh;
  padding: 24px 16px;
  background-color: #f5f5f5;
}

.header {
  text-align: center;
  margin-bottom: 24px;
}

.logo {
  font-size: 28px;
  font-weight: 700;
  color: #0066cc;
  display: block;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
  display: block;
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
}

.action-card {
  flex: 1;
  background: #fff;
  border-radius: 12px;
  padding: 16px 8px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.action-icon {
  font-size: 24px;
  display: block;
  margin-bottom: 4px;
}

.action-label {
  font-size: 12px;
  color: #333;
  display: block;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 12px;
}

.source-list {
  background: #fff;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 24px;
}

.source-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.source-item:last-child {
  border-bottom: none;
}

.source-item.active {
  background-color: #f0f7ff;
}

.source-info {
  flex: 1;
}

.source-name {
  font-size: 15px;
  font-weight: 500;
  color: #333;
  display: block;
}

.source-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
  display: block;
}

.source-radio {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  border: 2px solid #ccc;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-left: 12px;
}

.source-radio.checked {
  border-color: #0066cc;
}

.radio-dot {
  font-size: 14px;
  color: #0066cc;
  line-height: 1;
}

.auth-status {
  text-align: center;
  padding: 16px;
}

.auth-text {
  font-size: 14px;
  color: #333;
}

.auth-text-muted {
  color: #0066cc;
}
</style>
