-- Performance optimization indexes for StudyDock

-- 1. Index for book_pages
CREATE INDEX IF NOT EXISTS idx_book_pages_book_id ON book_pages(book_id);
CREATE INDEX IF NOT EXISTS idx_book_pages_chapter_id ON book_pages(chapter_id);

-- 2. Index for book_chunks (foreign keys)
CREATE INDEX IF NOT EXISTS idx_book_chunks_book_id ON book_chunks(book_id);
CREATE INDEX IF NOT EXISTS idx_book_chunks_page_id ON book_chunks(page_id);

-- 3. HNSW index for vector embeddings on book_chunks
-- Requires pgvector extension to be enabled
CREATE INDEX IF NOT EXISTS idx_book_chunks_embedding 
ON book_chunks 
USING hnsw (embedding vector_cosine_ops);

-- 4. Indexes for study_events (heavily queried for dashboard)
CREATE INDEX IF NOT EXISTS idx_study_events_user_id_created_at ON study_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_events_book_id ON study_events(book_id);
CREATE INDEX IF NOT EXISTS idx_study_events_session_id ON study_events(session_id);

-- 5. Indexes for study_sessions
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_id_created_at ON study_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_sessions_book_id ON study_sessions(book_id);

-- 6. Indexes for messages and conversations
CREATE INDEX IF NOT EXISTS idx_conversations_user_book ON conversations(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_created_at ON messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender);

-- 7. Indexes for annotations (highlights, notes, bookmarks)
CREATE INDEX IF NOT EXISTS idx_highlights_book_page ON highlights(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_notes_book_page ON notes(book_id, page_number);
CREATE INDEX IF NOT EXISTS idx_bookmarks_book_page ON bookmarks(book_id, page_number);

-- 8. Flashcards and quizzes
CREATE INDEX IF NOT EXISTS idx_flashcards_user_last_reviewed ON flashcards(user_id, last_reviewed);
CREATE INDEX IF NOT EXISTS idx_quiz_attempts_user_id ON quiz_attempts(user_id);
