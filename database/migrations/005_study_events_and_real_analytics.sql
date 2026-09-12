-- ==============================================================================
-- STUDYDOCK MIGRATION 005: Event-Based Analytics & Study Sessions
-- ==============================================================================

-- 1. Create or update study_events table
CREATE TABLE IF NOT EXISTS study_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    book_id UUID REFERENCES books(id) ON DELETE CASCADE,
    session_id UUID,
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
    page_number INT,
    duration_seconds INT DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ensure study_sessions has all real tracking fields
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS duration_seconds INT DEFAULT 0;
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS pages_viewed INT[] DEFAULT '{}';
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS pages_completed INT[] DEFAULT '{}';
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS activity_type TEXT DEFAULT 'reading';
ALTER TABLE study_sessions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Add foreign key reference from study_events to study_sessions if not exists
DO $$ BEGIN
    ALTER TABLE study_events 
    ADD CONSTRAINT fk_study_events_session 
    FOREIGN KEY (session_id) REFERENCES study_sessions(id) ON DELETE SET NULL;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Indexes for fast analytics queries
CREATE INDEX IF NOT EXISTS idx_study_events_user_book ON study_events(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_study_events_user_type ON study_events(user_id, event_type);
CREATE INDEX IF NOT EXISTS idx_study_events_created ON study_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_events_user_date ON study_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_study_events_session ON study_events(session_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_user_book ON study_sessions(user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_study_sessions_started ON study_sessions(user_id, started_at DESC);

-- 4. Enable Row Level Security (RLS) on study_events
ALTER TABLE study_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Users can access own study events" ON study_events
        FOR ALL TO authenticated
        USING (auth.uid() = user_id)
        WITH CHECK (auth.uid() = user_id);
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
