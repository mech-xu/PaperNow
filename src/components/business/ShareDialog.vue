<template>
  <view
    v-if="visible"
    class="share-overlay"
    @tap="close"
  >
    <view
      class="share-dialog"
      @tap.stop
    >
      <text class="dialog-title">分享</text>

      <!-- Folder Name -->
      <text class="folder-name">{{ folderName }}</text>

      <!-- Share Link -->
      <view
        v-if="shareLink"
        class="share-link-section"
      >
        <text class="link-label">分享链接</text>
        <view class="link-box">
          <text class="link-text">{{ shareLink }}</text>
        </view>
        <button
          class="btn btn-primary"
          @tap="handleCopy"
        >
          {{ clipboard.copied.value ? '已复制!' : '复制链接' }}
        </button>
      </view>

      <!-- Generate Link -->
      <view
        v-else
        class="generate-section"
      >
        <button
          class="btn btn-primary"
          :disabled="isGenerating"
          @tap="handleGenerate"
        >
          {{ isGenerating ? '生成中...' : '生成分享链接' }}
        </button>
      </view>

      <!-- Close -->
      <text
        class="close-btn"
        @tap="close"
      >
        关闭
      </text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useClipboard } from '@/composables/useClipboard'
import { appConfig } from '@/config/app'

const props = defineProps<{
  visible: boolean
  folderId: string
  folderName: string
  shareToken: string | null
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  generate: [folderId: string]
}>()

const clipboard = useClipboard()
const isGenerating = ref(false)

const shareLink = computed(() => {
  if (!props.shareToken) return ''
  return `${appConfig.baseUrl}/pages/collaboration/index?token=${props.shareToken}`
})

async function handleCopy() {
  if (shareLink.value) {
    await clipboard.copy(shareLink.value)
  }
}

async function handleGenerate() {
  isGenerating.value = true
  try {
    emit('generate', props.folderId)
  } finally {
    isGenerating.value = false
  }
}

function close() {
  emit('update:visible', false)
}
</script>

<style scoped>
.share-overlay {
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

.share-dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 8px;
}

.folder-name {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 16px;
}

.share-link-section {
  margin-bottom: 16px;
}

.link-label {
  font-size: 13px;
  color: #666;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.link-box {
  background: #f5f5f5;
  border-radius: 8px;
  padding: 10px 12px;
  margin-bottom: 12px;
  word-break: break-all;
}

.link-text {
  font-size: 12px;
  color: #333;
}

.generate-section {
  margin-bottom: 16px;
}

.btn {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  font-size: 15px;
  font-weight: 500;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background: #0066cc;
  color: #fff;
}

.btn-primary[disabled] {
  background: #93c5fd;
  color: #fff;
}

.close-btn {
  display: block;
  text-align: center;
  font-size: 14px;
  color: #666;
  padding-top: 12px;
  border-top: 1px solid #f0f0f0;
}
</style>
