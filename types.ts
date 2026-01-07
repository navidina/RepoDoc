
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

// --- CODEWIKI INTELLIGENCE TYPES (UPDATED) ---

export type SymbolKind = 'class' | 'function' | 'variable' | 'interface' | 'endpoint' | 'database_table' | 'import';

export interface CodeSymbol {
  id: string;          // Unique Global ID (e.g., "src/services/auth.ts:loginUser")
  name: string;        // Display Name (e.g., "loginUser")
  kind: SymbolKind;
  filePath: string;
  line: number;
  scope: string;       // 'global', 'class:UserService', 'function:init'
  codeSnippet: string; 
  docString?: string;  
  references: ReferenceLocation[]; // Where is this symbol used?
  imports?: string[]; // If it's a file/module, what does it import?
}

export interface ReferenceLocation {
  filePath: string;
  line: number;
  snippet: string;
}

export interface FileMetadata {
  path: string;
  language: string;
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
    symbolRef?: string; 
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
}
