-- ============================================
-- PaperNow Database Schema
-- Version: 001
-- Description: Initial schema for PaperNow
-- ============================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For full-text fuzzy search

-- ============================================
-- 1. Users table (extends Supabase Auth users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    display_name TEXT,
    avatar_url TEXT,
    bio TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. Documents table (preprint literature metadata)
-- ============================================
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    abstract TEXT,
    authors TEXT[],                    -- Array of author names
    keywords TEXT[],                   -- Array of keywords
    category TEXT,                     -- Primary category (e.g., "cs.AI", "q-bio.BM")
    source TEXT NOT NULL,              -- Source: "arXiv", "PubMed", "ChinaRxiv", "bioRxiv", "medRxiv"
    source_id TEXT,                    -- Original ID from source (e.g., arXiv ID)
    publish_date DATE,
    pdf_url TEXT,                      -- URL to PDF
    citation_count INTEGER DEFAULT 0,
    doi TEXT,                          -- Digital Object Identifier
    metadata JSONB DEFAULT '{}',      -- Additional metadata (flexible)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure unique documents per source
    UNIQUE(source, source_id)
);

-- ============================================
-- 3. User Collections (favorites/bookmarks)
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_collections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    reading_status TEXT DEFAULT 'unread' CHECK (reading_status IN ('unread', 'reading', 'read')),
    notes TEXT,                        -- User's personal notes
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each user can collect a document once
    UNIQUE(user_id, document_id)
);

-- ============================================
-- 4. User Tags
-- ============================================
CREATE TABLE IF NOT EXISTS public.user_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT DEFAULT '#0066cc',      -- Tag color
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Unique tag name per user
    UNIQUE(user_id, name)
);

-- ============================================
-- 5. Document-Tag junction table
-- ============================================
CREATE TABLE IF NOT EXISTS public.document_tags (
    document_collection_id UUID NOT NULL REFERENCES public.user_collections(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.user_tags(id) ON DELETE CASCADE,
    PRIMARY KEY (document_collection_id, tag_id)
);

-- ============================================
-- 6. Collaboration Folders
-- ============================================
CREATE TABLE IF NOT EXISTS public.collab_folders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE,
    share_token TEXT UNIQUE,           -- For link sharing
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 7. Collaboration Folder Members
-- ============================================
CREATE TABLE IF NOT EXISTS public.collab_folder_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID NOT NULL REFERENCES public.collab_folders(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,

    -- Each user can be a member of a folder once
    UNIQUE(folder_id, user_id)
);

-- ============================================
-- 8. Collaboration Folder Documents
-- ============================================
CREATE TABLE IF NOT EXISTS public.collab_folder_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    folder_id UUID NOT NULL REFERENCES public.collab_folders(id) ON DELETE CASCADE,
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    added_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Each document can be in a folder once
    UNIQUE(folder_id, document_id)
);

-- ============================================
-- Indexes
-- ============================================

-- Documents search indexes
CREATE INDEX idx_documents_title_trgm ON public.documents USING GIN (title gin_trgm_ops);
CREATE INDEX idx_documents_abstract_trgm ON public.documents USING GIN (abstract gin_trgm_ops);
CREATE INDEX idx_documents_category ON public.documents(category);
CREATE INDEX idx_documents_source ON public.documents(source);
CREATE INDEX idx_documents_publish_date ON public.documents(publish_date DESC);
CREATE INDEX idx_documents_citation_count ON public.documents(citation_count DESC);
CREATE INDEX idx_documents_source_id ON public.documents(source, source_id);

-- User collections indexes
CREATE INDEX idx_user_collections_user_id ON public.user_collections(user_id);
CREATE INDEX idx_user_collections_document_id ON public.user_collections(document_id);
CREATE INDEX idx_user_collections_reading_status ON public.user_collections(reading_status);

-- User tags indexes
CREATE INDEX idx_user_tags_user_id ON public.user_tags(user_id);

-- Collaboration indexes
CREATE INDEX idx_collab_folders_owner_id ON public.collab_folders(owner_id);
CREATE INDEX idx_collab_folders_share_token ON public.collab_folders(share_token);
CREATE INDEX idx_collab_folder_members_folder_id ON public.collab_folder_members(folder_id);
CREATE INDEX idx_collab_folder_members_user_id ON public.collab_folder_members(user_id);
CREATE INDEX idx_collab_folder_documents_folder_id ON public.collab_folder_documents(folder_id);

-- ============================================
-- Auto-update updated_at trigger
-- ============================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON public.documents
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_user_collections_updated_at BEFORE UPDATE ON public.user_collections
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_collab_folders_updated_at BEFORE UPDATE ON public.collab_folders
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- Full-text search function
-- ============================================
CREATE OR REPLACE FUNCTION public.search_documents(
    search_query TEXT,
    p_category TEXT DEFAULT NULL,
    p_source TEXT DEFAULT NULL,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_sort_by TEXT DEFAULT 'relevance',
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    title TEXT,
    abstract TEXT,
    authors TEXT[],
    keywords TEXT[],
    category TEXT,
    source TEXT,
    source_id TEXT,
    publish_date DATE,
    pdf_url TEXT,
    citation_count INTEGER,
    doi TEXT,
    similarity_score REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT
        d.id,
        d.title,
        d.abstract,
        d.authors,
        d.keywords,
        d.category,
        d.source,
        d.source_id,
        d.publish_date,
        d.pdf_url,
        d.citation_count,
        d.doi,
        GREATEST(
            similarity(d.title, search_query),
            similarity(d.abstract, search_query)
        ) AS similarity_score
    FROM public.documents d
    WHERE
        (d.title ILIKE '%' || search_query || '%' OR d.abstract ILIKE '%' || search_query || '%')
        AND (p_category IS NULL OR d.category = p_category)
        AND (p_source IS NULL OR d.source = p_source)
        AND (p_date_from IS NULL OR d.publish_date >= p_date_from)
        AND (p_date_to IS NULL OR d.publish_date <= p_date_to)
    ORDER BY
        CASE p_sort_by
            WHEN 'time' THEN (-1 * EXTRACT(EPOCH FROM d.publish_date))
            WHEN 'citations' THEN (-1 * d.citation_count)
            ELSE (-1 * GREATEST(similarity(d.title, search_query), similarity(d.abstract, search_query)))
        END ASC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- ============================================
-- RLS Policies
-- ============================================

-- Profiles: users can only update their own profile
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Documents: readable by all, writable by service role only
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Documents are viewable by everyone" ON public.documents FOR SELECT USING (true);

-- User Collections: only owner can access
ALTER TABLE public.user_collections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own collections" ON public.user_collections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own collections" ON public.user_collections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own collections" ON public.user_collections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own collections" ON public.user_collections FOR DELETE USING (auth.uid() = user_id);

-- User Tags: only owner can access
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own tags" ON public.user_tags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own tags" ON public.user_tags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tags" ON public.user_tags FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tags" ON public.user_tags FOR DELETE USING (auth.uid() = user_id);

-- Document Tags: accessible through collection ownership
ALTER TABLE public.document_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own document tags" ON public.document_tags FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = document_collection_id AND user_id = auth.uid())
);
CREATE POLICY "Users can manage own document tags" ON public.document_tags FOR ALL USING (
    EXISTS (SELECT 1 FROM public.user_collections WHERE id = document_collection_id AND user_id = auth.uid())
);

-- Collab Folders: owner and members can view
ALTER TABLE public.collab_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own or member folders" ON public.collab_folders FOR SELECT USING (
    owner_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_folder_members WHERE folder_id = id AND user_id = auth.uid())
    OR is_public = TRUE
);
CREATE POLICY "Users can create folders" ON public.collab_folders FOR INSERT WITH CHECK (owner_id = auth.uid());
CREATE POLICY "Owners can update folders" ON public.collab_folders FOR UPDATE USING (owner_id = auth.uid());
CREATE POLICY "Owners can delete folders" ON public.collab_folders FOR DELETE USING (owner_id = auth.uid());

-- Collab Folder Members: owner and members can view
ALTER TABLE public.collab_folder_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Folder members are viewable by folder access" ON public.collab_folder_members FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.collab_folders WHERE id = folder_id AND (owner_id = auth.uid() OR is_public = TRUE))
    OR user_id = auth.uid()
);
CREATE POLICY "Owners can manage members" ON public.collab_folder_members FOR ALL USING (
    EXISTS (SELECT 1 FROM public.collab_folders WHERE id = folder_id AND owner_id = auth.uid())
);

-- Collab Folder Documents: accessible by folder members
ALTER TABLE public.collab_folder_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Folder documents viewable by members" ON public.collab_folder_documents FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.collab_folders WHERE id = folder_id AND (owner_id = auth.uid() OR is_public = TRUE))
    OR EXISTS (SELECT 1 FROM public.collab_folder_members WHERE folder_id = folder_id AND user_id = auth.uid())
);
CREATE POLICY "Folder members can add documents" ON public.collab_folder_documents FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.collab_folders WHERE id = folder_id AND owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.collab_folder_members WHERE folder_id = folder_id AND user_id = auth.uid())
);
CREATE POLICY "Folder members can remove documents" ON public.collab_folder_documents FOR DELETE USING (
    added_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.collab_folders WHERE id = folder_id AND owner_id = auth.uid())
);
