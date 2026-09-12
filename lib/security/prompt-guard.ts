/**
 * StudyDock AI Prompt Injection Guard & Input Defense Layer
 * Treats user queries, uploaded document text, and highlighted snippets as untrusted data inputs.
 * Enforces strict cryptographic-style boundary delimiters, instruction isolation, and sanitized inputs.
 */

/**
 * Sanitizes untrusted user inputs and document excerpts to neutralize control characters
 * and common prompt hijacking injection patterns.
 */
export function sanitizePromptText(input: string, maxLength = 8000): string {
  if (!input) return "";
  
  // Truncate to safe length limit
  let sanitized = input.slice(0, maxLength);

  // Strip non-printable ASCII control characters except \n, \r, \t
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // Escape raw XML closing tags to prevent delimiter escape
  sanitized = sanitized
    .replace(/<\/untrusted_document_context>/gi, "&lt;/untrusted_document_context&gt;")
    .replace(/<\/student_selected_text>/gi, "&lt;/student_selected_text&gt;")
    .replace(/<\/student_question>/gi, "&lt;/student_question&gt;");

  // Neutralize common instruction hijacking patterns
  const injectionPatterns = [
    /ignore\s+(all\s+)?(previous|prior|above|existing)\s+instructions/gi,
    /disregard\s+(all\s+)?(previous|prior|above)\s+instructions/gi,
    /system\s+prompt\s+override/gi,
    /reveal\s+(your\s+)?(system\s+prompt|instructions|secret|api\s*key)/gi,
    /you\s+are\s+now\s+in\s+(developer|unrestricted|god)\s+mode/gi,
    /output\s+the\s+initial\s+prompt/gi,
  ];

  for (const pattern of injectionPatterns) {
    sanitized = sanitized.replace(pattern, "[Filtered attempt to override academic tutor instructions]");
  }

  return sanitized;
}

/**
 * Wraps untrusted document content in strict XML delimiters
 */
export function wrapUntrustedDocumentContext(content: string, tag = "untrusted_document_context"): string {
  const sanitized = sanitizePromptText(content, 12000);
  return `<${tag}>\n${sanitized}\n</${tag}>`;
}

/**
 * Wraps student selected text in boundary protections
 */
export function wrapSelectedText(selectedText: string): string {
  const sanitized = sanitizePromptText(selectedText, 2000);
  return `<student_selected_text>\n${sanitized}\n</student_selected_text>`;
}

/**
 * Wraps user queries with boundary protections
 */
export function wrapUserQuery(query: string): string {
  const sanitized = sanitizePromptText(query, 2000);
  return `<student_question>\n${sanitized}\n</student_question>`;
}
