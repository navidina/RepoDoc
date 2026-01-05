

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
  embeddingModel: string; // New: Specific model for RAG embeddings
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export enum AppMode {
  BROWSER = 'BROWSER',
  CLI_CODE = 'CLI_CODE'
}

// New Interface for Static Analysis (Gap 2 Solution)
export interface FileMetadata {
  path: string;
  language: string;
  classes: string[];
  functions: string[];
  imports: string[];
  apiEndpoints: string[]; // e.g., "GET /users"
  hasApiPattern: boolean;
  isDbSchema: boolean;    // New: Detected as SQL/Prisma/Entity
  isInfra: boolean;       // New: Detected as Docker/Terraform/Config
}

// --- RAG Types ---
export interface VectorDocument {
  id: string;
  content: string;
  metadata: {
    filePath: string;
    startLine?: number;
    endLine?: number;
  };
  embedding?: number[];
}

// --- GitHub Types ---
export interface ProcessedFile {
  path: string;
  content: string;
  size: number;
  metadata: FileMetadata;
}
