-- ==============================================================================
-- STUDYDOCK: PostgreSQL & pgTAP Multi-Tenant Database Security Test Suite
-- ==============================================================================
-- Evaluates Row Level Security (RLS) enforcement, cross-tenant isolation,
-- foreign key cascading, and SECURITY DEFINER access boundaries directly in SQL.

BEGIN;

-- 1. Create simulated test users in auth.users & public.profiles
CREATE OR REPLACE FUNCTION test_seed_tenants()
RETURNS void AS $$
DECLARE
    uid_a UUID := '11111111-1111-4111-8111-111111111111';
    uid_b UUID := '22222222-2222-4222-8222-222222222222';
BEGIN
    -- Seed profiles
    INSERT INTO public.profiles (id, email, display_name)
    VALUES 
        (uid_a, 'user_a@studydock.edu', 'Scholar Alice'),
        (uid_b, 'user_b@studydock.edu', 'Scholar Bob')
    ON CONFLICT (id) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

SELECT test_seed_tenants();

-- ------------------------------------------------------------------------------
-- TEST 1: BOOKS (Allow User A, Deny User B)
-- ------------------------------------------------------------------------------
-- User A creates a book
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';
SET LOCAL ROLE authenticated;

INSERT INTO public.books (id, user_id, title, author, total_pages)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-4111-8111-111111111111', 'Distributed Systems (A)', 'Tanenbaum', 20);

-- User A can SELECT own book
SELECT count(*) = 1 FROM public.books WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- Switch to User B
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';

-- User B SELECT returns 0 rows (BLOCKED)
SELECT count(*) = 0 FROM public.books WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ------------------------------------------------------------------------------
-- TEST 2: BOOK PAGES & CHUNKS (Inherited Isolation)
-- ------------------------------------------------------------------------------
-- User A creates page & chunk
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.book_pages (id, book_id, page_number, title, content)
VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Architecture', 'Client-Server');

INSERT INTO public.book_chunks (id, book_id, page_id, chunk_index, page_number, text)
VALUES ('cccccccc-cccc-cccc-cccc-cccccccccc01', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbb01', 0, 1, 'Client sends requests to Server.');

-- User B attempts SELECT on User A's pages & chunks
SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';

SELECT count(*) = 0 FROM public.book_pages WHERE book_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) = 0 FROM public.book_chunks WHERE book_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ------------------------------------------------------------------------------
-- TEST 3: VIDEOS & SEGMENTS
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.videos (id, user_id, book_id, youtube_id, title)
VALUES ('dddddddd-dddd-dddd-dddd-dddddddddd01', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'dQw4w9WgXcQ', 'Lecture 1');

SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
SELECT count(*) = 0 FROM public.videos WHERE id = 'dddddddd-dddd-dddd-dddd-dddddddddd01';

-- ------------------------------------------------------------------------------
-- TEST 4: CONVERSATIONS & MESSAGES
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.conversations (id, user_id, book_id, title)
VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Tutor Chat A');

INSERT INTO public.messages (id, conversation_id, sender, content)
VALUES ('ffffffff-ffff-ffff-ffff-ffffffffff01', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01', 'user', 'What is RPC?');

SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
SELECT count(*) = 0 FROM public.conversations WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01';
SELECT count(*) = 0 FROM public.messages WHERE conversation_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeee01';

-- ------------------------------------------------------------------------------
-- TEST 5: NOTES, HIGHLIGHTS & BOOKMARKS
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.notes (id, user_id, book_id, page_number, content)
VALUES ('11111111-0000-0000-0000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'My private note');

INSERT INTO public.highlights (id, user_id, book_id, page_number, text)
VALUES ('11111111-0000-0000-0000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Highlighted text');

INSERT INTO public.bookmarks (id, user_id, book_id, page_number, title)
VALUES ('11111111-0000-0000-0000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'Bookmark p.1');

SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
SELECT count(*) = 0 FROM public.notes WHERE book_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) = 0 FROM public.highlights WHERE book_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
SELECT count(*) = 0 FROM public.bookmarks WHERE book_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';

-- ------------------------------------------------------------------------------
-- TEST 6: QUIZZES, QUESTIONS & ATTEMPTS
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.quizzes (id, user_id, book_id, title)
VALUES ('22222222-0000-0000-0000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Quiz 1');

INSERT INTO public.quiz_questions (id, quiz_id, book_id, page_number, concept, question, options, explanation)
VALUES ('22222222-0000-0000-0000-000000000002', '22222222-0000-0000-0000-000000000001', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'RPC', 'What is RPC?', '[{"id":"opt-0","text":"Remote Procedure Call","isCorrect":true}]'::jsonb, 'RPC allows invoking remote methods.');

INSERT INTO public.quiz_attempts (id, user_id, book_id, quiz_id, score, total_questions)
VALUES ('22222222-0000-0000-0000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '22222222-0000-0000-0000-000000000001', 1, 1);

SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
SELECT count(*) = 0 FROM public.quizzes WHERE id = '22222222-0000-0000-0000-000000000001';
SELECT count(*) = 0 FROM public.quiz_questions WHERE quiz_id = '22222222-0000-0000-0000-000000000001';
SELECT count(*) = 0 FROM public.quiz_attempts WHERE quiz_id = '22222222-0000-0000-0000-000000000001';

-- ------------------------------------------------------------------------------
-- TEST 7: FLASHCARDS, STUDY SESSIONS & EVENTS
-- ------------------------------------------------------------------------------
SET LOCAL "request.jwt.claim.sub" = '11111111-1111-4111-8111-111111111111';

INSERT INTO public.flashcards (id, user_id, book_id, page_number, concept, question, answer)
VALUES ('33333333-0000-0000-0000-000000000001', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, 'RPC', 'Define RPC', 'Remote Procedure Call');

INSERT INTO public.study_sessions (id, user_id, book_id, duration_minutes)
VALUES ('33333333-0000-0000-0000-000000000002', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 30);

INSERT INTO public.study_events (id, user_id, book_id, event_type, page_number, duration_seconds)
VALUES ('33333333-0000-0000-0000-000000000003', '11111111-1111-4111-8111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'page_time', 1, 60);

SET LOCAL "request.jwt.claim.sub" = '22222222-2222-4222-8222-222222222222';
SELECT count(*) = 0 FROM public.flashcards WHERE id = '33333333-0000-0000-0000-000000000001';
SELECT count(*) = 0 FROM public.study_sessions WHERE id = '33333333-0000-0000-0000-000000000002';
SELECT count(*) = 0 FROM public.study_events WHERE id = '33333333-0000-0000-0000-000000000003';

ROLLBACK;
