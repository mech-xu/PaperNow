<template>
  <view class="login-page">
    <view class="container">
      <!-- Logo & Title -->
      <view class="header">
        <text class="logo">
          PaperNow
        </text>
        <text class="subtitle">
          预印本文献管理与协作平台
        </text>
      </view>

      <!-- Login Form -->
      <view class="form">
        <!-- Email -->
        <view class="form-item">
          <text class="label">
            邮箱
          </text>
          <input
            v-model="email"
            type="text"
            placeholder="your@email.com"
            class="input"
            :disabled="isSubmitting"
            @blur="validateEmail"
          >
          <text
            v-if="emailError"
            class="error-text"
          >
            {{ emailError }}
          </text>
        </view>

        <!-- Password -->
        <view class="form-item">
          <text class="label">
            密码
          </text>
          <input
            v-model="password"
            type="password"
            placeholder="至少 8 个字符"
            class="input"
            :disabled="isSubmitting"
          >
        </view>

        <!-- Error Message -->
        <text
          v-if="authError"
          class="error-text error-center"
        >
          {{ authError }}
        </text>

        <!-- Login Button -->
        <button
          class="btn btn-primary"
          :disabled="isSubmitting || !isFormValid"
          @tap="handleLogin"
        >
          {{ isSubmitting ? '登录中...' : '登录' }}
        </button>

        <!-- Divider -->
        <view class="divider">
          <view class="divider-line" />
          <text class="divider-text">
            或
          </text>
          <view class="divider-line" />
        </view>

        <!-- GitHub OAuth -->
        <button
          class="btn btn-github"
          :disabled="isSubmitting"
          @tap="handleGitHubLogin"
        >
          <text class="btn-github-text">
            使用 GitHub 登录
          </text>
        </button>

        <!-- Register Link -->
        <view class="footer">
          <text class="footer-text">
            没有账户？
          </text>
          <text
            class="link"
            @tap="goToRegister"
          >
            去注册
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const email = ref('')
const password = ref('')
const emailError = ref('')
const authError = ref('')
const isSubmitting = ref(false)
const redirectUrl = ref('')

// 获取来源路径（登录后跳回）
onLoad((query) => {
  if (query?.redirect) {
    redirectUrl.value = decodeURIComponent(query.redirect)
  }
})

const isFormValid = computed(() => {
  return email.value.trim() !== '' && password.value.length >= 8
})

function validateEmail() {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email.value.trim()) {
    emailError.value = '请输入邮箱'
  } else if (!emailRegex.test(email.value)) {
    emailError.value = '请输入有效的邮箱地址'
  } else {
    emailError.value = ''
  }
}

async function handleLogin() {
  validateEmail()
  if (emailError.value) return

  authError.value = ''
  isSubmitting.value = true

  try {
    await auth.loginWithEmail(email.value.trim(), password.value)
    // 登录成功，跳转来源页或首页
    if (redirectUrl.value) {
      uni.redirectTo({ url: redirectUrl.value, fail: () => uni.switchTab({ url: '/pages/home/index' }) })
    } else {
      uni.switchTab({ url: '/pages/home/index' })
    }
  } catch (err) {
    authError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSubmitting.value = false
  }
}

async function handleGitHubLogin() {
  authError.value = ''
  isSubmitting.value = true

  try {
    await auth.loginWithGitHub()
    // GitHub OAuth 会跳转外部页面，回调后自动回到应用
  } catch (err) {
    authError.value = err instanceof Error ? err.message : String(err)
    isSubmitting.value = false
  }
}

function goToRegister() {
  uni.navigateTo({ url: '/pages/auth/register' })
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.container {
  width: 100%;
  max-width: 400px;
  padding: 32px 24px;
}

.header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  font-size: 32px;
  font-weight: 700;
  color: #0066cc;
  display: block;
}

.subtitle {
  font-size: 14px;
  color: #666;
  margin-top: 8px;
  display: block;
}

.form {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

.form-item {
  margin-bottom: 20px;
}

.label {
  font-size: 14px;
  color: #333;
  font-weight: 500;
  display: block;
  margin-bottom: 8px;
}

.input {
  width: 100%;
  height: 44px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0 12px;
  font-size: 16px;
  background: #fafafa;
}

.error-text {
  font-size: 12px;
  color: #e53e3e;
  display: block;
  margin-top: 4px;
}

.error-center {
  text-align: center;
  margin-bottom: 12px;
}

.btn {
  width: 100%;
  height: 44px;
  border-radius: 8px;
  font-size: 16px;
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

.btn-github {
  background: #24292e;
  color: #fff;
  margin-top: 12px;
}

.btn-github[disabled] {
  background: #8b949e;
}

.btn-github-text {
  color: #fff;
  font-size: 16px;
}

.divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
}

.divider-line {
  flex: 1;
  height: 1px;
  background: #e2e2e2;
}

.divider-text {
  padding: 0 12px;
  font-size: 12px;
  color: #999;
}

.footer {
  text-align: center;
  margin-top: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.footer-text {
  font-size: 14px;
  color: #666;
}

.link {
  font-size: 14px;
  color: #0066cc;
  margin-left: 4px;
}
</style>
