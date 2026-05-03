<template>
  <view class="filter-panel">
    <!-- Date Range -->
    <view class="filter-section">
      <text class="section-label">时间范围</text>
      <view class="date-range">
        <input
          type="text"
          :value="localDateFrom"
          placeholder="起始 (YYYY-MM-DD)"
          class="date-input"
          @input="handleDateFrom($event as any)"
        >
        <text class="date-sep">—</text>
        <input
          type="text"
          :value="localDateTo"
          placeholder="截止 (YYYY-MM-DD)"
          class="date-input"
          @input="handleDateTo($event as any)"
        >
      </view>
    </view>

    <!-- Sort -->
    <view class="filter-section">
      <text class="section-label">排序</text>
      <view class="chip-list">
        <view
          v-for="opt in sortOptions"
          :key="opt.value"
          class="chip"
          :class="{ active: currentSort === opt.value }"
          @tap="handleSort(opt.value)"
        >
          <text class="chip-text">{{ opt.label }}</text>
        </view>
      </view>
    </view>

    <!-- Reset -->
    <view class="filter-actions">
      <text class="reset-btn" @tap="handleReset">重置筛选</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { SortOption } from '@/types'

const props = defineProps<{
  dateFrom: string | null
  dateTo: string | null
  sortBy: SortOption
}>()

const emit = defineEmits<{
  'update:dateFrom': [value: string | null]
  'update:dateTo': [value: string | null]
  'update:sortBy': [value: SortOption]
  reset: []
}>()

const sortOptions: { label: string; value: SortOption }[] = [
  { label: '相关性', value: 'relevance' },
  { label: '最新', value: 'time' },
  { label: '引用量', value: 'citations' },
]

const localDateFrom = ref(props.dateFrom || '')
const localDateTo = ref(props.dateTo || '')
const currentSort = ref<SortOption>(props.sortBy)

function handleDateFrom(e: any) {
  const val = e?.detail?.value || ''
  localDateFrom.value = val
  emit('update:dateFrom', val || null)
}

function handleDateTo(e: any) {
  const val = e?.detail?.value || ''
  localDateTo.value = val
  emit('update:dateTo', val || null)
}

function handleSort(value: SortOption) {
  currentSort.value = value
  emit('update:sortBy', value)
}

function handleReset() {
  localDateFrom.value = ''
  localDateTo.value = ''
  currentSort.value = 'relevance'
  emit('update:dateFrom', null)
  emit('update:dateTo', null)
  emit('update:sortBy', 'relevance')
  emit('reset')
}

// Sync props changes
watch(() => props.sortBy, (val) => {
  currentSort.value = val
})
</script>

<style scoped>
.filter-panel {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.filter-section {
  margin-bottom: 16px;
}

.section-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.chip-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 6px 12px;
  border-radius: 16px;
  background: #f0f0f0;
  font-size: 13px;
}

.chip.active {
  background: #0066cc;
}

.chip-text {
  color: #333;
}

.chip.active .chip-text {
  color: #fff;
}

.date-range {
  display: flex;
  align-items: center;
  gap: 8px;
}

.date-input {
  flex: 1;
  height: 36px;
  border: 1px solid #e2e2e2;
  border-radius: 8px;
  padding: 0 8px;
  font-size: 13px;
  background: #fafafa;
}

.date-sep {
  color: #999;
  font-size: 13px;
}

.filter-actions {
  text-align: center;
  padding-top: 8px;
  border-top: 1px solid #f0f0f0;
}

.reset-btn {
  font-size: 13px;
  color: #e53e3e;
}
</style>
