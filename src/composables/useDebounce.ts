import { ref, watch } from 'vue'

/**
 * 防抖 Composable
 * @param fn 要防抖的函数
 * @param delay 延迟毫秒数
 */
export function useDebounce<T extends (...args: unknown[]) => void>(fn: T, delay: number) {
  const timer = ref<ReturnType<typeof setTimeout> | null>(null)

  function debouncedFn(...args: unknown[]) {
    if (timer.value) clearTimeout(timer.value)
    timer.value = setTimeout(() => {
      fn(...args)
    }, delay)
  }

  function cancel() {
    if (timer.value) {
      clearTimeout(timer.value)
      timer.value = null
    }
  }

  return { debouncedFn, cancel }
}

/**
 * 防抖值 Composable
 * 值变化后延迟 delay 毫秒才更新
 */
export function useDebouncedValue<T>(value: T, delay: number) {
  const debouncedValue = ref(value) as { value: T }
  const timer = ref<ReturnType<typeof setTimeout> | null>(null)

  watch(() => value, (newVal) => {
    if (timer.value) clearTimeout(timer.value)
    timer.value = setTimeout(() => {
      debouncedValue.value = newVal
    }, delay)
  })

  return { debouncedValue }
}
