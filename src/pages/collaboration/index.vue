<template>
  <view class="collaboration-page">
    <!-- Folder List View -->
    <view
      v-if="!currentFolder"
      class="folder-list-view"
    >
      <!-- Header -->
      <view class="header">
        <text class="page-title">协作空间</text>
        <text
          class="create-btn"
          @tap="openCreateDialog"
        >
          + 新建
        </text>
      </view>

      <!-- Loading -->
      <view
        v-if="collabStore.isLoading"
        class="loading"
      >
        <text class="loading-text">加载中...</text>
      </view>

      <!-- Empty State -->
      <view
        v-else-if="collabStore.folders.length === 0"
        class="empty-state"
      >
        <text class="empty-icon">📁</text>
        <text class="empty-text">暂无协作文件夹</text>
        <text class="empty-hint">创建文件夹，与团队成员共享文献</text>
        <text
          class="empty-action"
          @tap="openCreateDialog"
        >
          创建文件夹
        </text>
      </view>

      <!-- Folder List -->
      <view
        v-else
        class="folder-list"
      >
        <CollabFolderCard
          v-for="folder in collabStore.folders"
          :key="folder.id"
          :folder="folder"
          :member-count="getMemberCount(folder)"
          :document-count="getDocumentCount(folder)"
          @tap="openFolderDetail"
          @share="openShareDialog"
        />
      </view>
    </view>

    <!-- Folder Detail View -->
    <view
      v-else
      class="folder-detail-view"
    >
      <!-- Back -->
      <view class="detail-header">
        <text
          class="back-btn"
          @tap="closeFolderDetail"
        >
          ← 返回
        </text>
        <text class="detail-title">{{ currentFolder.name }}</text>
        <text
          v-if="collabStore.isOwner(currentFolder.id)"
          class="settings-btn"
          @tap="openSettingsDialog"
        >
          ⚙
        </text>
      </view>

      <!-- Description -->
      <text
        v-if="currentFolder.description"
        class="folder-description"
      >
        {{ currentFolder.description }}
      </text>

      <!-- Tabs: Documents / Members -->
      <view class="tab-bar">
        <text
          class="tab"
          :class="{ active: activeTab === 'documents' }"
          @tap="activeTab = 'documents'"
        >
          文献 ({{ collabStore.currentDocuments.length }})
        </text>
        <text
          class="tab"
          :class="{ active: activeTab === 'members' }"
          @tap="activeTab = 'members'"
        >
          成员 ({{ collabStore.currentMembers.length }})
        </text>
      </view>

      <!-- Documents Tab -->
      <view
        v-if="activeTab === 'documents'"
        class="tab-content"
      >
        <!-- Add Document -->
        <view
          v-if="collabStore.isOwner(currentFolder.id) || isMember"
          class="add-section"
        >
          <text
            class="add-btn"
            @tap="openAddDocumentDialog"
          >
            + 添加文献
          </text>
        </view>

        <!-- Document List -->
        <view
          v-if="collabStore.currentDocuments.length === 0"
          class="empty-tab"
        >
          <text class="empty-tab-text">暂无文献</text>
        </view>
        <view
          v-for="doc in collabStore.currentDocuments"
          :key="doc.id"
          class="doc-item"
        >
          <view
            class="doc-content"
            @tap="goToDocumentDetail(doc)"
          >
            <text class="doc-title">{{ doc.document?.title }}</text>
            <text
              v-if="doc.document?.authors?.length"
              class="doc-authors"
            >
              {{ doc.document.authors.slice(0, 2).join(', ') }}
            </text>
          </view>
          <text
            class="doc-remove"
            @tap="handleRemoveDocument(doc.id)"
          >
            ✕
          </text>
        </view>
      </view>

      <!-- Members Tab -->
      <view
        v-if="activeTab === 'members'"
        class="tab-content"
      >
        <!-- Invite (owner only) -->
        <view
          v-if="collabStore.isOwner(currentFolder.id)"
          class="add-section"
        >
          <text
            class="add-btn"
            @tap="openInviteDialog"
          >
            + 邀请成员
          </text>
        </view>

        <!-- Member List -->
        <view
          v-for="member in collabStore.currentMembers"
          :key="member.id"
          class="member-item"
        >
          <view class="member-avatar">
            <text class="avatar-text">{{ getInitial(member) }}</text>
          </view>
          <view class="member-info">
            <text class="member-name">{{ getMemberName(member) }}</text>
            <text class="member-role">{{ getRoleLabel(member.role) }}</text>
          </view>
          <text
            v-if="collabStore.isOwner(currentFolder.id) && member.role !== 'owner'"
            class="member-remove"
            @tap="handleRemoveMember(member.id)"
          >
            移除
          </text>
        </view>
      </view>
    </view>

    <!-- Create Folder Dialog -->
    <view
      v-if="showCreateDialog"
      class="dialog-overlay"
      @tap="showCreateDialog = false"
    >
      <view
        class="dialog"
        @tap.stop
      >
        <text class="dialog-title">创建协作文件夹</text>
        <view class="form-item">
          <text class="label">名称</text>
          <input
            v-model="newFolderName"
            type="text"
            placeholder="文件夹名称"
            class="input"
          >
        </view>
        <view class="form-item">
          <text class="label">描述（可选）</text>
          <textarea
            v-model="newFolderDesc"
            placeholder="简要描述"
            class="textarea"
            maxlength="200"
          />
        </view>
        <view class="dialog-actions">
          <text
            class="dialog-btn cancel"
            @tap="showCreateDialog = false"
          >
            取消
          </text>
          <text
            class="dialog-btn confirm"
            @tap="handleCreateFolder"
          >
            创建
          </text>
        </view>
      </view>
    </view>

    <!-- Invite Member Dialog -->
    <view
      v-if="showInviteDialog"
      class="dialog-overlay"
      @tap="showInviteDialog = false"
    >
      <view
        class="dialog"
        @tap.stop
      >
        <text class="dialog-title">邀请成员</text>
        <view class="form-item">
          <text class="label">用户 ID</text>
          <input
            v-model="inviteUserId"
            type="text"
            placeholder="输入用户 UUID"
            class="input"
          >
        </view>
        <view class="dialog-actions">
          <text
            class="dialog-btn cancel"
            @tap="showInviteDialog = false"
          >
            取消
          </text>
          <text
            class="dialog-btn confirm"
            @tap="handleInviteMember"
          >
            邀请
          </text>
        </view>
      </view>
    </view>

    <!-- Add Document Dialog -->
    <view
      v-if="showAddDocDialog"
      class="dialog-overlay"
      @tap="showAddDocDialog = false"
    >
      <view
        class="dialog"
        @tap.stop
      >
        <text class="dialog-title">添加文献</text>
        <view class="form-item">
          <text class="label">文献 ID</text>
          <input
            v-model="addDocId"
            type="text"
            placeholder="输入文献 UUID（从搜索页获取）"
            class="input"
          >
        </view>
        <view class="dialog-actions">
          <text
            class="dialog-btn cancel"
            @tap="showAddDocDialog = false"
          >
            取消
          </text>
          <text
            class="dialog-btn confirm"
            @tap="handleAddDocument"
          >
            添加
          </text>
        </view>
      </view>
    </view>

    <!-- Share Dialog -->
    <ShareDialog
      :visible="showShareDialog"
      :folder-id="shareFolderId"
      :folder-name="shareFolderName"
      :share-token="shareFolderToken"
      @update:visible="showShareDialog = $event"
      @generate="handleGenerateShareToken"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow, onLoad } from '@dcloudio/uni-app'
import { useCollaborationStore } from '@/stores/collaboration'
import { useAuthStore } from '@/stores/auth'
import { useAuthGuard } from '@/composables/useAuthGuard'
import CollabFolderCard from '@/components/business/CollabFolderCard.vue'
import ShareDialog from '@/components/business/ShareDialog.vue'
import type { CollabFolder, CollabFolderMember, CollabFolderDocument } from '@/types'

const collabStore = useCollaborationStore()
const auth = useAuthStore()
const { requireAuth } = useAuthGuard()

// Detail view state
const activeTab = ref<'documents' | 'members'>('documents')
const currentFolder = computed(() => collabStore.currentFolder)
const isMember = computed(() => {
  if (!auth.isAuthenticated || !currentFolder.value) return false
  return collabStore.currentMembers.some(m => m.user_id === auth.user!.id && m.accepted_at)
})

// Dialog states
const showCreateDialog = ref(false)
const newFolderName = ref('')
const newFolderDesc = ref('')

const showInviteDialog = ref(false)
const inviteUserId = ref('')

const showAddDocDialog = ref(false)
const addDocId = ref('')

const showShareDialog = ref(false)
const shareFolderId = ref('')
const shareFolderName = ref('')
const shareFolderToken = ref<string | null>(null)

// Share token from URL (for shared link access)
const sharedFolderFromToken = ref<CollabFolder | null>(null)

onLoad(async (query) => {
  if (!requireAuth()) return

  // Check for share token in URL
  if (query?.token) {
    const folder = await collabStore.resolveShareToken(query.token)
    if (folder) {
      sharedFolderFromToken.value = folder
      await collabStore.loadFolderDetail(folder.id)
    }
  }
})

onShow(() => {
  if (!requireAuth()) return
  if (!sharedFolderFromToken.value) {
    collabStore.fetchFolders()
  }
})

function getMemberCount(folder: CollabFolder): number {
  const members = folder.members as unknown
  if (Array.isArray(members)) return members.length
  if (members && typeof members === 'object' && 'count' in (members as Record<string, unknown>)) {
    return (members as { count: number }).count
  }
  return 0
}

function getDocumentCount(_folder: CollabFolder): number {
  // document_count is not directly available from list query
  return 0
}

// --- Folder Detail ---

async function openFolderDetail(folder: CollabFolder) {
  await collabStore.loadFolderDetail(folder.id)
  activeTab.value = 'documents'
}

function closeFolderDetail() {
  collabStore.currentFolder = null
  collabStore.currentMembers = []
  collabStore.currentDocuments = []
  sharedFolderFromToken.value = null
}

function goToDocumentDetail(doc: CollabFolderDocument) {
  if (doc.document_id) {
    uni.navigateTo({ url: `/pages/detail/index?id=${doc.document_id}` })
  }
}

// --- Create Folder ---

function openCreateDialog() {
  newFolderName.value = ''
  newFolderDesc.value = ''
  showCreateDialog.value = true
}

async function handleCreateFolder() {
  if (!newFolderName.value.trim()) {
    uni.showToast({ title: '请输入文件夹名称', icon: 'none' })
    return
  }

  try {
    await collabStore.createFolder(newFolderName.value.trim(), newFolderDesc.value.trim())
    showCreateDialog.value = false
    uni.showToast({ title: '创建成功', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: err instanceof Error ? err.message : '创建失败', icon: 'none' })
  }
}

// --- Invite Member ---

function openInviteDialog() {
  inviteUserId.value = ''
  showInviteDialog.value = true
}

async function handleInviteMember() {
  if (!inviteUserId.value.trim()) {
    uni.showToast({ title: '请输入用户 ID', icon: 'none' })
    return
  }

  if (!currentFolder.value) return

  try {
    await collabStore.inviteMember(currentFolder.value.id, inviteUserId.value.trim())
    showInviteDialog.value = false
    uni.showToast({ title: '邀请已发送', icon: 'none' })
  } catch (err) {
    uni.showToast({ title: '邀请失败', icon: 'none' })
  }
}

async function handleRemoveMember(memberId: string) {
  try {
    await collabStore.removeMember(memberId)
    uni.showToast({ title: '已移除', icon: 'none' })
  } catch {
    uni.showToast({ title: '移除失败', icon: 'none' })
  }
}

// --- Add Document ---

function openAddDocumentDialog() {
  addDocId.value = ''
  showAddDocDialog.value = true
}

async function handleAddDocument() {
  if (!addDocId.value.trim()) {
    uni.showToast({ title: '请输入文献 ID', icon: 'none' })
    return
  }

  if (!currentFolder.value) return

  try {
    await collabStore.addDocumentToFolder(currentFolder.value.id, addDocId.value.trim())
    showAddDocDialog.value = false
    uni.showToast({ title: '已添加', icon: 'none' })
  } catch {
    uni.showToast({ title: '添加失败', icon: 'none' })
  }
}

async function handleRemoveDocument(folderDocId: string) {
  try {
    await collabStore.removeDocumentFromFolder(folderDocId)
  } catch {
    uni.showToast({ title: '移除失败', icon: 'none' })
  }
}

// --- Share ---

function openShareDialog(folder: CollabFolder) {
  shareFolderId.value = folder.id
  shareFolderName.value = folder.name
  shareFolderToken.value = folder.share_token
  showShareDialog.value = true
}

async function handleGenerateShareToken(folderId: string) {
  try {
    const token = await collabStore.generateShareToken(folderId)
    shareFolderToken.value = token
  } catch {
    uni.showToast({ title: '生成失败', icon: 'none' })
  }
}

// --- Settings ---

function openSettingsDialog() {
  // TODO: 文件夹设置弹窗（修改名称/描述/公开状态）
  uni.showToast({ title: '设置功能开发中', icon: 'none' })
}

// --- Helpers ---

function getInitial(member: CollabFolderMember): string {
  const profile = member.profile
  if (profile) {
    const p = profile as unknown as Record<string, unknown>
    const name = (p.display_name as string) || (p.username as string)
    if (name) return name.charAt(0).toUpperCase()
  }
  return '?'
}

function getMemberName(member: CollabFolderMember): string {
  const profile = member.profile
  if (profile) {
    const p = profile as unknown as Record<string, unknown>
    return (p.display_name as string) || (p.username as string) || '未知用户'
  }
  return '未知用户'
}

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = { owner: '创建者', admin: '管理员', member: '成员' }
  return labels[role] || role
}
</script>

<style scoped>
.collaboration-page {
  min-height: 100vh;
  background-color: #f5f5f5;
  padding-bottom: 20px;
}

/* Header */
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
}

.page-title {
  font-size: 20px;
  font-weight: 700;
  color: #333;
}

.create-btn {
  font-size: 14px;
  color: #0066cc;
  font-weight: 500;
}

/* Loading & Empty */
.loading {
  text-align: center;
  padding: 60px 24px;
}

.loading-text {
  font-size: 14px;
  color: #999;
}

.empty-state {
  text-align: center;
  padding: 60px 24px;
}

.empty-icon {
  font-size: 48px;
  display: block;
  margin-bottom: 16px;
}

.empty-text {
  font-size: 16px;
  color: #666;
  display: block;
  margin-bottom: 8px;
}

.empty-hint {
  font-size: 13px;
  color: #999;
  display: block;
  margin-bottom: 16px;
}

.empty-action {
  font-size: 14px;
  color: #0066cc;
  font-weight: 500;
}

/* Folder List */
.folder-list {
  padding: 0 16px;
}

/* Detail View */
.detail-header {
  display: flex;
  align-items: center;
  padding: 16px;
  gap: 12px;
}

.back-btn {
  font-size: 14px;
  color: #0066cc;
  font-weight: 500;
  flex-shrink: 0;
}

.detail-title {
  font-size: 18px;
  font-weight: 700;
  color: #333;
  flex: 1;
}

.settings-btn {
  font-size: 18px;
  flex-shrink: 0;
}

.folder-description {
  font-size: 14px;
  color: #666;
  padding: 0 16px 12px;
  display: block;
}

/* Tabs */
.tab-bar {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
  margin-bottom: 12px;
}

.tab {
  flex: 1;
  text-align: center;
  padding: 10px 0;
  font-size: 14px;
  color: #666;
  border-bottom: 2px solid transparent;
}

.tab.active {
  color: #0066cc;
  font-weight: 600;
  border-bottom-color: #0066cc;
}

.tab-content {
  padding: 0 16px;
}

.add-section {
  margin-bottom: 12px;
}

.add-btn {
  font-size: 14px;
  color: #0066cc;
  font-weight: 500;
}

.empty-tab {
  text-align: center;
  padding: 40px 24px;
}

.empty-tab-text {
  font-size: 14px;
  color: #999;
}

/* Document Item */
.doc-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.doc-content {
  flex: 1;
  min-width: 0;
}

.doc-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  display: block;
  line-height: 1.4;
}

.doc-authors {
  font-size: 12px;
  color: #999;
  display: block;
  margin-top: 2px;
}

.doc-remove {
  font-size: 14px;
  color: #e53e3e;
  padding: 8px;
  flex-shrink: 0;
}

/* Member Item */
.member-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
}

.member-avatar {
  width: 36px;
  height: 36px;
  border-radius: 18px;
  background: #0066cc;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 10px;
  flex-shrink: 0;
}

.avatar-text {
  font-size: 14px;
  color: #fff;
  font-weight: 600;
}

.member-info {
  flex: 1;
}

.member-name {
  font-size: 14px;
  font-weight: 500;
  color: #333;
  display: block;
}

.member-role {
  font-size: 12px;
  color: #999;
}

.member-remove {
  font-size: 12px;
  color: #e53e3e;
  font-weight: 500;
  flex-shrink: 0;
}

/* Dialog */
.dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 999;
}

.dialog {
  background: #fff;
  border-radius: 12px;
  padding: 24px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.dialog-title {
  font-size: 18px;
  font-weight: 600;
  color: #333;
  display: block;
  margin-bottom: 16px;
}

.form-item {
  margin-bottom: 16px;
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

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.dialog-btn {
  font-size: 14px;
  font-weight: 500;
  padding: 8px 20px;
  border-radius: 8px;
}

.dialog-btn.cancel {
  color: #666;
  background: #f0f0f0;
}

.dialog-btn.confirm {
  color: #fff;
  background: #0066cc;
}
</style>
