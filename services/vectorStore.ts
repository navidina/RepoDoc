
import { VectorDocument, OllamaConfig, SearchResult, ProcessedFile } from '../types';
import { generateEmbeddings } from './ollamaService';

export class LocalVectorStore {
  private documents: VectorDocument[] = [];
  private config: OllamaConfig;
  private invertedIndex: Map<string, Set<string>> = new Map(); 

  constructor(config: OllamaConfig) {
    this.config = config;
  }

  private tokenize(text: string): Set<string> {
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

  async addDocuments(files: ProcessedFile[], onProgress?: (current: number, total: number) => void): Promise<void> {
    let processedCount = 0;
    const totalFiles = files.length;

    for (const file of files) {
      // Optimization: If file was cached and already vectorized, we might skip, 
      // but in this memory-only store, we must add it.
      
      const chunks = this.splitText(file.content);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const docId = `${file.path}-${i}`;
        const tokens = this.tokenize(chunk);

        // Find which symbols are present in this chunk to link Graph data
        const presentSymbols = file.metadata.symbols.filter(s => chunk.includes(s.name));
        const relatedSymbolIds = presentSymbols.map(s => s.id);
        
        // Also add symbols that CALL these symbols (Reverse lookup context)
        presentSymbols.forEach(s => {
            if (s.relationships?.calledBy) {
                relatedSymbolIds.push(...s.relationships.calledBy);
            }
        });

        try {
          tokens.forEach(token => {
            if (!this.invertedIndex.has(token)) this.invertedIndex.set(token, new Set());
            this.invertedIndex.get(token)?.add(docId);
          });

          // Generate Embedding (skip if we implemented caching here too)
          const embedding = await generateEmbeddings(this.config, chunk);
          
          this.documents.push({
            id: docId,
            content: chunk,
            metadata: {
              filePath: file.path,
              startLine: i * 50,
              relatedSymbols: relatedSymbolIds
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

  async similaritySearch(query: string, k: number = 4): Promise<VectorDocument[]> {
    if (this.documents.length === 0) return [];

    const queryEmbedding = await generateEmbeddings(this.config, query);
    const queryTokens = this.tokenize(query);
    
    const results: SearchResult[] = this.documents.map(doc => {
      let vectorScore = 0;
      if (doc.embedding) {
        vectorScore = this.cosineSimilarity(queryEmbedding, doc.embedding);
      }
      let keywordMatches = 0;
      queryTokens.forEach(token => {
        if (doc.tokens?.has(token)) keywordMatches++;
      });
      const keywordScore = queryTokens.size > 0 ? keywordMatches / queryTokens.size : 0;
      
      const finalScore = (vectorScore * 0.7) + (keywordScore * 0.3);

      return { doc, score: finalScore, matchType: keywordScore > 0.5 ? 'keyword' : 'vector' };
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k).map(r => r.doc);
  }
}
