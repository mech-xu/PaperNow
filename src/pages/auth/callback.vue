<template>
  <view class="callback-page">
    <view class="loading">
      <text class="loading-text">正在完成登录...</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

onMounted(async () => {
  try {
    // Supabase Auth 会自动处理 OAuth 回调中的 hash fragment
    // detectSessionInUrl: true 已在 supabase client 配置中启用
    // 等待 auth state 更新
    await auth.initialize()

    if (auth.isAuthenticated) {
      // 登录成功，跳转首页
      uni.switchTab({ url: '/pages/home/index' })
    } else {
      // 登录失败，跳转登录页
      uni.redirectTo({ url: '/pages/auth/login' })
    }
  } catch (_err) {
    uni.redirectTo({ url: '/pages/auth/login' })
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
