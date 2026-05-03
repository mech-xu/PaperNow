<template>
  <view class="register-page">
    <view class="container">
      <!-- Logo & Title -->
      <view class="header">
        <text class="logo">
          PaperNow
        </text>
        <text class="subtitle">
          创建账户
        </text>
      </view>

      <!-- Register Form -->
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
            @blur="validatePassword"
          >
          <text
            v-if="passwordError"
            class="error-text"
          >
            {{ passwordError }}
          </text>
        </view>

        <!-- Confirm Password -->
        <view class="form-item">
          <text class="label">
            确认密码
          </text>
          <input
            v-model="confirmPassword"
            type="password"
            placeholder="再次输入密码"
            class="input"
            :disabled="isSubmitting"
            @blur="validateConfirmPassword"
          >
          <text
            v-if="confirmError"
            class="error-text"
          >
            {{ confirmError }}
          </text>
        </view>

        <!-- Error Message -->
        <text
          v-if="authError"
          class="error-text error-center"
        >
          {{ authError }}
        </text>

        <!-- Register Button -->
        <button
          class="btn btn-primary"
          :disabled="isSubmitting || !isFormValid"
          @tap="handleRegister"
        >
          {{ isSubmitting ? '注册中...' : '注册' }}
        </button>

        <!-- Login Link -->
        <view class="footer">
          <text class="footer-text">
            已有账户？
          </text>
          <text
            class="link"
            @tap="goToLogin"
          >
            去登录
          </text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const emailError = ref('')
const passwordError = ref('')
const confirmError = ref('')
const authError = ref('')
const isSubmitting = ref(false)

const isFormValid = computed(() => {
  return email.value.trim() !== '' && password.value.length >= 8 && confirmPassword.value.length >= 8
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

function validatePassword() {
  if (password.value.length < 8) {
    passwordError.value = '密码至少 8 个字符'
  } else {
    passwordError.value = ''
  }
}

function validateConfirmPassword() {
  if (confirmPassword.value !== password.value) {
    confirmError.value = '两次密码不一致'
  } else {
    confirmError.value = ''
  }
}

async function handleRegister() {
  validateEmail()
  validatePassword()
  validateConfirmPassword()
  if (emailError.value || passwordError.value || confirmError.value) return

  authError.value = ''
  isSubmitting.value = true

  try {
    await auth.registerWithEmail(email.value.trim(), password.value)
    // 注册成功，跳转首页
    uni.switchTab({ url: '/pages/home/index' })
  } catch (err) {
    authError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSubmitting.value = false
  }
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}
</script>

<style scoped>
.register-page {
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
