<template>
  <view class="search-bar">
    <view class="input-wrapper">
      <text class="icon">🔍</text>
      <input
        ref="inputRef"
        v-model="localQuery"
        type="text"
        :placeholder="placeholder"
        class="input"
        :disabled="isDisabled"
        confirm-type="search"
        @confirm="handleSubmit"
        @input="handleInput"
      >
      <text
        v-if="localQuery && !isDisabled"
        class="clear-btn"
        @tap="handleClear"
      >
        ✕
      </text>
    </view>
    <text
      v-if="showSearchBtn"
      class="search-btn"
      :class="{ disabled: isDisabled || !localQuery.trim() }"
      @tap="handleSubmit"
    >
      搜索
    </text>
  </view>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useDebounce } from '@/composables/useDebounce'

const props = withDefaults(defineProps<{
  modelValue: string
  placeholder?: string
  isDisabled?: boolean
  showSearchBtn?: boolean
  debounceDelay?: number
}>(), {
  placeholder: '搜索论文、预印本...',
  isDisabled: false,
  showSearchBtn: true,
  debounceDelay: 300,
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  search: [query: string]
}>()

const localQuery = ref(props.modelValue)
const inputRef = ref<HTMLElement | null>(null)

// 防抖输入
const { debouncedFn } = useDebounce((val: unknown) => {
  emit('update:modelValue', val as string)
}, props.debounceDelay)

function handleInput() {
  debouncedFn(localQuery.value)
}

function handleSubmit() {
  if (!localQuery.value.trim() || props.isDisabled) return
  emit('update:modelValue', localQuery.value.trim())
  emit('search', localQuery.value.trim())
}

function handleClear() {
  localQuery.value = ''
  emit('update:modelValue', '')
}

// 外部值变化时同步
watch(() => props.modelValue, (val) => {
  if (val !== localQuery.value) {
    localQuery.value = val
  }
})
</script>

<style scoped>
.search-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
}

.input-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  background: #fff;
  border: 1px solid #e2e2e2;
  border-radius: 12px;
  padding: 0 12px;
  height: 44px;
}

.icon {
  font-size: 16px;
  margin-right: 8px;
  flex-shrink: 0;
}

.input {
  flex: 1;
  height: 44px;
  font-size: 16px;
  border: none;
  background: transparent;
  outline: none;
}

.clear-btn {
  font-size: 14px;
  color: #999;
  padding: 4px 8px;
  flex-shrink: 0;
}

.search-btn {
  flex-shrink: 0;
  background: #0066cc;
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  padding: 0 16px;
  height: 44px;
  line-height: 44px;
  border-radius: 8px;
}

.search-btn.disabled {
  background: #93c5fd;
}
</style>
