/**
 * StudyDock In-Memory Token Bucket / Window Rate Limiter & Input Validation
 */

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

const ipMap = new Map<string, RateLimitRecord>();

// Clean up stale IP records every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    ipMap.forEach((value, key) => {
      if (now > value.resetAt) {
        ipMap.delete(key);
      }
    });
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit?: number; // max requests
  windowMs?: number; // window in milliseconds
}

export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { limit: 60, windowMs: 60 * 1000 }
): { allowed: boolean; remaining: number; resetInSec: number } {
  const { limit = 60, windowMs = 60 * 1000 } = options;
  const now = Date.now();

  const record = ipMap.get(identifier);

  if (!record || now > record.resetAt) {
    ipMap.set(identifier, {
      count: 1,
      resetAt: now + windowMs,
    });
    return {
      allowed: true,
      remaining: limit - 1,
      resetInSec: Math.ceil(windowMs / 1000),
    };
  }

  if (record.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      resetInSec: Math.ceil((record.resetAt - now) / 1000),
    };
  }

  record.count += 1;
  return {
    allowed: true,
    remaining: limit - record.count,
    resetInSec: Math.ceil((record.resetAt - now) / 1000),
  };
}

/**
 * Validates incoming chat request parameters for boundaries and constraints
 */
export function validateChatInput(body: any): { isValid: boolean; error?: string } {
  if (!body || typeof body !== "object") {
    return { isValid: false, error: "Invalid request payload format." };
  }

  const { question, message, pageNumber, selectedText, learningMode, videoTimestampSeconds } = body;
  const queryText = question || message;

  if (!queryText || typeof queryText !== "string" || queryText.trim().length === 0) {
    return { isValid: false, error: "Question cannot be empty." };
  }

  if (body.action !== "create_conversation" && (!body.bookId || typeof body.bookId !== "string" || !body.bookId.trim())) {
    return { isValid: false, error: "Book ID is required for AI Tutor queries." };
  }

  if (queryText.length > 2000) {
    return { isValid: false, error: "Question exceeds maximum length of 2000 characters." };
  }

  if (selectedText && typeof selectedText === "string" && selectedText.length > 3000) {
    return { isValid: false, error: "Selected text context exceeds 3000 characters." };
  }

  if (pageNumber !== undefined && (typeof pageNumber !== "number" || pageNumber < 1 || pageNumber > 5000)) {
    return { isValid: false, error: "Invalid textbook page number." };
  }

  if (videoTimestampSeconds !== undefined && (typeof videoTimestampSeconds !== "number" || videoTimestampSeconds < 0)) {
    return { isValid: false, error: "Invalid video timestamp." };
  }

  const allowedModes = [
    "explain",
    "beginner",
    "deep_dive",
    "example",
    "quiz",
    "exam",
    "flashcards",
    "summary",
    "teach_me",
    "socratic",
  ];

  if (learningMode && !allowedModes.includes(learningMode)) {
    return { isValid: false, error: "Unsupported learning mode specified." };
  }

  return { isValid: true };
}
