// lib/api/rate-limiter.ts

type RateLimitContext = {
  id: string; // The user ID or IP address to limit against
  limit: number; // Max requests
  windowMs: number; // Time window in milliseconds
};

type RateLimitResult = {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
};

// In-memory store for rate limits
// Note: In a real multi-region deployment or serverless environment without
// a long-lived process, this should be backed by Redis or similar.
const store = new Map<string, { count: number; resetTime: number }>();

/**
 * Clean up expired rate limit entries periodically
 */
const cleanup = () => {
  const now = Date.now();
  for (const [key, value] of store.entries()) {
    if (now > value.resetTime) {
      store.delete(key);
    }
  }
};

// Run cleanup every minute
if (typeof setInterval !== "undefined") {
  setInterval(cleanup, 60 * 1000);
}

export async function rateLimit(context: RateLimitContext): Promise<RateLimitResult> {
  const { id, limit, windowMs } = context;
  const now = Date.now();

  const record = store.get(id);

  if (!record || now > record.resetTime) {
    // First request or window expired
    const resetTime = now + windowMs;
    store.set(id, { count: 1, resetTime });
    return {
      success: true,
      limit,
      remaining: limit - 1,
      resetTime: new Date(resetTime),
    };
  }

  // Existing window
  if (record.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      resetTime: new Date(record.resetTime),
    };
  }

  // Increment counter
  record.count += 1;
  store.set(id, record);

  return {
    success: true,
    limit,
    remaining: limit - record.count,
    resetTime: new Date(record.resetTime),
  };
}

// Preset configurations
export const RATE_LIMITS = {
  STANDARD: { limit: 1000, windowMs: 60 * 1000 }, // 1000 req / min
  AI_GENERATION: { limit: 120, windowMs: 60 * 1000 }, // 120 req / min
  UPLOAD: { limit: 100, windowMs: 60 * 1000 }, // 100 req / min
};
