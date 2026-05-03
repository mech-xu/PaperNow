// ============================================
// PaperNow Type Definitions
// ============================================

// --- Database entity types ---

export interface Profile {
  id: string
  username: string | null
  display_name: string | null
  avatar_url: string | null
  bio: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  title: string
  abstract: string | null
  authors: string[] | null
  keywords: string[] | null
  category: string | null
  source: string
  source_id: string | null
  publish_date: string | null
  pdf_url: string | null
  citation_count: number
  doi: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface UserCollection {
  id: string
  user_id: string
  document_id: string
  reading_status: ReadingStatus
  notes: string | null
  created_at: string
  updated_at: string
  // Joined
  document?: Document
  tags?: UserTag[]
}

export interface UserTag {
  id: string
  user_id: string
  name: string
  color: string
  created_at: string
}

export interface DocumentTag {
  document_collection_id: string
  tag_id: string
}

export interface CollabFolder {
  id: string
  owner_id: string
  name: string
  description: string | null
  is_public: boolean
  share_token: string | null
  created_at: string
  updated_at: string
  // Joined
  owner?: Profile
  members?: CollabFolderMember[]
  document_count?: number
}

export interface CollabFolderMember {
  id: string
  folder_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  invited_at: string
  accepted_at: string | null
  // Joined
  profile?: Profile
}

export interface CollabFolderDocument {
  id: string
  folder_id: string
  document_id: string
  added_by: string
  notes: string | null
  created_at: string
  // Joined
  document?: Document
}

// --- Enum types ---

export type ReadingStatus = 'unread' | 'reading' | 'read'
export type SortOption = 'relevance' | 'time' | 'citations'
export type SupportedSource = 'arXiv' | 'PubMed' | 'ChinaRxiv' | 'bioRxiv' | 'medRxiv'
export type CollabMemberRole = 'owner' | 'admin' | 'member'

// --- Search types ---

export interface SearchParams {
  query: string
  category?: string
  source?: SupportedSource
  dateFrom?: string
  dateTo?: string
  sortBy?: SortOption
  page?: number
  pageSize?: number
}

export interface SearchResult {
  documents: Document[]
  total: number
  page: number
  pageSize: number
  hasMore: boolean
}

// --- Auth types ---

export interface AuthState {
  user: Profile | null
  isAuthenticated: boolean
  isLoading: boolean
}

export interface LoginParams {
  email: string
  password: string
}

export interface RegisterParams {
  email: string
  password: string
  username?: string
}

// --- API response types ---

export interface ApiResponse<T> {
  data: T
  error: null
}

export interface ApiError {
  data: null
  error: {
    message: string
    code: string
    status: number
  }
}

export type ApiResult<T> = ApiResponse<T> | ApiError

// --- ChinaRxiv API types (https://chinarxiv.org/api/v1) ---

export interface ChinaRxivPaper {
  id: string
  title: string
  authors?: string[]
  abstract?: string
  date?: string
  subjects?: string[]
  has_full_text?: boolean
  has_figures?: boolean
  has_pdf?: boolean
  source_language?: 'zh' | 'en' | 'mixed' | 'ru' | 'de'
  source_url?: string
  _links?: {
    self?: string
    full_text?: string
    figures?: string
    pdf?: string
  }
}

export interface ChinaRxivPaperList {
  total: number
  limit: number
  next_cursor: string | null
  data: ChinaRxivPaper[]
}

export interface ChinaRxivPaperDetail extends ChinaRxivPaper {
  license?: Record<string, unknown>
  pdf_url?: string
  english_pdf_url?: string
}

export interface ChinaRxivPaperText {
  id: string
  title: string
  body_md: string
  word_count?: number
}

export interface ChinaRxivFigure {
  number: string
  url: string
  caption?: string
}

export interface ChinaRxivPaperFigures {
  id: string
  figures: ChinaRxivFigure[]
}
