import { ref, watch } from 'vue'

/**
 * 本地保存 Composable
 * 将文献元数据保存至浏览器 localStorage，支持离线访问
 *
 * 存储结构:
 * - key: 'papernow_local_papers'
 * - value: Array<{ id, title, authors, abstract, source, source_id, pdf_url, saved_at }>
 */

const STORAGE_KEY = 'papernow_local_papers'
const MAX_STORAGE_ITEMS = 200

export interface LocalPaper {
  id: string
  title: string
  authors: string[] | null
  abstract: string | null
  source: string
  source_id: string | null
  pdf_url: string | null
  saved_at: string
}

function readFromStorage(): LocalPaper[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as LocalPaper[]
  } catch {
    return []
  }
}

function writeToStorage(papers: LocalPaper[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(papers))
    return true
  } catch (e) {
    // localStorage 满或不可用
    console.warn('[PaperNow] localStorage write failed:', e)
    return false
  }
}

/**
 * 检查 localStorage 可用性和剩余空间
 */
function checkStorageAvailable(): { available: boolean; remainingKB: number } {
  try {
    const testKey = '__papernow_storage_test__'
    localStorage.setItem(testKey, '1')
    localStorage.removeItem(testKey)

    // 估算剩余空间
    let totalSize = 0
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) {
        totalSize += key.length + (localStorage.getItem(key)?.length || 0)
      }
    }
    // 大多数浏览器限制 5MB
    const remainingKB = Math.max(0, (5 * 1024 - totalSize / 1024))

    return { available: true, remainingKB }
  } catch {
    return { available: false, remainingKB: 0 }
  }
}

export function useLocalStorage() {
  const localPapers = ref<LocalPaper[]>(readFromStorage())
  const storageError = ref('')

  // 监听变化自动同步
  watch(localPapers, (newPapers) => {
    writeToStorage(newPapers)
  }, { deep: true })

  /**
   * 保存文献元数据到本地
   */
  function savePaper(paper: {
    id: string
    title: string
    authors?: string[] | null
    abstract?: string | null
    source: string
    source_id?: string | null
    pdf_url?: string | null
  }): boolean {
    storageError.value = ''

    // 检查是否已保存
    if (localPapers.value.some(p => p.id === paper.id)) {
      return true // 已存在，无需重复保存
    }

    // 检查存储空间
    const { available, remainingKB } = checkStorageAvailable()
    if (!available || remainingKB < 10) {
      storageError.value = '本地存储空间已满'
      return false
    }

    // 超出上限时移除最早的记录
    if (localPapers.value.length >= MAX_STORAGE_ITEMS) {
      localPapers.value.shift()
    }

    const localPaper: LocalPaper = {
      id: paper.id,
      title: paper.title,
      authors: paper.authors || null,
      abstract: paper.abstract || null,
      source: paper.source,
      source_id: paper.source_id || null,
      pdf_url: paper.pdf_url || null,
      saved_at: new Date().toISOString(),
    }

    localPapers.value.push(localPaper)
    return true
  }

  /**
   * 从本地移除文献
   */
  function removePaper(paperId: string) {
    localPapers.value = localPapers.value.filter(p => p.id !== paperId)
  }

  /**
   * 检查文献是否已本地保存
   */
  function isPaperSaved(paperId: string): boolean {
    return localPapers.value.some(p => p.id === paperId)
  }

  /**
   * 清空所有本地保存的文献
   */
  function clearAll() {
    localPapers.value = []
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    localPapers,
    storageError,
    savePaper,
    removePaper,
    isPaperSaved,
    clearAll,
    checkStorageAvailable,
  }
}
