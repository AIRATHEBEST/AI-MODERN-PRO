/**
 * RAG (Retrieval-Augmented Generation) — cosine similarity search
 * Uses in-process embeddings (no Pinecone needed) with OpenAI embeddings
 */

export interface RagChunk {
  id: number;
  content: string;
  fileName: string;
  similarity: number;
}

export function chunkText(text: string, chunkSize = 800, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + chunkSize, text.length);
    chunks.push(text.slice(start, end).trim());
    start += chunkSize - overlap;
  }
  return chunks.filter(c => c.length > 50);
}

export async function getEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!response.ok) throw new Error(`Embedding error: ${await response.text()}`);
  const data = await response.json() as any;
  return data.data[0].embedding as number[];
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB) || 1);
}

export function searchEmbeddings(
  queryEmbedding: number[],
  documents: Array<{ id: number; content: string; fileName: string; embedding: number[] | null }>,
  topK = 4
): RagChunk[] {
  const scored = documents
    .filter(d => d.embedding && d.embedding.length > 0)
    .map(d => ({
      id: d.id,
      content: d.content,
      fileName: d.fileName,
      similarity: cosineSimilarity(queryEmbedding, d.embedding!),
    }))
    .filter(d => d.similarity > 0.3)
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, topK);
  return scored;
}

export function buildRagContext(chunks: RagChunk[]): string {
  if (chunks.length === 0) return "";
  const parts = chunks.map((c, i) =>
    `[Source ${i + 1}: ${c.fileName} (relevance: ${(c.similarity * 100).toFixed(0)}%)]\n${c.content}`
  );
  return `\n\n--- RELEVANT CONTEXT FROM YOUR DOCUMENTS ---\n${parts.join("\n\n")}\n--- END CONTEXT ---\n\nUsing the above context where relevant, answer the following:\n`;
}
