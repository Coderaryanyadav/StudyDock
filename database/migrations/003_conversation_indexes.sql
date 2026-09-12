-- ==============================================================================
-- STUDYDOCK MIGRATION 003: Conversation Indexes and Enhanced Citation Fields
-- ==============================================================================

-- 1. Performance and Security Query Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_book ON public.conversations (user_id, book_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_conv_created ON public.messages (conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_message_citations_msg ON public.message_citations (message_id);

-- 2. Enhanced Citation Metadata Columns for Lossless Dual-Source RAG
ALTER TABLE public.message_citations 
    ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'textbook',
    ADD COLUMN IF NOT EXISTS video_timestamp_seconds INT,
    ADD COLUMN IF NOT EXISTS video_formatted_time TEXT;
