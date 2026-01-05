
import { VectorDocument, OllamaConfig } from '../types';
import { generateEmbeddings } from './ollamaService';

/**
 * A lightweight, in-memory Vector Store for client-side RAG.
 * It stores document chunks and performs cosine similarity search.
 */
export class LocalVectorStore {
  private documents: VectorDocument[] = [];
  private config: OllamaConfig;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  /**
   * Simple text splitter that respects rough character limits and overlap.
   */
  private splitText(text: string, chunkSize: number = 1000, overlap: number = 200): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      chunks.push(text.slice(start, end));
      start += chunkSize - overlap;
    }
    return chunks;
  }

  /**
   * Ingests files, chunks them, generates embeddings, and stores them.
   */
  async addDocuments(files: { path: string; content: string }[], onProgress?: (current: number, total: number) => void): Promise<void> {
    let processedCount = 0;
    const totalFiles = files.length;

    for (const file of files) {
      const chunks = this.splitText(file.content);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        try {
          const embedding = await generateEmbeddings(this.config, chunk);
          
          this.documents.push({
            id: `${file.path}-${i}`,
            content: chunk,
            metadata: {
              filePath: file.path,
              startLine: i * 50, // Approximation
            },
            embedding: embedding
          });
        } catch (e) {
          console.error(`Failed to embed chunk for ${file.path}`, e);
        }
      }
      processedCount++;
      if (onProgress) onProgress(processedCount, totalFiles);
    }
  }

  /**
   * Calculates Cosine Similarity between two vectors.
   */
  private cosineSimilarity(vecA: number[], vecB: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i] * vecB[i];
      normA += vecA[i] * vecA[i];
      normB += vecB[i] * vecB[i];
    }
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Searches for the most relevant documents for a given query.
   */
  async similaritySearch(query: string, k: number = 4): Promise<VectorDocument[]> {
    if (this.documents.length === 0) return [];

    const queryEmbedding = await generateEmbeddings(this.config, query);
    
    const scores = this.documents.map(doc => {
      if (!doc.embedding) return { doc, score: -1 };
      return {
        doc,
        score: this.cosineSimilarity(queryEmbedding, doc.embedding)
      };
    });

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    return scores.slice(0, k).map(s => s.doc);
  }
  
  clear() {
      this.documents = [];
  }
}
