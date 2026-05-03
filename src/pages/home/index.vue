<template>
  <view class="home-page">
    <!-- Header -->
    <view class="header">
      <text class="logo">
        PaperNow
      </text>
      <text class="subtitle">
        预印本文献管理与协作平台
      </text>
    </view>

    <!-- Search Entry -->
    <view
      class="search-entry"
      @tap="goToSearch"
    >
      <text class="search-placeholder">
        搜索论文、预印本...
      </text>
    </view>

    <!-- Quick Actions -->
    <view class="actions">
      <view
        class="action-card"
        @tap="goToSearch"
      >
        <text class="action-icon">
          🔍
        </text>
        <text class="action-label">
          搜索文献
        </text>
      </view>
      <view
        class="action-card"
        @tap="goToCollection"
      >
        <text class="action-icon">
          📚
        </text>
        <text class="action-label">
          我的收藏
        </text>
      </view>
      <view
        class="action-card"
        @tap="goToCollaboration"
      >
        <text class="action-icon">
          👥
        </text>
        <text class="action-label">
          协作空间
        </text>
      </view>
    </view>

    <!-- Sources -->
    <view class="sources">
      <text class="section-title">
        数据来源
      </text>
      <view class="source-list">
        <view
          v-for="source in sources"
          :key="source.name"
          class="source-item"
        >
          <text class="source-name">
            {{ source.name }}
          </text>
          <text class="source-desc">
            {{ source.desc }}
          </text>
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
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const sources = [
  { name: 'arXiv', desc: '物理/数学/CS' },
  { name: 'PubMed', desc: '生物医学' },
  { name: 'ChinaRxiv', desc: '中文预印本翻译' },
  { name: 'bioRxiv', desc: '生物学预印本' },
  { name: 'medRxiv', desc: '医学预印本' },
]

function goToSearch() {
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

.search-entry {
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.search-placeholder {
  color: #999;
  font-size: 16px;
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
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.source-item:last-child {
  border-bottom: none;
}

.source-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}

.source-desc {
  font-size: 12px;
  color: #999;
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
