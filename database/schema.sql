-- ==============================================================================
-- STUDYDOCK: Production PostgreSQL & pgvector Database Schema
-- Multi-tenant Academic Learning Platform with Strict Row Level Security (RLS)
-- ==============================================================================

-- 1. Enable pgvector extension for semantic AI embeddings (Google text-embedding-004: 768 dims)
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- PROFILES / USERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- BOOKS & DOCUMENTS
-- ------------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE document_status AS ENUM (
        'UPLOADING',
        'PROCESSING',
        'EMBEDDING',
        'READY',
        'PARTIALLY_INDEXED',
        'OCR_REQUIRED',
        'FAILED'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS books (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    author TEXT DEFAULT 'Unknown Author',
    edition TEXT DEFAULT '1st Edition',
    subject TEXT DEFAULT 'General Studies',
    total_pages INT DEFAULT 1,
    cover_image TEXT,
    storage_path TEXT,
    file_size_bytes BIGINT,
    mime_type TEXT DEFAULT 'application/pdf',
    status document_status DEFAULT 'READY',
    status_message TEXT,
    last_page_read INT DEFAULT 1,
    youtube_url TEXT,
    video_title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- CHAPTERS & SECTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    number INT NOT NULL,
    title TEXT NOT NULL,
    start_page INT NOT NULL,
    end_page INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    page_number INT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- BOOK PAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
    page_number INT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    key_takeaways TEXT[] DEFAULT '{}',
    equations TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_book_page UNIQUE(book_id, page_number)
);

-- ------------------------------------------------------------------------------
-- BOOK CHUNKS & VECTOR EMBEDDINGS (pgvector)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_id UUID REFERENCES book_pages(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL DEFAULT 0,
    page_number INT NOT NULL,
    chapter_title TEXT,
    section_title TEXT,
    text TEXT NOT NULL,
    key_terms TEXT[] DEFAULT '{}',
    embedding vector(768), -- Google Gemini text-embedding-004 dimensions
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_book_chunk UNIQUE(book_id, chunk_index)
);

-- Create HNSW vector similarity index for fast cosine retrieval
CREATE INDEX IF NOT EXISTS book_chunks_embedding_idx ON book_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS book_chunks_book_page_idx ON book_chunks (book_id, page_number);

-- ------------------------------------------------------------------------------
-- VIDEOS & LECTURE TOPIC TIMESTAMPS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    youtube_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT,
    duration_seconds INT DEFAULT 0,
    formatted_duration TEXT DEFAULT '00:00',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    timestamp_seconds INT NOT NULL,
    formatted_time TEXT NOT NULL,
    title TEXT NOT NULL,
    page_number INT,
    summary TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- CONVERSATIONS & CHAT MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    title TEXT DEFAULT 'Academic Tutor Session',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    learning_mode TEXT DEFAULT 'explain',
    context_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES book_chunks(id) ON DELETE SET NULL,
    book_title TEXT NOT NULL,
    chapter_title TEXT,
    section_title TEXT,
    page_number INT NOT NULL,
    excerpt TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- ANNOTATIONS: HIGHLIGHTS & BOOKMARKS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    text TEXT NOT NULL,
    color TEXT DEFAULT 'yellow' CHECK (color IN ('yellow', 'blue', 'green', 'pink')),
    note TEXT,
    bounding_rect JSONB,
    rects JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_bookmark UNIQUE(user_id, book_id, page_number)
);

CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    selected_text TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- FLASHCARDS & SPACED REPETITION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    concept TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    status TEXT DEFAULT 'unseen' CHECK (status IN ('unseen', 'learning', 'mastered')),
    last_reviewed TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- QUIZZES & ASSESSMENT ATTEMPTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_questions INT DEFAULT 3,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL,
    concept TEXT NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of { id, text, isCorrect }
    explanation TEXT NOT NULL,
    difficulty TEXT DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score INT NOT NULL,
    total_questions INT NOT NULL,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- CONCEPTS & STUDENT MASTERY RADAR
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS student_concepts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    concept_id UUID NOT NULL REFERENCES concepts(id) ON DELETE CASCADE,
    mastery_percentage INT DEFAULT 50 CHECK (mastery_percentage BETWEEN 0 AND 100),
    questions_attempted INT DEFAULT 0,
    questions_correct INT DEFAULT 0,
    is_weak BOOLEAN DEFAULT FALSE,
    recommended_chapter TEXT,
    recommended_page INT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_concept UNIQUE(user_id, concept_id)
);

-- ------------------------------------------------------------------------------
-- STUDY SESSIONS & PROGRESS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE SET NULL,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INT DEFAULT 0,
    pages_read INT DEFAULT 0,
    video_time_seconds INT DEFAULT 0,
    questions_asked INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_progress (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    total_study_minutes INT DEFAULT 0,
    streak_days INT DEFAULT 1,
    chapters_completed INT DEFAULT 0,
    videos_watched INT DEFAULT 0,
    quizzes_completed INT DEFAULT 0,
    questions_asked INT DEFAULT 0,
    active_subject TEXT DEFAULT 'Computer Science',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- PGVECTOR COSINE SIMILARITY SEARCH FUNCTION
-- ==============================================================================
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
    -- Authoritative identity: Use auth.uid() when invoked from authenticated context,
    -- or validate filter_user_id against book ownership
    current_uid := COALESCE(auth.uid(), filter_user_id);
    
    IF current_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required for vector retrieval';
    END IF;

    RETURN QUERY
    SELECT
        bc.id,
        bc.book_id,
        bc.chunk_index,
        bc.page_number,
        bc.chapter_title,
        bc.section_title,
        bc.text,
        bc.key_terms,
        (1 - (bc.embedding <=> query_embedding))::float AS similarity
    FROM book_chunks bc
    INNER JOIN books b ON b.id = bc.book_id
    WHERE b.user_id = current_uid
      AND (filter_book_id IS NULL OR bc.book_id = filter_book_id)
      AND (1 - (bc.embedding <=> query_embedding)) >= match_threshold
    ORDER BY bc.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- Revoke function execution from public and anon, grant only to authenticated role
REVOKE EXECUTE ON FUNCTION match_book_chunks(vector, float, int, uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION match_book_chunks(vector, float, int, uuid, uuid) TO authenticated;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/update their own profile
CREATE POLICY "Users can access own profile" ON profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Books: users only access and create books they own
CREATE POLICY "Users can access own books" ON books
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Chapters & Sections: accessible if user owns the book
CREATE POLICY "Users can access chapters of own books" ON chapters
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.user_id = auth.uid()));

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

-- Book Pages & Chunks: accessible if user owns the book
CREATE POLICY "Users can access pages of own books" ON book_pages
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = book_pages.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = book_pages.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can access chunks of own books" ON book_chunks
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = book_chunks.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = book_chunks.book_id AND books.user_id = auth.uid()));

-- Videos: accessible if user owns video
CREATE POLICY "Users can access own videos" ON videos
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access topics of own videos" ON video_topics
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_topics.video_id AND videos.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_topics.video_id AND videos.user_id = auth.uid()));

-- Conversations & Messages
CREATE POLICY "Users can access own conversations" ON conversations
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access messages of own conversations" ON messages
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM conversations WHERE conversations.id = messages.conversation_id AND conversations.user_id = auth.uid()));

CREATE POLICY "Users can access citations of own messages" ON message_citations
    FOR ALL TO authenticated
    USING (EXISTS (
        SELECT 1 FROM messages
        INNER JOIN conversations ON conversations.id = messages.conversation_id
        WHERE messages.id = message_citations.message_id AND conversations.user_id = auth.uid()
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM messages
        INNER JOIN conversations ON conversations.id = messages.conversation_id
        WHERE messages.id = message_citations.message_id AND conversations.user_id = auth.uid()
    ));

-- Annotations: Highlights & Bookmarks
CREATE POLICY "Users can access own highlights" ON highlights
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access own bookmarks" ON bookmarks
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access own notes" ON notes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Flashcards
CREATE POLICY "Users can access own flashcards" ON flashcards
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Quizzes & Attempts
CREATE POLICY "Users can access own quizzes" ON quizzes
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access questions of own quizzes" ON quiz_questions
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM quizzes WHERE quizzes.id = quiz_questions.quiz_id AND quizzes.user_id = auth.uid()));

CREATE POLICY "Users can access own quiz attempts" ON quiz_attempts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Concept Mastery & Progress
CREATE POLICY "Users can access own concept mastery" ON student_concepts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access own study sessions" ON study_sessions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access own progress" ON student_progress
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------------------------
-- STORAGE BUCKET RLS: textbooks (Private Per-User Storage)
-- ------------------------------------------------------------------------------
-- Ensure private isolation inside storage bucket: textbooks/{auth.uid()}/*
DO $$ BEGIN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('textbooks', 'textbooks', false)
    ON CONFLICT (id) DO UPDATE SET public = false;
EXCEPTION
    WHEN undefined_table THEN null;
END $$;

DO $$ BEGIN
    CREATE POLICY "Users can upload own textbooks to storage" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'textbooks' AND (storage.foldername(name))[1] = auth.uid()::text);

    CREATE POLICY "Users can view own textbooks from storage" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'textbooks' AND (storage.foldername(name))[1] = auth.uid()::text);

    CREATE POLICY "Users can delete own textbooks from storage" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'textbooks' AND (storage.foldername(name))[1] = auth.uid()::text);
EXCEPTION
    WHEN undefined_table THEN null;
    WHEN duplicate_object THEN null;
END $$;
