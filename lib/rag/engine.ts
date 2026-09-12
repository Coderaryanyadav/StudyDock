/**
 * StudyDock RAG Engine (Unified Adapter)
 * Delegates to lib/rag/retriever.ts which houses the production hybrid RAG pipeline.
 */

export {
  retrieveRelevantContext,
  buildProductionPrompt,
  type ProductionRagContext,
  type HybridSearchResult,
} from "./retriever";

export type { RagContext, SearchResultChunk } from "./retriever";
