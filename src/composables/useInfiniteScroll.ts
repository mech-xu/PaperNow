import { ref, onMounted, onUnmounted } from 'vue'

/**
 * 无限滚动 Composable
 * 使用 Intersection Observer 监测底部哨兵元素
 * 触底时触发加载更多
 */
export function useInfiniteScroll(onLoadMore: () => Promise<void>) {
  const sentinelRef = ref<HTMLElement | null>(null)
  const observer = ref<IntersectionObserver | null>(null)
  const isIntersecting = ref(false)

  onMounted(() => {
    observer.value = new IntersectionObserver(
      (entries) => {
        const entry = entries[0]
        if (entry?.isIntersecting && !isIntersecting.value) {
          isIntersecting.value = true
          onLoadMore().finally(() => {
            isIntersecting.value = false
          })
        }
      },
      {
        rootMargin: '200px', // 提前 200px 触发
        threshold: 0,
      },
    )

    if (sentinelRef.value) {
      observer.value.observe(sentinelRef.value)
    }
  })

  onUnmounted(() => {
    observer.value?.disconnect()
  })

  return {
    sentinelRef,
    isIntersecting,
  }
}
