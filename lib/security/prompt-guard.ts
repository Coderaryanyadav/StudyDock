/**
 * StudyDock AI Prompt Injection Guard & Input Defense Layer
 * Treats user queries and uploaded document text as untrusted content,
 * applying defensive framing, boundary delimiters, and instruction isolation.
 */

/**
 * Sanitizes untrusted user inputs and document excerpts to neutralize markdown escapes
 * and prompt hijacking delimiters.
 */
export function sanitizePromptText(input: string): string {
  if (!input) return "";
  // Strip control characters while preserving newlines and tabs
  let sanitized = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");
  
  // Neutralize common prompt injection prefixes if directly trying to override
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
    /system\s+prompt\s+override/gi,
    /reveal\s+(your\s+)?(system\s+prompt|instructions|api\s*key)/gi,
    /you\s+are\s+now\s+in\s+developer\s+mode/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[Filtered attempt to override system rules]");
  }

  return sanitized;
}

/**
 * Wraps untrusted document content in strict cryptographic-style XML delimiters
 * to clearly communicate to LLMs that this data is passive context, NOT executable instructions.
 */
export function wrapUntrustedDocumentContext(content: string, tag: string = "untrusted_document_context"): string {
  const sanitized = sanitizePromptText(content);
  return `<${tag}>\n${sanitized}\n</${tag}>`;
}

/**
 * Wraps user queries with boundary protections.
 */
export function wrapUserQuery(query: string): string {
  const sanitized = sanitizePromptText(query);
  return `<student_question>\n${sanitized}\n</student_question>`;
}
