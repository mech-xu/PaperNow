<template>
  <view class="callback-page">
    <view class="loading">
      <text class="loading-text">正在完成登录...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
let timeoutId: ReturnType<typeof setTimeout> | null = null
let handled = false

function handleSuccess() {
  if (handled) return
  handled = true
  uni.switchTab({ url: '/pages/home/index' })
}

function handleFailure() {
  if (handled) return
  handled = true
  uni.redirectTo({ url: '/pages/auth/login' })
}

onMounted(async () => {
  try {
    // Set a timeout in case OAuth callback takes too long
    timeoutId = setTimeout(() => {
      handleFailure()
    }, 10000)

    // Listen for the SIGNED_IN event from OAuth callback
    // detectSessionInUrl: true will parse the hash fragment and fire this event
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        await auth.initialize()
        if (auth.isAuthenticated) {
          handleSuccess()
        } else {
          handleFailure()
        }
      }
    })

    // Also check if session already exists (e.g. user refreshed the page)
    const { data: { session } } = await supabase.auth.getSession()
    if (session?.user) {
      await auth.initialize()
      if (auth.isAuthenticated) {
        handleSuccess()
        return
      }
    }

    // Clean up subscription on unmount
    onUnmounted(() => {
      subscription.unsubscribe()
      if (timeoutId) clearTimeout(timeoutId)
    })
  } catch (_err) {
    handleFailure()
  }
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
