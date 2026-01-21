
import { VectorDocument, OllamaConfig, SearchResult } from '../types';
import { generateEmbeddings } from './ollamaService';

/**
 * Hybrid Vector Store for CodeWiki.
 * Combines Cosine Similarity (Semantic) with Keyword Matching (Lexical)
 * to find exact variable names or error codes that embeddings miss.
 */
export class LocalVectorStore {
  private documents: VectorDocument[] = [];
  private config: OllamaConfig;
  private invertedIndex: Map<string, Set<string>> = new Map(); // token -> Set<docId>
  private embeddingsEnabled = true;

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  // Simple tokenizer for code
  private tokenize(text: string): Set<string> {
    // Split by non-alphanumeric, keep camelCase and snake_case parts relevant
    const tokens = text.toLowerCase().split(/[^a-z0-9_]+/);
    return new Set(tokens.filter(t => t.length > 2));
  }

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

  async addDocuments(files: { path: string; content: string }[], onProgress?: (current: number, total: number) => void): Promise<void> {
    let processedCount = 0;
    const totalFiles = files.length;

    for (const file of files) {
      const chunks = this.splitText(file.content);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const docId = `${file.path}-${i}`;
        const tokens = this.tokenize(chunk);

        try {
          // Add to Inverted Index
          tokens.forEach(token => {
            if (!this.invertedIndex.has(token)) {
              this.invertedIndex.set(token, new Set());
            }
            this.invertedIndex.get(token)?.add(docId);
          });

          // Generate Embedding (optional)
          let embedding: number[] | undefined;
          if (this.embeddingsEnabled) {
            embedding = await generateEmbeddings(this.config, chunk);
            if (!embedding.length) {
              this.embeddingsEnabled = false;
              embedding = undefined;
            }
          }
          
          this.documents.push({
            id: docId,
            content: chunk,
            metadata: {
              filePath: file.path,
              startLine: i * 50,
            },
            embedding: embedding,
            tokens: tokens
          });
        } catch (e) {
          console.error(`Failed to index chunk for ${file.path}`, e);
        }
      }
      processedCount++;
      if (onProgress) onProgress(processedCount, totalFiles);
    }
  }

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
   * Hybrid Search: Combines Keyword Frequency + Vector Similarity
   */
  async similaritySearch(query: string, k: number = 4): Promise<VectorDocument[]> {
    if (this.documents.length === 0) return [];

    const queryEmbedding = this.embeddingsEnabled ? await generateEmbeddings(this.config, query) : [];
    if (this.embeddingsEnabled && !queryEmbedding.length) {
      this.embeddingsEnabled = false;
    }
    const queryTokens = this.tokenize(query);
    
    const results: SearchResult[] = this.documents.map(doc => {
      // 1. Vector Score
      let vectorScore = 0;
      if (this.embeddingsEnabled && doc.embedding) {
        vectorScore = this.cosineSimilarity(queryEmbedding, doc.embedding);
      }

      // 2. Keyword Score (Jaccard Similarity on tokens)
      let keywordMatches = 0;
      queryTokens.forEach(token => {
        if (doc.tokens?.has(token)) keywordMatches++;
      });
      const keywordScore = queryTokens.size > 0 ? keywordMatches / queryTokens.size : 0;

      // 3. Hybrid Scoring Formula
      // CodeWiki prioritizes exact keyword matches (e.g. class names) slightly more than semantic vibe
      const finalScore = this.embeddingsEnabled
        ? (vectorScore * 0.6) + (keywordScore * 0.4)
        : keywordScore;

      return {
        doc,
        score: finalScore,
        matchType: keywordScore > 0.5 ? 'keyword' : 'vector'
      };
    });

    // Sort by hybrid score
    results.sort((a, b) => b.score - a.score);

    return results.slice(0, k).map(r => r.doc);
  }
  
  clear() {
      this.documents = [];
      this.invertedIndex.clear();
  }
}
