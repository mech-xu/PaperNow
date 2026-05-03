<template>
  <view
    class="folder-card"
    @tap="handleTap"
  >
    <!-- Header -->
    <view class="folder-header">
      <text class="folder-icon">📁</text>
      <view class="folder-info">
        <text class="folder-name">{{ folder.name }}</text>
        <text
          v-if="folder.description"
          class="folder-desc"
        >
          {{ folder.description }}
        </text>
      </view>
      <view
        v-if="folder.is_public"
        class="public-badge"
      >
        <text class="public-text">公开</text>
      </view>
    </view>

    <!-- Meta -->
    <view class="folder-meta">
      <text class="meta-item">
        👥 {{ memberCount }} 成员
      </text>
      <text class="meta-item">
        📄 {{ documentCount }} 文献
      </text>
      <text class="meta-item">
        {{ formatDate(folder.created_at) }}
      </text>
    </view>

    <!-- Actions -->
    <view class="folder-actions">
      <text
        class="action-btn share-btn"
        @tap.stop="handleShare"
      >
        🔗 分享
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import type { CollabFolder } from '@/types'

const props = withDefaults(defineProps<{
  folder: CollabFolder
  memberCount?: number
  documentCount?: number
}>(), {
  memberCount: 0,
  documentCount: 0,
})

const emit = defineEmits<{
  tap: [folder: CollabFolder]
  share: [folder: CollabFolder]
}>()

function handleTap() {
  emit('tap', props.folder)
}

function handleShare() {
  emit('share', props.folder)
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
</script>

<style scoped>
.folder-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  margin-bottom: 12px;
}

.folder-header {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.folder-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.folder-info {
  flex: 1;
  min-width: 0;
}

.folder-name {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  display: block;
  line-height: 1.4;
}

.folder-desc {
  font-size: 12px;
  color: #666;
  display: block;
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.public-badge {
  flex-shrink: 0;
  background: #e6f9e6;
  padding: 2px 8px;
  border-radius: 4px;
}

.public-text {
  font-size: 11px;
  color: #38a169;
  font-weight: 500;
}

.folder-meta {
  display: flex;
  gap: 12px;
  margin-bottom: 8px;
}

.meta-item {
  font-size: 12px;
  color: #999;
}

.folder-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.action-btn {
  font-size: 12px;
  font-weight: 500;
  padding: 4px 8px;
}

.share-btn {
  color: #0066cc;
}
</style>
