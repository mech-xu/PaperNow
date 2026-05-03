import { ref } from 'vue'

/**
 * 剪贴板 Composable
 * 复制文本到系统剪贴板
 */
export function useClipboard() {
  const copied = ref(false)
  const error = ref('')

  /**
   * 复制文本到剪贴板
   * @param text 要复制的文本
   * @param duration 复制成功后 "copied" 状态持续毫秒数
   */
  async function copy(text: string, duration = 2000): Promise<boolean> {
    copied.value = false
    error.value = ''

    try {
      // 优先使用 UniApp API（兼容 H5 + 小程序）
      await new Promise<void>((resolve, reject) => {
        uni.setClipboardData({
          data: text,
          success: () => resolve(),
          fail: (err) => reject(err),
        })
      })

      copied.value = true
      setTimeout(() => { copied.value = false }, duration)
      return true
    } catch (e) {
      // Fallback: 使用浏览器原生 Clipboard API
      try {
        await navigator.clipboard.writeText(text)
        copied.value = true
        setTimeout(() => { copied.value = false }, duration)
        return true
      } catch {
        // Final fallback: 使用 document.execCommand
        try {
          const textarea = document.createElement('textarea')
          textarea.value = text
          textarea.style.position = 'fixed'
          textarea.style.opacity = '0'
          document.body.appendChild(textarea)
          textarea.select()
          document.execCommand('copy')
          document.body.removeChild(textarea)

          copied.value = true
          setTimeout(() => { copied.value = false }, duration)
          return true
        } catch {
          error.value = '复制失败，请手动复制'
          return false
        }
      }
    }
  }

  return {
    copied,
    error,
    copy,
  }
}
