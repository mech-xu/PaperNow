import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/utils/supabase'
import type { Profile } from '@/types'
import type { User, Session } from '@supabase/supabase-js'
import { appConfig } from '@/config/app'

// Supabase Auth 错误码 → 用户友好提示
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'invalid_credentials': '邮箱或密码错误',
  'email_address_invalid': '请输入有效的邮箱地址',
  'email_already_registered': '该邮箱已注册，请直接登录',
  'user_already_exists': '该邮箱已注册',
  'password_too_short': `密码至少 ${appConfig.maxLoginAttempts} 个字符`,
  'signup_disabled': '注册功能暂未开放',
  'email_not_confirmed': '请先验证您的邮箱',
  'too_many_requests': '尝试次数过多，请稍后再试',
  'network_request_failed': '网络连接失败，请检查网络',
}

function getErrorMessage(error: { message: string; code?: string; status?: number }): string {
  // 优先匹配 error.message 中的关键词
  const msg = error.message.toLowerCase()
  if (msg.includes('invalid login credentials')) return AUTH_ERROR_MESSAGES.invalid_credentials
  if (msg.includes('email already registered') || msg.includes('user already registered')) return AUTH_ERROR_MESSAGES.email_already_registered
  if (msg.includes('email address invalid')) return AUTH_ERROR_MESSAGES.email_address_invalid
  if (msg.includes('password') && msg.includes('short')) return AUTH_ERROR_MESSAGES.password_too_short
  if (msg.includes('email not confirmed')) return AUTH_ERROR_MESSAGES.email_not_confirmed
  if (msg.includes('too many requests') || msg.includes('rate limit')) return AUTH_ERROR_MESSAGES.too_many_requests
  if (msg.includes('network')) return AUTH_ERROR_MESSAGES.network_request_failed
  // 兜底
  return error.message || '操作失败，请重试'
}

export { getErrorMessage }

export const useAuthStore = defineStore('auth', () => {
  // State
  const user = ref<User | null>(null)
  const profile = ref<Profile | null>(null)
  const session = ref<Session | null>(null)
  const isLoading = ref(true)
  const loginAttempts = ref(0)
  const loginLockedUntil = ref<number | null>(null)

  // Getters
  const isAuthenticated = computed(() => !!session.value && !!user.value)
  const displayName = computed(() => profile.value?.display_name || profile.value?.username || user.value?.email || '')
  const isLoginLocked = computed(() => loginLockedUntil.value !== null && Date.now() < loginLockedUntil.value)

  // Actions
  async function initialize() {
    isLoading.value = true
    try {
      const { data: { session: s } } = await supabase.auth.getSession()
      session.value = s
      user.value = s?.user ?? null

      if (s?.user) {
        await fetchOrCreateProfile(s.user.id, s.user.email)
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (_event, newSession) => {
        session.value = newSession
        user.value = newSession?.user ?? null
        if (newSession?.user) {
          await fetchOrCreateProfile(newSession.user.id, newSession.user.email)
        } else {
          profile.value = null
        }
      })
    } finally {
      isLoading.value = false
    }
  }

  async function fetchOrCreateProfile(userId: string, email?: string) {
    // 先尝试获取（带重试，OAuth callback 后可能需要短暂等待）
    let data = null
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()
      if (result.data) {
        data = result.data
        break
      }
      // Wait before retry (handles 406/race condition during OAuth callback)
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)))
      }
    }

    if (data) {
      profile.value = data as Profile
    } else {
      // Profile 不存在，自动创建（注册后首次登录）
      const { data: newProfile, error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: email?.split('@')[0] || null,
          display_name: null,
          avatar_url: null,
          bio: null,
        })
        .select()
        .single()

      if (!error && newProfile) {
        profile.value = newProfile as Profile
      }
    }
  }

  async function loginWithEmail(email: string, password: string) {
    if (isLoginLocked.value) {
      const remaining = Math.ceil((loginLockedUntil.value! - Date.now()) / 1000)
      throw new Error(`登录已锁定，请 ${remaining} 秒后重试`)
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      loginAttempts.value++
      if (loginAttempts.value >= appConfig.maxLoginAttempts) {
        loginLockedUntil.value = Date.now() + appConfig.loginLockoutMinutes * 60 * 1000
        loginAttempts.value = 0
      }
      throw new Error(getErrorMessage(error))
    }

    // 登录成功，重置计数
    loginAttempts.value = 0
    loginLockedUntil.value = null
    return data
  }

  async function registerWithEmail(email: string, password: string) {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw new Error(getErrorMessage(error))
    return data
  }

  async function loginWithGitHub() {
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/pages/auth/callback`,
      },
    })
    if (error) throw new Error(getErrorMessage(error))
    return data
  }

  async function logout() {
    const { error } = await supabase.auth.signOut()
    if (error) throw new Error(getErrorMessage(error))
    profile.value = null
    user.value = null
    session.value = null
    loginAttempts.value = 0
    loginLockedUntil.value = null
  }

  async function updateProfile(updates: Partial<Profile>) {
    if (!user.value) throw new Error('未登录')

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', user.value.id)
      .select()
      .single()

    if (error) throw new Error(getErrorMessage(error))
    profile.value = data as Profile
    return data
  }

  return {
    user,
    profile,
    session,
    isLoading,
    loginAttempts,
    loginLockedUntil,
    isAuthenticated,
    displayName,
    isLoginLocked,
    initialize,
    loginWithEmail,
    registerWithEmail,
    loginWithGitHub,
    logout,
    updateProfile,
  }
})
