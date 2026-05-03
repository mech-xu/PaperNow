<template>
  <view
    class="tag-chip"
    :class="{ selected: isSelected, 'filter-mode': mode === 'filter' }"
    :style="{ backgroundColor: mode === 'filter' && isSelected ? tag.color : 'transparent', borderColor: tag.color }"
    @tap="handleTap"
    @longpress="handleLongPress"
  >
    <text
      class="tag-name"
      :style="{ color: mode === 'filter' && isSelected ? '#fff' : tag.color }"
    >
      {{ tag.name }}
    </text>
    <text
      v-if="showCount && tagCount > 0"
      class="tag-count"
      :style="{ color: mode === 'filter' && isSelected ? 'rgba(255,255,255,0.8)' : '#999' }"
    >
      {{ tagCount }}
    </text>
  </view>

  <!-- Delete Confirmation Dialog -->
  <view
    v-if="showDeleteConfirm"
    class="confirm-overlay"
    @tap="showDeleteConfirm = false"
  >
    <view
      class="confirm-dialog"
      @tap.stop
    >
      <text class="confirm-title">删除标签</text>
      <text class="confirm-message">确定删除标签「{{ tag.name }}」吗？关联的文献将取消此标签。</text>
      <view class="confirm-actions">
        <text
          class="confirm-btn cancel"
          @tap="showDeleteConfirm = false"
        >
          取消
        </text>
        <text
          class="confirm-btn delete"
          @tap="handleDelete"
        >
          删除
        </text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { UserTag } from '@/types'

const props = withDefaults(defineProps<{
  tag: UserTag
  isSelected?: boolean
  tagCount?: number
  mode?: 'filter' | 'display'
  showCount?: boolean
  deletable?: boolean
}>(), {
  isSelected: false,
  tagCount: 0,
  mode: 'display',
  showCount: false,
  deletable: true,
})

const emit = defineEmits<{
  tap: [tag: UserTag]
  delete: [tagId: string]
}>()

const showDeleteConfirm = ref(false)

function handleTap() {
  emit('tap', props.tag)
}

function handleLongPress() {
  if (props.deletable && props.mode === 'display') {
    showDeleteConfirm.value = true
  }
}

function handleDelete() {
  showDeleteConfirm.value = false
  emit('delete', props.tag.id)
}
</script>

<style scoped>
.tag-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 12px;
  border: 1px solid;
  font-size: 12px;
  line-height: 1;
}

.tag-chip.filter-mode {
  cursor: pointer;
  transition: all 0.15s ease;
}

.tag-chip.filter-mode:active {
  opacity: 0.7;
}

.tag-name {
  font-weight: 500;
}

.tag-count {
  font-size: 10px;
  font-weight: 400;
}

.confirm-overlay {
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

.confirm-dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 80%;
  max-width: 320px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.confirm-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 8px;
}

.confirm-message {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 20px;
  line-height: 1.5;
}

.confirm-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.confirm-btn {
  font-size: 14px;
  font-weight: 500;
  padding: 8px 16px;
  border-radius: 8px;
}

.confirm-btn.cancel {
  color: #666;
  background: #f0f0f0;
}

.confirm-btn.delete {
  color: #fff;
  background: #e53e3e;
}
</style>
