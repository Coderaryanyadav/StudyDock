-- ==============================================================================
-- STUDYDOCK MIGRATION 006: Comprehensive Database Security & Integrity Hardening
-- ==============================================================================

-- 1. Enable RLS across all tables (including catalog tables)
ALTER TABLE IF EXISTS profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS books ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS chapters ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS book_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS book_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_segments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS video_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS message_citations ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS highlights ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quizzes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_concepts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS study_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS student_progress ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies safely to prevent duplicates
DROP POLICY IF EXISTS "Users can access own profile" ON profiles;
DROP POLICY IF EXISTS "Users can access own books" ON books;
DROP POLICY IF EXISTS "Users can access chapters of own books" ON chapters;
DROP POLICY IF EXISTS "Users can access sections of own books" ON sections;
DROP POLICY IF EXISTS "Users can access pages of own books" ON book_pages;
DROP POLICY IF EXISTS "Users can access chunks of own books" ON book_chunks;
DROP POLICY IF EXISTS "Users can access own videos" ON videos;
DROP POLICY IF EXISTS "Users can access segments of own videos" ON video_segments;
DROP POLICY IF EXISTS "Users can access topics of own videos" ON video_topics;
DROP POLICY IF EXISTS "Users can access transcripts of own videos" ON video_transcripts;
DROP POLICY IF EXISTS "Users can access own conversations" ON conversations;
DROP POLICY IF EXISTS "Users can access messages of own conversations" ON messages;
DROP POLICY IF EXISTS "Users can access citations of own messages" ON message_citations;
DROP POLICY IF EXISTS "Users can access own highlights" ON highlights;
DROP POLICY IF EXISTS "Users can access own bookmarks" ON bookmarks;
DROP POLICY IF EXISTS "Users can access own notes" ON notes;
DROP POLICY IF EXISTS "Users can access own flashcards" ON flashcards;
DROP POLICY IF EXISTS "Users can access own quizzes" ON quizzes;
DROP POLICY IF EXISTS "Users can access questions of own quizzes" ON quiz_questions;
DROP POLICY IF EXISTS "Users can access own quiz attempts" ON quiz_attempts;
DROP POLICY IF EXISTS "Authenticated users can read concepts catalog" ON concepts;
DROP POLICY IF EXISTS "Users can access own concept mastery" ON student_concepts;
DROP POLICY IF EXISTS "Users can access own study sessions" ON study_sessions;
DROP POLICY IF EXISTS "Users can access own study events" ON study_events;
DROP POLICY IF EXISTS "Users can access own progress" ON student_progress;

-- 3. Hardened Multi-Tenant RLS Policies bound to auth.uid()
CREATE POLICY "Users can access own profile" ON profiles
    FOR ALL TO authenticated
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can access own books" ON books
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Users can access pages of own books" ON book_pages
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = book_pages.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = book_pages.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can access chunks of own books" ON book_chunks
    FOR ALL TO authenticated
    USING (EXISTS (SELECT 1 FROM books WHERE books.id = book_chunks.book_id AND books.user_id = auth.uid()))
    WITH CHECK (EXISTS (SELECT 1 FROM books WHERE books.id = book_chunks.book_id AND books.user_id = auth.uid()));

CREATE POLICY "Users can access own videos" ON videos
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Users can access own flashcards" ON flashcards
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

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

CREATE POLICY "Authenticated users can read concepts catalog" ON concepts
    FOR SELECT TO authenticated
    USING (true);

CREATE POLICY "Users can access own concept mastery" ON student_concepts
    FOR ALL TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

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

-- 4. Ensure high-frequency query indexes exist
CREATE INDEX IF NOT EXISTS idx_chapters_book_id ON chapters(book_id);
CREATE INDEX IF NOT EXISTS idx_sections_chapter_id ON sections(chapter_id);
CREATE INDEX IF NOT EXISTS idx_book_pages_book_id ON book_pages(book_id);
CREATE INDEX IF NOT EXISTS idx_book_chunks_book_id ON book_chunks(book_id);
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_book_id ON videos(book_id);
CREATE INDEX IF NOT EXISTS idx_video_segments_video_id ON video_segments(video_id);
CREATE INDEX IF NOT EXISTS idx_conversations_user_book ON conversations(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_highlights_user_book ON highlights(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_user_book ON bookmarks(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_book ON notes(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_book ON flashcards(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_quizzes_user_book ON quizzes(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_book ON quiz_attempts(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_study_events_user_book ON study_events(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_book ON study_sessions(user_id, book_id);
