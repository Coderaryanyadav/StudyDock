export enum LogState {
  AUTH_FAILED = "AUTH_FAILED",
  AUTHZ_FAILED = "AUTHZ_FAILED",
  RATE_LIMITED = "RATE_LIMITED",
  PDF_PROCESSING = "PDF_PROCESSING",
  PDF_FAILED = "PDF_FAILED",
  EMBEDDING_FAILED = "EMBEDDING_FAILED",
  RAG_UNAVAILABLE = "RAG_UNAVAILABLE",
  AI_UNAVAILABLE = "AI_UNAVAILABLE",
  VIDEO_METADATA_UNAVAILABLE = "VIDEO_METADATA_UNAVAILABLE",
  DB_FAILED = "DB_FAILED",
  EXCEPTION = "EXCEPTION",
  SUCCESS = "SUCCESS",
  INFO = "INFO",
}

export type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  state?: LogState;
  correlationId?: string;
  userId?: string;
  bookId?: string;
  error?: any;
  [key: string]: any;
}

const SENSITIVE_KEYS = new Set([
  "password",
  "token",
  "apikey",
  "api_key",
  "secret",
  "cookie",
  "session",
  "authorization",
  "jwt",
  "content",      // Prevent logging full PDF content
  "prompt",       // Prevent logging chat messages/prompts
  "chunk",        // Prevent logging raw chunks
  "text",         // Prevent logging parsed text
  "excerpt",      // Prevent logging notes/highlights
  "gemini_api_key",
  "supabase_service_role_key"
]);

/**
 * Deep clones an object while redacting sensitive fields to prevent PII/secret leaks in logs
 */
function redact(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (typeof obj !== "object") {
    return obj;
  }

  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      // Intentionally omitting stack traces to prevent secret leakage in paths or code strings
      ...(obj as any).code && { code: (obj as any).code },
    };
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redact(item));
  }

  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();
    
    // Check if key contains any sensitive term
    const isSensitive = Array.from(SENSITIVE_KEYS).some(sensitive => lowerKey.includes(sensitive));
    
    if (isSensitive) {
      result[key] = "[REDACTED]";
    } else {
      result[key] = redact(value);
    }
  }
  
  return result;
}

export class Logger {
  static log(level: LogLevel, message: string, payload?: LogPayload) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      data: redact(payload || {}),
      ...redact(payload || {}),
    };

    const logString = JSON.stringify(logEntry);

    switch (level) {
      case "debug":
        console.debug(logString);
        break;
      case "info":
        console.info(logString);
        break;
      case "warn":
        console.warn(logString);
        break;
      case "error":
        console.error(logString);
        break;
    }
  }

  static info(message: string, payload?: LogPayload) {
    this.log("info", message, payload);
  }

  static error(message: string, payload?: LogPayload) {
    this.log("error", message, payload);
  }

  static warn(message: string, payload?: LogPayload) {
    this.log("warn", message, payload);
  }
}
