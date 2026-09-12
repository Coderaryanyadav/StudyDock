import { GoogleGenerativeAI } from "@google/generative-ai";

/**
 * Generates semantic vector embeddings (768 dimensions) using Google Gemini text-embedding-004
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey.trim() === "" || apiKey === "your_gemini_api_key_here") {
    // Generate deterministic 768-dim mock vector for demo environments
    return generateDeterministicVector(text, 768);
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "text-embedding-004" });
    const result = await model.embedContent(text.slice(0, 2048)); // Truncate to safe token limit
    return result.embedding.values;
  } catch (error: any) {
    console.warn("Gemini embedding error, fallback to deterministic vector:", error?.message || error);
    return generateDeterministicVector(text, 768);
  }
}

/**
 * Batch generates embeddings for multiple chunks with pacing to respect rate limits
 */
export async function generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    const embedding = await generateEmbedding(texts[i]);
    embeddings.push(embedding);
    // Slight throttle for batch requests
    if (i % 5 === 0 && i > 0) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }
  return embeddings;
}

/**
 * Generates a normalized deterministic pseudo-random embedding vector for offline testing
 */
function generateDeterministicVector(text: string, dimensions: number): number[] {
  const vector: number[] = new Array(dimensions).fill(0);
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0;
  }

  for (let d = 0; d < dimensions; d++) {
    const val = Math.sin(hash + d * 0.1);
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
