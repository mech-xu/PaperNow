<template>
  <view class="callback-page">
    <view class="loading">
      <text class="loading-text">{{ statusText }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const statusText = ref('正在完成登录...')

let timeoutId: ReturnType<typeof setTimeout> | null = null
let subscription: { unsubscribe: () => void } | null = null
let handled = false

function handleSuccess() {
  if (handled) return
  handled = true
  statusText.value = '登录成功，正在跳转...'
  uni.switchTab({
    url: '/pages/home/index',
    fail: () => {
      // switchTab failed, try redirectTo as fallback
      uni.redirectTo({ url: '/pages/home/index' })
    },
  })
}

function handleFailure(msg?: string) {
  if (handled) return
  handled = true
  statusText.value = msg || '登录失败，正在返回...'
  setTimeout(() => {
    uni.redirectTo({ url: '/pages/auth/login' })
  }, 1500)
}

onMounted(async () => {
  try {
    // Timeout: if OAuth callback doesn't complete in 15s, fail
    timeoutId = setTimeout(() => {
      handleFailure('登录超时，请重试')
    }, 15000)

    // Listen for auth state changes from OAuth callback
    // detectSessionInUrl: true will parse the URL hash and fire an event
    // The event can be INITIAL_SESSION (if session found in URL) or SIGNED_IN
    const { data } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'INITIAL_SESSION') && session?.user) {
        try {
          await auth.initialize()
          if (auth.isAuthenticated) {
            handleSuccess()
          } else {
            handleFailure('认证信息不完整')
          }
        } catch {
          handleFailure('获取用户信息失败')
        }
      }
    })
    subscription = data.subscription

    // Also check if session already exists (e.g. user refreshed the page)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user && !handled) {
      try {
        await auth.initialize()
        if (auth.isAuthenticated) {
          handleSuccess()
        }
      } catch {
        // Will rely on onAuthStateChange or timeout
      }
    }
  } catch {
    handleFailure('登录过程出错')
  }
})

onUnmounted(() => {
  subscription?.unsubscribe()
  if (timeoutId) clearTimeout(timeoutId)
})
</script>

<style scoped>
.callback-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
}

.loading {
  text-align: center;
}

.loading-text {
  font-size: 16px;
  color: #666;
}
</style>
