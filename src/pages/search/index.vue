<template>
  <view class="search-page">
    <!-- Back to Home -->
    <view class="nav-back" @tap="goHome">
      <text class="nav-back-icon">‹</text>
    </view>

    <!-- Search Bar -->
    <SearchBar
      v-model="searchStore.query"
      :is-disabled="searchStore.isLoading"
      @search="handleSearch"
    />

    <!-- Filter Toggle -->
    <view class="filter-toggle">
      <text
        class="toggle-btn"
        :class="{ active: showFilters }"
        @tap="showFilters = !showFilters"
      >
        {{ showFilters ? '收起筛选' : '筛选' }}
      </text>
      <text
        v-if="hasActiveFilters"
        class="filter-indicator"
      >
        ●
      </text>
    </view>

    <!-- Filter Panel -->
    <view
      v-if="showFilters"
      class="filter-container"
    >
      <FilterPanel
        :date-from="searchStore.dateFrom"
        :date-to="searchStore.dateTo"
        :sort-by="searchStore.sortBy"
        @update:date-from="handleFilterChange('dateFrom', $event)"
        @update:date-to="handleFilterChange('dateTo', $event)"
        @update:sort-by="handleFilterChange('sortBy', $event)"
        @reset="handleResetFilters"
      />
    </view>

    <!-- Results -->
    <view class="results-container">
      <!-- Empty State (no search yet) -->
      <view
        v-if="!searchStore.query && searchStore.results.length === 0"
        class="empty-state"
      >
        <text class="empty-icon">🔍</text>
        <text class="empty-text">输入关键词搜索预印本文献</text>
      </view>

      <!-- Error -->
      <view
        v-if="searchStore.error"
        class="error-state"
      >
        <text class="error-text">{{ searchStore.error }}</text>
      </view>

      <!-- No Results -->
      <view
        v-else-if="!searchStore.isLoading && searchStore.results.length === 0 && searchStore.query"
        class="empty-state"
      >
        <text class="empty-icon">📭</text>
        <text class="empty-text">未找到相关文献</text>
        <text class="empty-hint">尝试使用不同的关键词或调整筛选条件</text>
      </view>

      <!-- Loading (initial) -->
      <view
        v-if="searchStore.isLoading && searchStore.results.length === 0"
        class="loading-initial"
      >
        <text class="loading-text">搜索中...</text>
      </view>

      <!-- Result List (hide during initial load to prevent jitter) -->
      <view
        v-if="!searchStore.isLoading || searchStore.results.length > 0"
      >
        <view
          v-for="doc in searchStore.results"
          :key="doc.id"
        >
          <PaperCard
            :document="doc"
            @click="goToDetail(doc)"
          />
        </view>
      </view>

      <!-- Load More Sentinel (Intersection Observer) -->
      <view
        v-if="searchStore.hasMore && !searchStore.isLoading"
        ref="sentinelRef"
        class="load-more-sentinel"
      />

      <!-- Loading More -->
      <view
        v-if="searchStore.isLoading && searchStore.results.length > 0"
        class="loading"
      >
        <text class="loading-text">加载更多...</text>
      </view>

      <!-- No More -->
      <view
        v-if="!searchStore.hasMore && searchStore.results.length > 0"
        class="no-more"
      >
        <text class="no-more-text">没有更多结果了</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useSearchStore } from '@/stores/search'
import SearchBar from '@/components/common/SearchBar.vue'
import FilterPanel from '@/components/common/FilterPanel.vue'
import PaperCard from '@/components/business/PaperCard.vue'
import type { Document, SortOption } from '@/types'

const searchStore = useSearchStore()
const showFilters = ref(false)

// Update navigation bar title to show selected source
watch(() => searchStore.selectedSource, (source) => {
  const title = source ? `Search - ${source}` : 'Search'
  uni.setNavigationBarTitle({ title })
}, { immediate: true })

// Infinite scroll with Intersection Observer
const sentinelRef = ref<HTMLElement | null>(null)
let observer: IntersectionObserver | null = null

onMounted(() => {
  observer = new IntersectionObserver(
    (entries) => {
      const entry = entries[0]
      if (entry?.isIntersecting && searchStore.hasMore && !searchStore.isLoading) {
        searchStore.loadMore()
      }
    },
    { rootMargin: '200px', threshold: 0 },
  )
})

onUnmounted(() => {
  observer?.disconnect()
})

// Watch sentinel ref to connect observer
watch(sentinelRef, (el) => {
  if (observer) {
    observer.disconnect()
    // UniApp H5: ref may return a non-Element wrapper, get actual DOM element
    const domEl = (el as any)?.$el ?? el
    if (domEl instanceof Element) {
      observer.observe(domEl)
    }
  }
})

const hasActiveFilters = computed(() => {
  return searchStore.dateFrom !== null
    || searchStore.dateTo !== null
    || searchStore.sortBy !== 'relevance'
})

function handleSearch(query: string) {
  if (!query.trim()) return
  searchStore.search(query)
}

function handleFilterChange(filter: string, value: unknown) {
  switch (filter) {
    case 'dateFrom':
      searchStore.dateFrom = value as string | null
      break
    case 'dateTo':
      searchStore.dateTo = value as string | null
      break
    case 'sortBy':
      searchStore.sortBy = value as SortOption
      break
  }
  // Re-search with new filters if there's a query
  if (searchStore.query) {
    searchStore.search()
  }
}

function handleResetFilters() {
  searchStore.resetFilters()
  if (searchStore.query) {
    searchStore.search()
  }
}

function goToDetail(doc: Document) {
  uni.navigateTo({ url: `/pages/detail/index?id=${doc.id}` })
}

function goHome() {
  uni.switchTab({ url: '/pages/home/index' })
}
</script>

<style scoped>
.search-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 16px;
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

.filter-toggle {
  display: flex;
  align-items: center;
  padding: 8px 16px;
}

.toggle-btn {
  font-size: 13px;
  color: #0066cc;
  font-weight: 500;
}

.toggle-btn.active {
  color: #666;
}

.filter-indicator {
  font-size: 10px;
  color: #0066cc;
  margin-left: 4px;
}

.filter-container {
  padding: 0 16px 12px;
}

.results-container {
  padding: 0 16px;
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
}

.error-state {
  text-align: center;
  padding: 24px 16px;
}

.error-text {
  font-size: 14px;
  color: #dc2626;
}

.loading {
  text-align: center;
  padding: 24px;
}

.loading-initial {
  text-align: center;
  padding: 80px 24px;
  min-height: 200px;
}

.loading-text {
  font-size: 14px;
  color: #999;
}

.load-more {
  text-align: center;
  padding: 16px;
}

.load-more-text {
  font-size: 14px;
  color: #0066cc;
}

.load-more-sentinel {
  height: 1px;
  width: 100%;
}

.no-more {
  text-align: center;
  padding: 16px;
}

.no-more-text {
  font-size: 13px;
  color: #ccc;
}
</style>
