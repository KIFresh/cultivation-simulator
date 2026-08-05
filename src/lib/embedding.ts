import { logger } from "./logger";

const EMBEDDING_MODEL = "BAAI/bge-m3";
const EMBEDDING_DIMENSIONS = 1024;

interface EmbeddingConfig {
  baseUrl: string;
  apiKey: string;
  model?: string;
}

let config: EmbeddingConfig | null = null;

/** Configure embedding service (call once at startup from provider config) */
export function configureEmbedding(cfg: EmbeddingConfig) {
  config = cfg;
}

/** Generate embedding for a single text string. Returns normalized vector. */
export async function embedText(text: string): Promise<number[]> {
  if (!config) {
    logger.warn("[embedding] not configured, returning empty vector");
    return [];
  }
  try {
    const b = config.baseUrl.replace(/\/+$/, "");
    // baseUrl 可能已含 /v1（如 https://api.siliconflow.cn/v1），避免拼成 /v1/v1
    const url = b.endsWith("/v1") ? `${b}/embeddings` : `${b}/v1/embeddings`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model || EMBEDDING_MODEL,
        input: text,
      }),
    });
    if (!res.ok) {
      logger.warn(`[embedding] API error: ${res.status}`);
      return [];
    }
    const data = await res.json();
    const vector: number[] = data?.data?.[0]?.embedding;
    if (!vector || !Array.isArray(vector)) {
      logger.warn("[embedding] unexpected response format");
      return [];
    }
    return vector;
  } catch (err) {
    logger.warn("[embedding] failed:", err);
    return [];
  }
}

/** Compute cosine similarity between two vectors. Returns 0 if either is empty. */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length === 0 || b.length === 0 || a.length !== b.length) return 0;
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

/** Find top-k indices in an array of scores, excluding scores below minScore. */
export function topK(scores: number[], k: number, minScore = 0.3): number[] {
  return scores
    .map((s, i) => ({ s, i }))
    .filter((x) => x.s >= minScore)
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((x) => x.i);
}

/**
 * Fire-and-forget: generate embeddings for MemoryEntry ids missing one.
 * Called after the action transaction commits; failures are silent.
 */
export async function embedMemoryEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { prisma } = await import("./prisma");
  for (const id of ids) {
    try {
      const entry = await prisma.memoryEntry.findUnique({
        where: { id },
        select: { title: true, summary: true, embedding: true },
      });
      if (!entry || entry.embedding) continue;
      const vec = await embedText(`${entry.title} ${entry.summary}`);
      if (vec.length > 0) {
        await prisma.memoryEntry.update({
          where: { id },
          data: { embedding: JSON.stringify(vec) },
        });
      }
    } catch {
      // Non-critical; retried on next write if still null
    }
  }
}