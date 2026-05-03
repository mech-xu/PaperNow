-- Change documents.id from UUID to TEXT to support external source IDs
-- like "medrxiv:10.1101/2025.05.02.25326904", "chinaxiv-202604.00234", etc.

-- 1. Drop foreign key constraints first
ALTER TABLE public.user_collections DROP CONSTRAINT user_collections_document_id_fkey;
ALTER TABLE public.collab_folder_documents DROP CONSTRAINT collab_folder_documents_document_id_fkey;

-- 2. Drop indexes on document_id
DROP INDEX IF EXISTS public.idx_user_collections_document_id;
DROP INDEX IF EXISTS public.idx_collab_folder_documents_folder_id;

-- 3. Change documents.id type from UUID to TEXT
ALTER TABLE public.documents ALTER COLUMN id TYPE TEXT USING id::TEXT;
-- Remove the default uuid_generate_v4() - we'll use application-generated IDs
ALTER TABLE public.documents ALTER COLUMN id DROP DEFAULT;

-- 4. Change user_collections.document_id from UUID to TEXT
ALTER TABLE public.user_collections ALTER COLUMN document_id TYPE TEXT USING document_id::TEXT;

-- 5. Change collab_folder_documents.document_id from UUID to TEXT
ALTER TABLE public.collab_folder_documents ALTER COLUMN document_id TYPE TEXT USING document_id::TEXT;

-- 6. Re-add foreign key constraints
ALTER TABLE public.user_collections
  ADD CONSTRAINT user_collections_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

ALTER TABLE public.collab_folder_documents
  ADD CONSTRAINT collab_folder_documents_document_id_fkey
  FOREIGN KEY (document_id) REFERENCES public.documents(id) ON DELETE CASCADE;

-- 7. Re-add indexes
CREATE INDEX idx_user_collections_document_id ON public.user_collections(document_id);
CREATE INDEX idx_collab_folder_documents_folder_id ON public.collab_folder_documents(folder_id);

-- 8. Update the search_documents function return type
-- Must DROP first because return type changed (UUID -> TEXT)
DROP FUNCTION IF EXISTS public.search_documents(TEXT, TEXT, TEXT, DATE, DATE, TEXT, INTEGER, INTEGER);

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
    id TEXT,
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
