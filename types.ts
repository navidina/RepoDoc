
export interface FileNode {
  path: string;
  name: string;
  type: 'file' | 'directory';
  content?: string;
  size: number;
}

export interface ProcessingLog {
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'error' | 'warning';
}

export interface OllamaConfig {
  baseUrl: string;
  model: string;
  embeddingModel: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export enum AppMode {
  DASHBOARD = 'DASHBOARD',
  SETTINGS = 'SETTINGS'
}

// --- CODEWIKI INTELLIGENCE TYPES (UPDATED FOR GRAPHRAG) ---

export type SymbolKind = 'class' | 'function' | 'variable' | 'interface' | 'endpoint' | 'database_table' | 'import' | 'method';

export interface SymbolRelationships {
  calledBy: string[]; // List of Symbol IDs that call this symbol
  calls: string[];    // List of Symbol IDs called by this symbol
  inheritsFrom?: string[];
  implementedIn?: string[];
}

export interface CodeSymbol {
  id: string;          // Unique Global ID (e.g., "src/services/auth.ts:loginUser")
  name: string;        // Display Name (e.g., "loginUser")
  kind: SymbolKind;
  filePath: string;
  line: number;
  scope: string;       // 'global', 'class:UserService', 'function:init'
  codeSnippet: string; 
  docString?: string;  
  
  // GraphRAG Data
  relationships: SymbolRelationships;
  complexityScore: number; // Cyclomatic Complexity
}

export interface ReferenceLocation {
  filePath: string;
  line: number;
  snippet: string;
}

export interface FileMetadata {
  path: string;
  language: string;
  contentHash: string; // MD5/SHA hash for Incremental Indexing
  lastProcessed: number;
  symbols: CodeSymbol[]; 
  dependencies: string[]; // List of imported file paths
  isDbSchema: boolean;
  isInfra: boolean;
  apiEndpoints: string[];
}

export interface KnowledgeGraph {
  nodes: Record<string, FileMetadata>; // Map filePath -> Metadata
  symbolTable: Record<string, CodeSymbol>; // Map symbolId -> Symbol Data
  nameIndex: Record<string, string[]>; // Map simpleName ("User") -> [IDs...] (handle collisions)
}

// --- RAG & SEARCH TYPES ---

export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    symbolId?: string; // Link to specific symbol in Graph
    relatedSymbols?: string[]; // IDs of related symbols (GraphRAG injection)
  };
  embedding?: number[];
  tokens?: Set<string>; 
}

export interface SearchResult {
  doc: VectorDocument;
  score: number;
  matchType: 'vector' | 'keyword' | 'hybrid';
}

export interface ProcessedFile {
  path: string;
  content: string;
  size: number;
  lines: number;
  metadata: FileMetadata;
  isCached?: boolean; // Flag to skip processing
}
