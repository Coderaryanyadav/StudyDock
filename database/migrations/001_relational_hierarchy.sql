-- ==============================================================================
-- STUDYDOCK MIGRATION 001: Relational Data Model Hierarchy & Indexes
-- Hierarchy:
--   USER -> BOOK -> CHAPTER -> SECTION -> PAGE -> CHUNK
--   USER -> BOOK -> VIDEO -> VIDEO_SEGMENT
-- ==============================================================================

-- 1. Ensure extensions exist
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Create / ensure chapters table
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    number INT NOT NULL,
    title TEXT NOT NULL,
    start_page INT NOT NULL,
    end_page INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create / ensure sections table
CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    page_number INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Ensure foreign keys and columns on book_pages
DO $$ BEGIN
    -- Ensure chapter_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'book_pages' AND column_name = 'chapter_id'
    ) THEN
        ALTER TABLE book_pages ADD COLUMN chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL;
    END IF;

    -- Ensure section_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'book_pages' AND column_name = 'section_id'
    ) THEN
        ALTER TABLE book_pages ADD COLUMN section_id UUID REFERENCES sections(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 5. Ensure foreign keys on book_chunks
DO $$ BEGIN
    -- Ensure page_id column exists
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'book_chunks' AND column_name = 'page_id'
    ) THEN
        ALTER TABLE book_chunks ADD COLUMN page_id UUID REFERENCES book_pages(id) ON DELETE CASCADE;
    END IF;
END $$;

-- 6. Create / ensure video_segments table
CREATE TABLE IF NOT EXISTS video_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    timestamp_seconds INT NOT NULL,
    formatted_time TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Add comprehensive relational and lookup indexes
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_chapters_book_number ON chapters(book_id, number);
CREATE INDEX IF NOT EXISTS idx_sections_chapter_id ON sections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_sections_page_number ON sections(page_number);

CREATE INDEX IF NOT EXISTS idx_book_pages_book_id ON book_pages(book_id);
CREATE INDEX IF NOT EXISTS idx_book_pages_chapter_id ON book_pages(chapter_id);
CREATE INDEX IF NOT EXISTS idx_book_pages_section_id ON book_pages(section_id);
CREATE INDEX IF NOT EXISTS idx_book_pages_book_page ON book_pages(book_id, page_number);

CREATE INDEX IF NOT EXISTS idx_book_chunks_book_id ON book_chunks(book_id);
CREATE INDEX IF NOT EXISTS idx_book_chunks_page_id ON book_chunks(page_id);
CREATE INDEX IF NOT EXISTS idx_book_chunks_book_page ON book_chunks(book_id, page_number);

CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_book_id ON videos(book_id);
CREATE INDEX IF NOT EXISTS idx_video_segments_video_id ON video_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_topics_video_id ON video_topics(video_id);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_video_id ON video_transcripts(video_id);

-- 8. Row Level Security for new tables
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_segments ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'chapters' AND policyname = 'Users can access chapters of own books'
    ) THEN
        CREATE POLICY "Users can access chapters of own books" ON chapters
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.user_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.user_id = auth.uid()));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'sections' AND policyname = 'Users can access sections of own books'
    ) THEN
        CREATE POLICY "Users can access sections of own books" ON sections
            FOR ALL TO authenticated
            USING (EXISTS (
                SELECT 1 FROM chapters
                INNER JOIN books ON books.id = chapters.book_id
                WHERE chapters.id = sections.chapter_id AND books.user_id = auth.uid()
            ))
            WITH CHECK (EXISTS (
                SELECT 1 FROM chapters
                INNER JOIN books ON books.id = chapters.book_id
                WHERE chapters.id = sections.chapter_id AND books.user_id = auth.uid()
            ));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'video_segments' AND policyname = 'Users can access segments of own videos'
    ) THEN
        CREATE POLICY "Users can access segments of own videos" ON video_segments
            FOR ALL TO authenticated
            USING (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_segments.video_id AND videos.user_id = auth.uid()))
            WITH CHECK (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_segments.video_id AND videos.user_id = auth.uid()));
    END IF;
END $$;

-- 9. Update match_book_chunks RPC to join chapters & sections relations cleanly
CREATE OR REPLACE FUNCTION match_book_chunks (
    query_embedding vector(768),
    match_threshold float,
    match_count int,
    filter_book_id uuid,
    filter_user_id uuid DEFAULT NULL
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
    current_uid := COALESCE(auth.uid(), filter_user_id);
    
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
    FROM book_chunks bc
    INNER JOIN books b ON b.id = bc.book_id
    LEFT JOIN book_pages bp ON bp.id = bc.page_id
    LEFT JOIN chapters c ON c.id = bp.chapter_id
    LEFT JOIN sections s ON s.id = bp.section_id
    WHERE b.user_id = current_uid
      AND (filter_book_id IS NULL OR bc.book_id = filter_book_id)
      AND (1 - (bc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY bc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

REVOKE EXECUTE ON FUNCTION match_book_chunks(vector, float, int, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION match_book_chunks(vector, float, int, uuid, uuid) TO authenticated;
