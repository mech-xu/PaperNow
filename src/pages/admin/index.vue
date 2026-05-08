<template>
  <view class="admin-page">
    <view class="nav-back" @tap="goHome">
      <text class="nav-back-icon">‹</text>
    </view>

    <view class="container">
      <text class="title">系统管理</text>

      <!-- Tabs -->
      <view class="tabs">
        <text
          class="tab"
          :class="{ active: activeTab === 'users' }"
          @tap="activeTab = 'users'"
        >用户管理</text>
        <text
          class="tab"
          :class="{ active: activeTab === 'cache' }"
          @tap="activeTab = 'cache'"
        >缓存管理</text>
      </view>

      <!-- Users Tab -->
      <view v-if="activeTab === 'users'" class="tab-content">
        <button class="btn btn-primary" @tap="loadUsers" :disabled="isLoading">
          {{ isLoading ? '加载中...' : '刷新用户列表' }}
        </button>

        <text v-if="loadError" class="error-text">{{ loadError }}</text>

        <view v-if="users.length" class="user-list">
          <view v-for="user in users" :key="user.id" class="user-card">
            <view class="user-info">
              <text class="user-name">{{ user.display_name || '未设置' }}</text>
              <text class="user-email">{{ user.email }}</text>
              <text class="user-meta">收藏: {{ user.collection_count }} | 注册: {{ formatDate(user.created_at) }}</text>
            </view>
            <button
              class="btn-delete"
              @tap="handleDeleteUser(user)"
            >删除</button>
          </view>
        </view>

        <text v-else-if="!isLoading" class="empty-text">暂无用户数据</text>
      </view>

      <!-- Cache Tab -->
      <view v-if="activeTab === 'cache'" class="tab-content">
        <view class="cache-stats">
          <text class="stats-label">KV 缓存键数量</text>
          <text class="stats-value">{{ cacheKeyCount }}</text>
        </view>

        <button class="btn btn-primary" @tap="loadCacheStats" :disabled="isLoading">
          刷新统计
        </button>

        <button class="btn btn-danger" @tap="handlePurgeCache" :disabled="isLoading">
          {{ isPurging ? '清理中...' : '清理全部缓存' }}
        </button>

        <text v-if="cacheMessage" class="success-text">{{ cacheMessage }}</text>
        <text v-if="loadError" class="error-text">{{ loadError }}</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const API_BASE = 'https://api.papernow.sunnynow.net/v1'
const ADMIN_AUTH = `Basic ${btoa('admin:admin')}`

const activeTab = ref('users')
const isLoading = ref(false)
const loadError = ref('')
const users = ref<any[]>([])
const cacheKeyCount = ref(0)
const isPurging = ref(false)
const cacheMessage = ref('')

async function apiFetch(path: string, options?: RequestInit) {
  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': ADMIN_AUTH,
      'Content-Type': 'application/json',
      ...(options?.headers || {}),
    },
  })
}

async function loadUsers() {
  isLoading.value = true
  loadError.value = ''
  try {
    const res = await apiFetch('/admin/users')
    if (!res.ok) throw new Error(`Failed: ${res.status}`)
    const data = await res.json()
    users.value = data.users || []
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

async function handleDeleteUser(user: any) {
  const confirmed = confirm(`确定删除用户 ${user.display_name || user.email}？此操作不可撤销。`)
  if (!confirmed) return

  try {
    const res = await apiFetch(`/admin/users/${user.id}`, { method: 'DELETE' })
    if (!res.ok) throw new Error(`Failed: ${res.status}`)
    users.value = users.value.filter(u => u.id !== user.id)
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  }
}

async function loadCacheStats() {
  isLoading.value = true
  loadError.value = ''
  try {
    const res = await apiFetch('/admin/cache/stats')
    if (!res.ok) throw new Error(`Failed: ${res.status}`)
    const data = await res.json()
    cacheKeyCount.value = data.keyCount || 0
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isLoading.value = false
  }
}

async function handlePurgeCache() {
  const confirmed = confirm('确定清理全部缓存？这会删除所有 KV 缓存数据。')
  if (!confirmed) return

  isPurging.value = true
  loadError.value = ''
  cacheMessage.value = ''
  try {
    const res = await apiFetch('/admin/cache/purge', { method: 'POST' })
    if (!res.ok) throw new Error(`Failed: ${res.status}`)
    const data = await res.json()
    cacheMessage.value = `已清理 ${data.deleted} 个缓存键`
    cacheKeyCount.value = 0
  } catch (err) {
    loadError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isPurging.value = false
  }
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('zh-CN')
}

function goHome() { uni.switchTab({ url: '/pages/home/index' }) }

// Auto-load on mount
loadUsers()
loadCacheStats()
</script>

<style scoped>
.admin-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 16px;
}

.title {
  font-size: 24px;
  font-weight: 700;
  color: #333;
  display: block;
  margin-bottom: 20px;
}

.tabs {
  display: flex;
  gap: 0;
  margin-bottom: 20px;
  border-bottom: 2px solid #e5e5e5;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 12px 0;
  font-size: 16px;
  color: #666;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
}

.tab.active {
  color: #0066cc;
  border-bottom-color: #0066cc;
  font-weight: 600;
}

.tab-content {
  background: #fff;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.btn {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 12px;
}

.btn-primary {
  background: #0066cc;
  color: #fff;
}

.btn-primary[disabled] {
  background: #93c5fd;
}

.btn-danger {
  background: #e53e3e;
  color: #fff;
}

.user-list {
  margin-top: 16px;
}

.user-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 8px;
  margin-bottom: 8px;
}

.user-info {
  flex: 1;
}

.user-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  display: block;
}

.user-email {
  font-size: 13px;
  color: #666;
  display: block;
}

.user-meta {
  font-size: 12px;
  color: #999;
  display: block;
  margin-top: 4px;
}

.btn-delete {
  background: #e53e3e;
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 6px 12px;
  font-size: 13px;
}

.cache-stats {
  text-align: center;
  padding: 20px;
  margin-bottom: 16px;
  background: #f8f9fa;
  border-radius: 8px;
}

.stats-label {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.stats-value {
  font-size: 36px;
  font-weight: 700;
  color: #0066cc;
  display: block;
}

.empty-text {
  text-align: center;
  color: #999;
  display: block;
  padding: 20px;
}

.error-text {
  font-size: 12px;
  color: #e53e3e;
  display: block;
  margin-top: 8px;
  text-align: center;
}

.success-text {
  font-size: 12px;
  color: #38a169;
  display: block;
  margin-top: 8px;
  text-align: center;
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
