<template>
  <view class="home-page">
    <!-- Header -->
    <view class="header">
      <text class="logo">PaperNow</text>
      <text class="subtitle">预印本文献搜索与收藏平台</text>
    </view>

    <!-- Source Cards -->
    <view class="sources">
      <text class="section-title">数据来源</text>
      <view class="source-list">
        <view
          v-for="source in availableSources"
          :key="source.name"
          class="source-card"
          @tap="goToSearch(source.name)"
        >
          <text class="source-icon">{{ source.icon }}</text>
          <view class="source-info">
            <text class="source-name">{{ source.name }}</text>
            <text class="source-desc">{{ source.desc }}</text>
          </view>
          <text class="source-arrow">›</text>
        </view>
      </view>
    </view>

    <!-- Disclaimer -->
    <view class="disclaimer">
      <text class="disclaimer-title">免责声明</text>
      <text class="disclaimer-text">
        PaperNow 仅提供预印本文献的搜索与收藏服务，不存储、不修改、不翻译任何原文内容。所有文献版权归原作者和发布平台所有。搜索结果中的摘要、标题等信息均来自各数据源公开 API，PDF 链接指向原始发布平台。本平台不对文献内容的准确性、完整性或时效性负责。
      </text>
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
import { useSearchStore } from '@/stores/search'
import type { SupportedSource } from '@/types'

const auth = useAuthStore()
const searchStore = useSearchStore()

const availableSources: { name: SupportedSource; icon: string; desc: string }[] = [
  { name: 'arXiv', icon: '📐', desc: '物理 / 数学 / 计算机科学' },
  { name: 'PubMed', icon: '🧬', desc: '生物医学文献数据库' },
  { name: 'ChinaRxiv', icon: '🇨🇳', desc: '中文预印本翻译' },
  { name: 'bioRxiv', icon: '🧪', desc: '生物学预印本' },
  { name: 'medRxiv', icon: '💊', desc: '医学预印本' },
]

function goToSearch(source: SupportedSource) {
  searchStore.selectedSource = source
  searchStore.results = []
  searchStore.query = ''
  searchStore.error = null
  uni.switchTab({ url: '/pages/search/index' })
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

.source-card {
  display: flex;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.source-card:last-child {
  border-bottom: none;
}

.source-card:active {
  background-color: #f0f7ff;
}

.source-icon {
  font-size: 24px;
  margin-right: 12px;
}

.source-info {
  flex: 1;
}

.source-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  display: block;
}

.source-desc {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
  display: block;
}

.source-arrow {
  font-size: 20px;
  color: #ccc;
  margin-left: 8px;
}

.disclaimer {
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 24px;
}

.disclaimer-title {
  font-size: 13px;
  font-weight: 600;
  color: #92400e;
  display: block;
  margin-bottom: 6px;
}

.disclaimer-text {
  font-size: 12px;
  color: #78350f;
  line-height: 1.6;
  display: block;
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
