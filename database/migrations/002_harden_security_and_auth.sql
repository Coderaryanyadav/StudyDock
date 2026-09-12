-- ==============================================================================
-- STUDYDOCK MIGRATION 002: Hardened Ownership, RLS, and Safe Functions
-- ==============================================================================

-- 1. Hardened SECURITY DEFINER match_book_chunks function
-- - Derives identity strictly from auth.uid()
-- - Pinned search_path: public, auth
-- - Schema-qualified table references (public.*)
-- - Restricted execution: authenticated role only
CREATE OR REPLACE FUNCTION match_book_chunks (
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    filter_book_id uuid
)
RETURNS TABLE (
    id uuid,
    book_id uuid,
    page_id uuid,
    chunk_index int,
    page_number int,
    chapter_title text,
    section_title text,
    text text,
    key_terms text[],
    similarity float
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    current_uid uuid;
BEGIN
    -- Derive authoritative user identity from current auth session
    current_uid := auth.uid();
    
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required for vector retrieval';
    END IF;

    RETURN QUERY
    SELECT
        bc.id,
        bc.book_id,
        bc.page_id,
        bc.chunk_index,
        bc.page_number,
        COALESCE(c.title, bc.chapter_title) AS chapter_title,
        COALESCE(s.title, bc.section_title) AS section_title,
        bc.text,
        bc.key_terms,
        (1 - (bc.embedding <=> query_embedding))::float AS similarity
    FROM public.book_chunks bc
    INNER JOIN public.books b ON b.id = bc.book_id
    LEFT JOIN public.book_pages bp ON bp.id = bc.page_id
    LEFT JOIN public.chapters c ON c.id = bp.chapter_id
    LEFT JOIN public.sections s ON s.id = bp.section_id
    WHERE b.user_id = current_uid
      AND (filter_book_id IS NULL OR bc.book_id = filter_book_id)
      AND (1 - (bc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY bc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Revoke execute from public and anon, grant strictly to authenticated users
REVOKE ALL ON FUNCTION match_book_chunks(vector, float, int, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION match_book_chunks(vector, float, int, uuid) TO authenticated;
