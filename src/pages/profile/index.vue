<template>
  <view class="profile-page">
    <!-- Back to Home -->
    <view class="nav-back" @tap="goHome">
      <text class="nav-back-icon">‹</text>
    </view>

    <view class="container">
      <!-- Loading -->
      <view
        v-if="auth.isLoading"
        class="loading"
      >
        <text>加载中...</text>
      </view>

      <!-- Profile Content -->
      <view
        v-else-if="auth.isAuthenticated"
        class="content"
      >
        <!-- Avatar -->
        <view class="avatar-section">
          <view class="avatar">
            <text class="avatar-text">
              {{ avatarInitial }}
            </text>
          </view>
          <text class="display-name">
            {{ auth.displayName }}
          </text>
          <text class="email">
            {{ auth.user?.email }}
          </text>
        </view>

        <!-- Edit Form -->
        <view class="form">
          <view class="form-item">
            <text class="label">
              显示名称
            </text>
            <input
              v-model="editDisplayName"
              type="text"
              placeholder="输入显示名称"
              class="input"
              :disabled="isSaving"
            >
          </view>

          <view class="form-item">
            <text class="label">
              个人简介
            </text>
            <textarea
              v-model="editBio"
              placeholder="介绍一下自己"
              class="textarea"
              :disabled="isSaving"
              maxlength="200"
            />
          </view>

          <!-- Save Button -->
          <button
            class="btn btn-primary"
            :disabled="isSaving || !hasChanges"
            @tap="handleSave"
          >
            {{ isSaving ? '保存中...' : '保存修改' }}
          </button>

          <text
            v-if="saveError"
            class="error-text"
          >
            {{ saveError }}
          </text>
          <text
            v-if="saveSuccess"
            class="success-text"
          >
            保存成功
          </text>
        </view>

        <!-- Logout -->
        <button
          class="btn btn-logout"
          @tap="handleLogout"
        >
          退出登录
        </button>
      </view>

      <!-- Not Authenticated -->
      <view
        v-else
        class="not-auth"
      >
        <text class="not-auth-text">
          请先登录
        </text>
        <button
          class="btn btn-primary"
          @tap="goToLogin"
        >
          去登录
        </button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()

const editDisplayName = ref('')
const editBio = ref('')
const isSaving = ref(false)
const saveError = ref('')
const saveSuccess = ref(false)

const avatarInitial = computed(() => {
  const name = auth.displayName
  return name ? name.charAt(0).toUpperCase() : '?'
})

const hasChanges = computed(() => {
  return editDisplayName.value !== (auth.profile?.display_name || '')
    || editBio.value !== (auth.profile?.bio || '')
})

// 同步 profile 数据到编辑表单
watch(() => auth.profile, (p) => {
  if (p) {
    editDisplayName.value = p.display_name || ''
    editBio.value = p.bio || ''
  }
}, { immediate: true })

async function handleSave() {
  isSaving.value = true
  saveError.value = ''
  saveSuccess.value = false

  try {
    await auth.updateProfile({
      display_name: editDisplayName.value || null,
      bio: editBio.value || null,
    })
    saveSuccess.value = true
    setTimeout(() => { saveSuccess.value = false }, 2000)
  } catch (err) {
    saveError.value = err instanceof Error ? err.message : String(err)
  } finally {
    isSaving.value = false
  }
}

async function handleLogout() {
  try {
    await auth.logout()
    uni.redirectTo({ url: '/pages/auth/login' })
  } catch (_err) {
    // ignore logout error
  }
}

function goToLogin() {
  uni.navigateTo({ url: '/pages/auth/login' })
}

function goHome() { uni.switchTab({ url: '/pages/home/index' }) }
</script>

<style scoped>
.profile-page {
  min-height: 100vh;
  background-color: #f5f5f5;
}

.container {
  max-width: 600px;
  margin: 0 auto;
  padding: 24px 16px;
}

.loading {
  text-align: center;
  padding: 40px;
  color: #666;
}

.avatar-section {
  text-align: center;
  margin-bottom: 32px;
}

.avatar {
  width: 80px;
  height: 80px;
  border-radius: 40px;
  background: #0066cc;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 12px;
}

.avatar-text {
  font-size: 32px;
  color: #fff;
  font-weight: 600;
}

.display-name {
  font-size: 20px;
  font-weight: 600;
  color: #333;
  display: block;
}

.email {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
  display: block;
}

.form {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  margin-bottom: 16px;
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

.textarea {
  width: 100%;
  height: 80px;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 16px;
  background: #fafafa;
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

.btn-logout {
  background: #fff;
  color: #e53e3e;
  border: 1px solid #e53e3e;
}

.error-text {
  font-size: 12px;
  color: #e53e3e;
  display: block;
  margin-top: 8px;
  text-align: center;
}

.success-text {
  font-size: 12px;
  color: #38a169;
  display: block;
  margin-top: 8px;
  text-align: center;
}

.not-auth {
  text-align: center;
  padding: 60px 24px;
}

.not-auth-text {
  font-size: 16px;
  color: #666;
  display: block;
  margin-bottom: 16px;
}

.nav-back {
  position: fixed;
  top: 8px;
  left: 8px;
  z-index: 999;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.9);
  border-radius: 50%;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.12);
}
.nav-back-icon {
  font-size: 22px;
  color: #333;
  line-height: 1;
}
</style>
