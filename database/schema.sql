-- ==============================================================================
-- STUDYDOCK: Production PostgreSQL & pgvector Database Schema
-- Multi-tenant Academic Learning Platform with Strict Row Level Security (RLS)
-- ==============================================================================

-- 1. Extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- HELPER TRIGGERS: AUTO-UPDATE updated_at
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- PROFILES / USERS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    author TEXT NOT NULL DEFAULT 'Unknown Author',
    edition TEXT DEFAULT '1st Edition',
    subject TEXT DEFAULT 'General Studies',
    total_pages INT NOT NULL DEFAULT 1 CHECK (total_pages >= 1),
    cover_image TEXT,
    storage_path TEXT,
    file_size_bytes BIGINT CHECK (file_size_bytes IS NULL OR file_size_bytes > 0),
    mime_type TEXT DEFAULT 'application/pdf',
    status document_status NOT NULL DEFAULT 'READY',
    status_message TEXT,
    last_page_read INT NOT NULL DEFAULT 1 CHECK (last_page_read >= 1),
    youtube_url TEXT,
    video_title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- CHAPTERS & SECTIONS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS chapters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    number INT NOT NULL CHECK (number >= 1),
    title TEXT NOT NULL,
    start_page INT NOT NULL CHECK (start_page >= 1),
    end_page INT NOT NULL CHECK (end_page >= start_page),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_book_chapter_number UNIQUE(book_id, number)
);

CREATE TABLE IF NOT EXISTS sections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chapter_id UUID NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    title TEXT NOT NULL,
    page_number INT NOT NULL CHECK (page_number >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------------------------
-- BOOK PAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    chapter_id UUID REFERENCES chapters(id) ON DELETE SET NULL,
    section_id UUID REFERENCES sections(id) ON DELETE SET NULL,
    page_number INT NOT NULL CHECK (page_number >= 1),
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    key_takeaways TEXT[] NOT NULL DEFAULT '{}',
    equations TEXT[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_book_page UNIQUE(book_id, page_number)
);

-- ------------------------------------------------------------------------------
-- BOOK CHUNKS & VECTOR EMBEDDINGS (pgvector)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS book_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_id UUID REFERENCES book_pages(id) ON DELETE CASCADE,
    chunk_index INT NOT NULL DEFAULT 0 CHECK (chunk_index >= 0),
    page_number INT NOT NULL CHECK (page_number >= 1),
    chapter_title TEXT,
    section_title TEXT,
    text TEXT NOT NULL,
    key_terms TEXT[] NOT NULL DEFAULT '{}',
    embedding vector(768), -- Google Gemini text-embedding-004 dimensions
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_book_chunk UNIQUE(book_id, chunk_index)
);

-- HNSW vector similarity index for fast cosine retrieval
CREATE INDEX IF NOT EXISTS book_chunks_embedding_idx ON book_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS book_chunks_book_page_idx ON book_chunks (book_id, page_number);

-- ------------------------------------------------------------------------------
-- VIDEOS & LECTURE TOPIC TIMESTAMPS / SEGMENTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    youtube_id TEXT NOT NULL,
    title TEXT NOT NULL,
    channel_name TEXT,
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    formatted_duration TEXT NOT NULL DEFAULT '00:00',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_segments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    timestamp_seconds INT NOT NULL CHECK (timestamp_seconds >= 0),
    formatted_time TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_topics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    timestamp_seconds INT NOT NULL CHECK (timestamp_seconds >= 0),
    formatted_time TEXT NOT NULL,
    title TEXT NOT NULL,
    page_number INT CHECK (page_number IS NULL OR page_number >= 1),
    summary TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS video_transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    video_id UUID NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
    timestamp_seconds INT NOT NULL CHECK (timestamp_seconds >= 0),
    formatted_time TEXT NOT NULL,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for high-frequency video queries
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
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_book_id ON videos(book_id);
CREATE INDEX IF NOT EXISTS idx_video_segments_video_id ON video_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_video_topics_video_id ON video_topics(video_id);
CREATE INDEX IF NOT EXISTS idx_video_transcripts_video_id ON video_transcripts(video_id);

-- ------------------------------------------------------------------------------
-- CONVERSATIONS & CHAT MESSAGES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL DEFAULT 'Academic Tutor Session',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender TEXT NOT NULL CHECK (sender IN ('user', 'ai', 'system')),
    content TEXT NOT NULL,
    learning_mode TEXT DEFAULT 'explain',
    context_snapshot JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS message_citations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES book_chunks(id) ON DELETE SET NULL,
    source_type TEXT NOT NULL DEFAULT 'textbook',
    book_title TEXT NOT NULL,
    chapter_title TEXT,
    section_title TEXT,
    page_number INT NOT NULL CHECK (page_number >= 1),
    video_timestamp_seconds INT,
    video_formatted_time TEXT,
    excerpt TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_book ON conversations(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON conversations(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_message_citations_msg ON message_citations(message_id);

-- ------------------------------------------------------------------------------
-- ANNOTATIONS: HIGHLIGHTS, BOOKMARKS & NOTES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS highlights (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL CHECK (page_number >= 1),
    text TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT 'yellow' CHECK (color IN ('yellow', 'blue', 'green', 'pink')),
    note TEXT,
    bounding_rect JSONB,
    rects JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bookmarks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL CHECK (page_number >= 1),
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_bookmark UNIQUE(user_id, book_id, page_number)
);

CREATE TABLE IF NOT EXISTS notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL CHECK (page_number >= 1),
    selected_text TEXT,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON highlights(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_highlights_book_page ON highlights(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book ON bookmarks(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_book_page ON bookmarks(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_notes_user_book ON notes(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_notes_book_page ON notes(book_id, page_number);

-- ------------------------------------------------------------------------------
-- FLASHCARDS & SPACED REPETITION
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS flashcards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL CHECK (page_number >= 1),
    concept TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'unseen' CHECK (status IN ('unseen', 'learning', 'mastered')),
    last_reviewed TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_flashcards_user_book ON flashcards(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_book_page ON flashcards(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_status ON flashcards(user_id, status);

-- ------------------------------------------------------------------------------
-- QUIZZES & ASSESSMENT ATTEMPTS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quizzes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    total_questions INT NOT NULL DEFAULT 3 CHECK (total_questions >= 1),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    page_number INT NOT NULL CHECK (page_number >= 1),
    concept TEXT NOT NULL,
    question TEXT NOT NULL,
    options JSONB NOT NULL, -- Array of { id, text, isCorrect }
    explanation TEXT NOT NULL,
    difficulty TEXT NOT NULL DEFAULT 'medium' CHECK (difficulty IN ('easy', 'medium', 'hard')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS quiz_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    quiz_id UUID NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
    score INT NOT NULL CHECK (score >= 0),
    total_questions INT NOT NULL CHECK (total_questions >= 1),
    answers JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    time_spent INT NOT NULL DEFAULT 0 CHECK (time_spent >= 0)
);

CREATE INDEX IF NOT EXISTS idx_quizzes_user_book ON quizzes(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_quiz_questions_quiz_id ON quiz_questions(quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_quiz ON quiz_attempts(user_id, quiz_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_book ON quiz_attempts(user_id, book_id);

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
    mastery_percentage INT NOT NULL DEFAULT 50 CHECK (mastery_percentage BETWEEN 0 AND 100),
    questions_attempted INT NOT NULL DEFAULT 0 CHECK (questions_attempted >= 0),
    questions_correct INT NOT NULL DEFAULT 0 CHECK (questions_correct >= 0),
    is_weak BOOLEAN NOT NULL DEFAULT FALSE,
    recommended_chapter TEXT,
    recommended_page INT CHECK (recommended_page IS NULL OR recommended_page >= 1),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_user_concept UNIQUE(user_id, concept_id)
);

-- ------------------------------------------------------------------------------
-- STUDY SESSIONS, EVENTS & REAL-TIME ANALYTICS
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS study_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    duration_minutes INT NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    pages_read INT NOT NULL DEFAULT 0 CHECK (pages_read >= 0),
    pages_viewed INT[] NOT NULL DEFAULT '{}',
    pages_completed INT[] NOT NULL DEFAULT '{}',
    video_time_seconds INT NOT NULL DEFAULT 0 CHECK (video_time_seconds >= 0),
    questions_asked INT NOT NULL DEFAULT 0 CHECK (questions_asked >= 0),
    activity_type TEXT NOT NULL DEFAULT 'reading',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    session_id UUID REFERENCES study_sessions(id) ON DELETE SET NULL,
    event_type TEXT NOT NULL CHECK (event_type IN (
        'page_opened',
        'page_time',
        'page_completed',
        'highlight_created',
        'note_created',
        'bookmark_created',
        'video_started',
        'video_watched',
        'question_asked',
        'quiz_started',
        'quiz_completed',
        'flashcard_reviewed'
    )),
    page_number INT CHECK (page_number IS NULL OR page_number >= 1),
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS student_progress (
    user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
    total_study_minutes INT NOT NULL DEFAULT 0 CHECK (total_study_minutes >= 0),
    streak_days INT NOT NULL DEFAULT 1 CHECK (streak_days >= 0),
    chapters_completed INT NOT NULL DEFAULT 0 CHECK (chapters_completed >= 0),
    videos_watched INT NOT NULL DEFAULT 0 CHECK (videos_watched >= 0),
    quizzes_completed INT NOT NULL DEFAULT 0 CHECK (quizzes_completed >= 0),
    questions_asked INT NOT NULL DEFAULT 0 CHECK (questions_asked >= 0),
    active_subject TEXT NOT NULL DEFAULT 'Computer Science',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_events_user_book ON study_events(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_study_events_user_type ON study_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_study_events_created ON study_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_events_user_date ON study_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_events_session ON study_events(session_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_book ON study_sessions(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started ON study_sessions(user_id, started_at DESC);

-- ==============================================================================
-- PGVECTOR COSINE SIMILARITY SEARCH FUNCTION
-- ==============================================================================
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
ALTER TABLE video_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_transcripts ENABLE ROW LEVEL SECURITY;
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
ALTER TABLE concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_progress ENABLE ROW LEVEL SECURITY;

-- 1. Profiles
CREATE POLICY "Users can access own profile" ON profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- 2. Books
CREATE POLICY "Users can access own books" ON books
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 3. Chapters
CREATE POLICY "Users can access chapters of own books" ON chapters
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = chapters.book_id AND books.user_id = auth.uid()));

-- 4. Sections
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

-- 5. Book Pages
CREATE POLICY "Users can access pages of own books" ON book_pages
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = book_pages.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = book_pages.book_id AND books.user_id = auth.uid()));

-- 6. Book Chunks
CREATE POLICY "Users can access chunks of own books" ON book_chunks
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = book_chunks.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = book_chunks.book_id AND books.user_id = auth.uid()));

-- 7. Videos
CREATE POLICY "Users can access own videos" ON videos
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 8. Video Segments, Topics, Transcripts
CREATE POLICY "Users can access segments of own videos" ON video_segments
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_segments.video_id AND videos.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_segments.video_id AND videos.user_id = auth.uid()));

CREATE POLICY "Users can access topics of own videos" ON video_topics
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_topics.video_id AND videos.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_topics.video_id AND videos.user_id = auth.uid()));

CREATE POLICY "Users can access transcripts of own videos" ON video_transcripts
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_transcripts.video_id AND videos.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM videos WHERE videos.id = video_transcripts.video_id AND videos.user_id = auth.uid()));

-- 9. Conversations & Messages
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

-- 10. Annotations (Highlights, Bookmarks, Notes)
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

-- 11. Flashcards
CREATE POLICY "Users can access own flashcards" ON flashcards
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 12. Quizzes, Questions & Attempts
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

-- 13. Concepts & Mastery Radar
CREATE POLICY "Authenticated users can read concepts catalog" ON concepts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can access own concept mastery" ON student_concepts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- 14. Study Sessions, Events & Progress
CREATE POLICY "Users can access own study sessions" ON study_sessions
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can access own study events" ON study_events
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
