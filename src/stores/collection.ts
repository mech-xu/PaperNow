import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from './auth'
import type { UserCollection, UserTag, ReadingStatus } from '@/types'

export const useCollectionStore = defineStore('collection', () => {
  // State
  const collections = ref<UserCollection[]>([])
  const tags = ref<UserTag[]>([])
  const isLoading = ref(false)
  const selectedTagId = ref<string | null>(null)
  const selectedReadingStatus = ref<ReadingStatus | null>(null)

  // Getters
  const filteredCollections = computed(() => {
    let filtered = collections.value

    if (selectedTagId.value) {
      filtered = filtered.filter(c =>
        c.tags?.some(t => t.id === selectedTagId.value)
      )
    }

    if (selectedReadingStatus.value) {
      filtered = filtered.filter(c =>
        c.reading_status === selectedReadingStatus.value
      )
    }

    return filtered
  })

  // Actions
  async function fetchCollections() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return

    isLoading.value = true
    try {
      const { data, error } = await supabase
        .from('user_collections')
        .select(`
          *,
          document:documents(*),
          tags:document_tags(tag:user_tags(*))
        `)
        .eq('user_id', auth.user!.id)
        .order('created_at', { ascending: false })

      if (error) throw error
      collections.value = (data || []) as unknown as UserCollection[]
    } finally {
      isLoading.value = false
    }
  }

  async function addToCollection(documentId: string) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('user_collections')
      .insert({
        user_id: auth.user!.id,
        document_id: documentId,
      })
      .select()
      .single()

    if (error) throw error
    return data
  }

  async function removeFromCollection(collectionId: string) {
    const { error } = await supabase
      .from('user_collections')
      .delete()
      .eq('id', collectionId)

    if (error) throw error
    collections.value = collections.value.filter(c => c.id !== collectionId)
  }

  async function updateReadingStatus(collectionId: string, status: ReadingStatus) {
    const { data, error } = await supabase
      .from('user_collections')
      .update({ reading_status: status })
      .eq('id', collectionId)
      .select()
      .single()

    if (error) throw error

    const index = collections.value.findIndex(c => c.id === collectionId)
    if (index !== -1) {
      collections.value[index] = data as UserCollection
    }
  }

  async function fetchTags() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return

    const { data, error } = await supabase
      .from('user_tags')
      .select('*')
      .eq('user_id', auth.user!.id)
      .order('name')

    if (error) throw error
    tags.value = (data || []) as UserTag[]
  }

  async function createTag(name: string, color?: string) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('user_tags')
      .insert({
        user_id: auth.user!.id,
        name,
        color: color || '#0066cc',
      })
      .select()
      .single()

    if (error) throw error
    tags.value.push(data as UserTag)
    return data
  }

  async function deleteTag(tagId: string) {
    const { error } = await supabase
      .from('user_tags')
      .delete()
      .eq('id', tagId)

    if (error) throw error
    tags.value = tags.value.filter(t => t.id !== tagId)
  }

  /**
   * 为收藏记录关联标签
   * @param collectionId - user_collections 记录 ID
   * @param tagId - user_tags 记录 ID
   */
  async function addTagToCollection(collectionId: string, tagId: string) {
    const { data, error } = await supabase
      .from('document_tags')
      .insert({
        document_collection_id: collectionId,
        tag_id: tagId,
      })
      .select()
      .single()

    if (error) throw error

    // 更新本地状态：将标签添加到对应收藏记录
    const collection = collections.value.find(c => c.id === collectionId)
    if (collection) {
      const tag = tags.value.find(t => t.id === tagId)
      if (tag) {
        collection.tags = [...(collection.tags || []), tag]
      }
    }

    return data
  }

  /**
   * 取消收藏记录与标签的关联
   * @param collectionId - user_collections 记录 ID
   * @param tagId - user_tags 记录 ID
   */
  async function removeTagFromCollection(collectionId: string, tagId: string) {
    const { error } = await supabase
      .from('document_tags')
      .delete()
      .eq('document_collection_id', collectionId)
      .eq('tag_id', tagId)

    if (error) throw error

    // 更新本地状态：从对应收藏记录中移除标签
    const collection = collections.value.find(c => c.id === collectionId)
    if (collection && collection.tags) {
      collection.tags = collection.tags.filter(t => t.id !== tagId)
    }
  }

  /**
   * 切换收藏状态：已收藏则取消，未收藏则添加
   * @returns 新的收藏状态（true = 已收藏）
   */
  async function toggleCollection(documentId: string): Promise<boolean> {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Not authenticated')

    const existing = collections.value.find(c => c.document_id === documentId)
    if (existing) {
      await removeFromCollection(existing.id)
      return false
    } else {
      await addToCollection(documentId)
      // 重新获取收藏列表以获取完整关联数据
      await fetchCollections()
      return true
    }
  }

  function isCollected(documentId: string): boolean {
    return collections.value.some(c => c.document_id === documentId)
  }

  /**
   * 获取指定文献的收藏记录 ID（用于标签关联操作）
   */
  function getCollectionId(documentId: string): string | null {
    const collection = collections.value.find(c => c.document_id === documentId)
    return collection?.id || null
  }

  return {
    collections,
    tags,
    isLoading,
    selectedTagId,
    selectedReadingStatus,
    filteredCollections,
    fetchCollections,
    addToCollection,
    removeFromCollection,
    updateReadingStatus,
    fetchTags,
    createTag,
    deleteTag,
    addTagToCollection,
    removeTagFromCollection,
    toggleCollection,
    isCollected,
    getCollectionId,
  }
})
