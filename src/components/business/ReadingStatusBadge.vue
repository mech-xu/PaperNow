<template>
  <view
    class="reading-status-badge"
    :class="statusClass"
    @tap="handleTap"
  >
    <text class="status-icon">{{ statusIcon }}</text>
    <text class="status-text">{{ statusLabel }}</text>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { ReadingStatus } from '@/types'

const props = defineProps<{
  status: ReadingStatus
  compact?: boolean
}>()

const emit = defineEmits<{
  change: [status: ReadingStatus]
}>()

const STATUS_CYCLE: ReadingStatus[] = ['unread', 'reading', 'read']

const STATUS_CONFIG: Record<ReadingStatus, { icon: string; label: string; class: string }> = {
  unread: { icon: '○', label: '未读', class: 'status-unread' },
  reading: { icon: '◐', label: '在读', class: 'status-reading' },
  read: { icon: '●', label: '已读', class: 'status-read' },
}

const statusIcon = computed(() => STATUS_CONFIG[props.status].icon)
const statusLabel = computed(() => props.compact ? '' : STATUS_CONFIG[props.status].label)
const statusClass = computed(() => STATUS_CONFIG[props.status].class)

function handleTap() {
  const currentIndex = STATUS_CYCLE.indexOf(props.status)
  const nextStatus = STATUS_CYCLE[(currentIndex + 1) % STATUS_CYCLE.length]
  emit('change', nextStatus)
}
</script>

<style scoped>
.reading-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s ease;
}

.reading-status-badge:active {
  opacity: 0.7;
}

.status-icon {
  font-size: 10px;
}

.status-text {
  font-weight: 500;
}

/* Unread: gray */
.status-unread {
  background: #f0f0f0;
  color: #999;
}

/* Reading: blue */
.status-reading {
  background: #e6f0ff;
  color: #0066cc;
}

/* Read: green */
.status-read {
  background: #e6f9e6;
  color: #38a169;
}
</style>
