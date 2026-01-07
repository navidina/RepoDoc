

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

// --- CODEWIKI INTELLIGENCE TYPES ---

export type SymbolKind = 'class' | 'function' | 'variable' | 'interface' | 'endpoint' | 'database_table';

export interface CodeSymbol {
  id: string;          // Unique ID (e.g., "UserService:login")
  name: string;        // Display Name (e.g., "login")
  kind: SymbolKind;
  filePath: string;
  line: number;
  codeSnippet: string; // For Hover Preview
  docString?: string;  // JSDoc / DocString
  references: string[]; // List of file paths using this symbol
}

export interface FileMetadata {
  path: string;
  language: string;
  symbols: CodeSymbol[]; // Rich AST-like symbols
  dependencies: string[]; // Imported files
  isDbSchema: boolean;
  isInfra: boolean;
  apiEndpoints: string[];
}

export interface KnowledgeGraph {
  nodes: Record<string, FileMetadata>; // Map filePath -> Metadata
  symbolTable: Record<string, CodeSymbol>; // Map symbolName -> Symbol
}

// --- RAG & SEARCH TYPES ---

export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    filePath: string;
    startLine?: number;
    endLine?: number;
    symbolRef?: string; // Link to specific symbol
  };
  embedding?: number[];
  tokens?: Set<string>; // For Hybrid Search (Keyword Matching)
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
}