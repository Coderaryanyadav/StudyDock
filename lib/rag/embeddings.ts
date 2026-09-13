import { GoogleGenerativeAI } from "@google/generative-ai";
import { Logger, LogState } from "@/lib/logger";
/**
 * Generates semantic vector embeddings (768 dimensions) using Google Gemini text-embedding-004
 * with retry logic and exponential backoff.
 */
export async function generateEmbedding(
  text: string,
  retries = 3,
  delayMs = 500
): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    if (process.env.NODE_ENV !== "production") {
      return generateDeterministicVector(text, 768);
    }
    throw new Error("GEMINI_API_KEY is unconfigured in production environment.");
  }

  const cleanText = text.slice(0, 2048);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
      const result = await model.embedContent(cleanText);

      if (result?.embedding?.values && result.embedding.values.length === 768) {
        return result.embedding.values;
      }
      throw new Error(`Unexpected embedding dimension: ${result?.embedding?.values?.length}`);
    } catch (error: any) {
      if (attempt === retries) {
        if (process.env.NODE_ENV !== "production") {
          Logger.warn(`Embedding failed after ${retries} attempts, fallback to deterministic vector`, {
            state: LogState.EMBEDDING_FAILED,
            error: error?.message
          });
          return generateDeterministicVector(text, 768);
        }
        throw new Error(`Gemini embedding failed after ${retries} attempts: ${error?.message || "Unknown error"}`);
      }
      // Exponential backoff
      await new Promise((resolve) => setTimeout(resolve, delayMs * Math.pow(2, attempt - 1)));
    }
  }

  return generateDeterministicVector(text, 768);
}

/**
 * Batch generates embeddings for multiple chunks with bounded concurrency and retry
 */
export async function generateBatchEmbeddings(
  texts: string[],
  concurrency = 5
): Promise<number[][]> {
  const results: number[][] = new Array(texts.length);
  let currentIndex = 0;

  async function worker() {
    while (currentIndex < texts.length) {
      const index = currentIndex++;
      try {
        results[index] = await generateEmbedding(texts[index]);
      } catch (err) {
        Logger.error(`Error embedding chunk index ${index}`, {
          state: LogState.EMBEDDING_FAILED,
          chunkIndex: index,
          error: err
        });
        // In fallback or demo mode generate deterministic vector so batch is not stalled
        results[index] = generateDeterministicVector(texts[index], 768);
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, texts.length) }, () => worker());
  await Promise.all(workers);

  return results;
}

export function generateDeterministicVector(text: string, dimensions = 768): number[] {
  const vector: number[] = new Array(dimensions).fill(0);
  
  // 32-bit FNV-1a hash of full text
  let seed = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    seed ^= text.charCodeAt(i);
    seed = Math.imul(seed, 0x01000193);
  }
  seed = seed >>> 0;

  // Extract meaningful tokens
  const tokens = (text || "").toLowerCase().replace(/[^\w\s]/g, " ").split(/\s+/).filter((t) => t.length > 2);

  function mulberry32(a: number) {
    let t = (a + 0x6d2b79f5) >>> 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  let s = seed;
  for (let d = 0; d < dimensions; d++) {
    s = (s + 0x9e3779b9 + d) >>> 0;
    let val = (mulberry32(s) * 2) - 1;

    // Feature projection for tokens
    for (const token of tokens) {
      let th = 0;
      for (let j = 0; j < token.length; j++) {
        th = (th * 31 + token.charCodeAt(j)) >>> 0;
      }
      if ((th % dimensions) === d) {
        val += 3.0;
      }
    }

    vector[d] = val;
  }

  // Normalize to unit length
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}

/**
 * Calculates cosine similarity between two vectors
 */
export function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dot += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}
