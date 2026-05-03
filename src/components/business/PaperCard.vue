<template>
  <view
    class="paper-card"
    @tap="handleTap"
  >
    <!-- Title -->
    <text class="title">{{ document.title }}</text>

    <!-- Authors -->
    <text
      v-if="document.authors?.length"
      class="authors"
    >
      {{ displayAuthors }}
    </text>

    <!-- Abstract (truncated) -->
    <text
      v-if="document.abstract"
      class="abstract"
    >
      {{ truncatedAbstract }}
    </text>

    <!-- Meta row -->
    <view class="meta">
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

    <!-- Actions -->
    <view class="actions">
      <text
        class="action-btn"
        :class="{ collected: collected }"
        @tap.stop="handleCollect"
      >
        {{ collected ? '★ 已收藏' : '☆ 收藏' }}
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Document } from '@/types'
import { useAuthStore } from '@/stores/auth'
import { useCollectionStore } from '@/stores/collection'

const props = defineProps<{
  document: Document
  isCollected?: boolean
}>()

const emit = defineEmits<{
  tap: [document: Document]
  collect: [document: Document]
}>()

const auth = useAuthStore()
const collectionStore = useCollectionStore()

// 优先使用 prop，否则从 store 检查
const collected = computed(() => {
  if (props.isCollected !== undefined) return props.isCollected
  return collectionStore.isCollected(props.document.id)
})

const displayAuthors = computed(() => {
  if (!props.document.authors?.length) return ''
  const authors = props.document.authors
  if (authors.length <= 3) return authors.join(', ')
  return authors.slice(0, 3).join(', ') + ' et al.'
})

const truncatedAbstract = computed(() => {
  if (!props.document.abstract) return ''
  const maxLen = 200
  if (props.document.abstract.length <= maxLen) return props.document.abstract
  return props.document.abstract.slice(0, maxLen) + '...'
})

function handleTap() {
  emit('tap', props.document)
}

async function handleCollect() {
  if (!auth.isAuthenticated) {
    uni.navigateTo({ url: '/pages/auth/login' })
    return
  }

  try {
    await collectionStore.toggleCollection(props.document.id)
  } catch {
    // Fallback to emit if store operation fails
    emit('collect', props.document)
  }
}
</script>

<style scoped>
.paper-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}

.title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.4;
  display: block;
  margin-bottom: 6px;
}

.authors {
  font-size: 13px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.abstract {
  font-size: 14px;
  color: #444;
  line-height: 1.5;
  display: block;
  margin-bottom: 10px;
}

.meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.source-badge {
  font-size: 11px;
  color: #0066cc;
  background: #e6f0ff;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.date {
  font-size: 12px;
  color: #999;
}

.citations {
  font-size: 12px;
  color: #999;
}

.actions {
  display: flex;
  justify-content: flex-end;
}

.action-btn {
  font-size: 13px;
  color: #999;
  padding: 4px 8px;
}

.action-btn.collected {
  color: #f59e0b;
}
</style>
