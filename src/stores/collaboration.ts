import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/utils/supabase'
import { useAuthStore } from './auth'
import type { CollabFolder, CollabFolderMember, CollabFolderDocument, Document } from '@/types'

export const useCollaborationStore = defineStore('collaboration', () => {
  // State
  const folders = ref<CollabFolder[]>([])
  const currentFolder = ref<CollabFolder | null>(null)
  const currentMembers = ref<CollabFolderMember[]>([])
  const currentDocuments = ref<CollabFolderDocument[]>([])
  const isLoading = ref(false)
  const isFolderLoading = ref(false)

  // Actions

  /**
   * 获取当前用户的协作文件夹列表
   */
  async function fetchFolders() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return

    isLoading.value = true
    try {
      const { data, error } = await supabase
        .from('collab_folders')
        .select(`
          *,
          owner:profiles!owner_id(id, username, display_name, avatar_url),
          members:collab_folder_members(count)
        `)
        .or(`owner_id.eq.${auth.user!.id},collab_folder_members.user_id.eq.${auth.user!.id}`)
        .order('updated_at', { ascending: false })

      if (error) throw error
      folders.value = (data || []) as unknown as CollabFolder[]
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 创建协作文件夹
   */
  async function createFolder(name: string, description?: string) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Not authenticated')
    if (!name.trim()) throw new Error('请输入文件夹名称')

    const { data, error } = await supabase
      .from('collab_folders')
      .insert({
        owner_id: auth.user!.id,
        name: name.trim(),
        description: description?.trim() || null,
      })
      .select()
      .single()

    if (error) throw error

    // 自动将创建者添加为 owner 成员
    const folder = data as CollabFolder
    await supabase
      .from('collab_folder_members')
      .insert({
        folder_id: folder.id,
        user_id: auth.user!.id,
        role: 'owner',
        accepted_at: new Date().toISOString(),
      })

    folders.value.unshift(folder)
    return folder
  }

  /**
   * 更新文件夹信息
   */
  async function updateFolder(folderId: string, updates: Partial<Pick<CollabFolder, 'name' | 'description' | 'is_public'>>) {
    const { data, error } = await supabase
      .from('collab_folders')
      .update(updates)
      .eq('id', folderId)
      .select()
      .single()

    if (error) throw error

    // 更新本地状态
    const index = folders.value.findIndex(f => f.id === folderId)
    if (index !== -1) {
      folders.value[index] = data as CollabFolder
    }
    if (currentFolder.value?.id === folderId) {
      currentFolder.value = data as CollabFolder
    }

    return data
  }

  /**
   * 删除文件夹
   */
  async function deleteFolder(folderId: string) {
    const { error } = await supabase
      .from('collab_folders')
      .delete()
      .eq('id', folderId)

    if (error) throw error
    folders.value = folders.value.filter(f => f.id !== folderId)
    if (currentFolder.value?.id === folderId) {
      currentFolder.value = null
    }
  }

  /**
   * 加载文件夹详情（成员 + 文献）
   */
  async function loadFolderDetail(folderId: string) {
    isFolderLoading.value = true
    try {
      // 获取文件夹信息
      const { data: folderData, error: folderError } = await supabase
        .from('collab_folders')
        .select('*')
        .eq('id', folderId)
        .single()

      if (folderError) throw folderError
      currentFolder.value = folderData as CollabFolder

      // 并行获取成员和文献
      const [membersResult, documentsResult] = await Promise.all([
        supabase
          .from('collab_folder_members')
          .select('*, profile:profiles!user_id(id, username, display_name, avatar_url)')
          .eq('folder_id', folderId)
          .order('role'),
        supabase
          .from('collab_folder_documents')
          .select('*, document:documents(*)')
          .eq('folder_id', folderId)
          .order('created_at', { ascending: false }),
      ])

      if (membersResult.error) throw membersResult.error
      if (documentsResult.error) throw documentsResult.error

      currentMembers.value = (membersResult.data || []) as unknown as CollabFolderMember[]
      currentDocuments.value = (documentsResult.data || []) as unknown as CollabFolderDocument[]
    } finally {
      isFolderLoading.value = false
    }
  }

  /**
   * 邀请成员
   */
  async function inviteMember(folderId: string, userId: string, role: 'admin' | 'member' = 'member') {
    const { data, error } = await supabase
      .from('collab_folder_members')
      .insert({
        folder_id: folderId,
        user_id: userId,
        role,
      })
      .select()
      .single()

    if (error) throw error
    currentMembers.value.push(data as CollabFolderMember)
    return data
  }

  /**
   * 接受邀请
   */
  async function acceptInvitation(memberId: string) {
    const { data, error } = await supabase
      .from('collab_folder_members')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', memberId)
      .select()
      .single()

    if (error) throw error

    const index = currentMembers.value.findIndex(m => m.id === memberId)
    if (index !== -1) {
      currentMembers.value[index] = data as CollabFolderMember
    }

    return data
  }

  /**
   * 移除成员
   */
  async function removeMember(memberId: string) {
    const { error } = await supabase
      .from('collab_folder_members')
      .delete()
      .eq('id', memberId)

    if (error) throw error
    currentMembers.value = currentMembers.value.filter(m => m.id !== memberId)
  }

  /**
   * 添加文献到文件夹
   */
  async function addDocumentToFolder(folderId: string, documentId: string, notes?: string) {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) throw new Error('Not authenticated')

    const { data, error } = await supabase
      .from('collab_folder_documents')
      .insert({
        folder_id: folderId,
        document_id: documentId,
        added_by: auth.user!.id,
        notes: notes?.trim() || null,
      })
      .select('*, document:documents(*)')
      .single()

    if (error) throw error
    currentDocuments.value.unshift(data as unknown as CollabFolderDocument)
    return data
  }

  /**
   * 从文件夹移除文献
   */
  async function removeDocumentFromFolder(folderDocumentId: string) {
    const { error } = await supabase
      .from('collab_folder_documents')
      .delete()
      .eq('id', folderDocumentId)

    if (error) throw error
    currentDocuments.value = currentDocuments.value.filter(d => d.id !== folderDocumentId)
  }

  /**
   * 生成分享令牌
   */
  async function generateShareToken(folderId: string): Promise<string> {
    const token = crypto.randomUUID()

    const { error } = await supabase
      .from('collab_folders')
      .update({ share_token: token })
      .eq('id', folderId)

    if (error) throw error

    // 更新本地状态
    if (currentFolder.value?.id === folderId) {
      currentFolder.value.share_token = token
    }
    const folderIndex = folders.value.findIndex(f => f.id === folderId)
    if (folderIndex !== -1) {
      folders.value[folderIndex].share_token = token
    }

    return token
  }

  /**
   * 通过分享令牌解析文件夹
   */
  async function resolveShareToken(token: string): Promise<CollabFolder | null> {
    const { data, error } = await supabase
      .from('collab_folders')
      .select('*')
      .eq('share_token', token)
      .single()

    if (error) return null
    return data as CollabFolder
  }

  /**
   * 检查当前用户是否是文件夹的 owner
   */
  function isOwner(folderId: string): boolean {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return false
    const folder = folders.value.find(f => f.id === folderId) || currentFolder.value
    return folder?.owner_id === auth.user!.id
  }

  return {
    folders,
    currentFolder,
    currentMembers,
    currentDocuments,
    isLoading,
    isFolderLoading,
    fetchFolders,
    createFolder,
    updateFolder,
    deleteFolder,
    loadFolderDetail,
    inviteMember,
    acceptInvitation,
    removeMember,
    addDocumentToFolder,
    removeDocumentFromFolder,
    generateShareToken,
    resolveShareToken,
    isOwner,
  }
})
