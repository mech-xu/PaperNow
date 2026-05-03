import { useAuthStore } from '@/stores/auth'

/**
 * 需要认证的页面列表
 * 这些页面在未登录时访问会被重定向到登录页
 */
const PROTECTED_PAGES = [
  '/pages/collection/index',
  '/pages/collaboration/index',
  '/pages/profile/index',
]

/**
 * 认证导航守卫
 * 在页面跳转前检查是否需要登录
 *
 * 用法：在需要守卫的页面 onShow 中调用
 *
 * ```ts
 * import { useAuthGuard } from '@/composables/useAuthGuard'
 * const { requireAuth } = useAuthGuard()
 * onShow(() => requireAuth())
 * ```
 */
export function useAuthGuard() {
  const auth = useAuthStore()

  /**
   * 检查当前页面是否需要认证，如果未登录则跳转登录页
   * @returns 是否已认证
   */
  function requireAuth(): boolean {
    if (auth.isLoading) return true // 加载中，不拦截
    if (auth.isAuthenticated) return true

    // 记录来源路径，登录后可跳回
    const pages = getCurrentPages()
    const currentPage = pages[pages.length - 1]
    const redirectFrom = currentPage ? `/${currentPage.route}` : ''

    uni.redirectTo({
      url: `/pages/auth/login?redirect=${encodeURIComponent(redirectFrom)}`,
    })
    return false
  }

  /**
   * 检查指定路径是否需要认证
   */
  function isProtectedPage(path: string): boolean {
    return PROTECTED_PAGES.some((p) => path.includes(p))
  }

  return {
    requireAuth,
    isProtectedPage,
    PROTECTED_PAGES,
  }
}
