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
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export enum AppMode {
  BROWSER = 'BROWSER',
  CLI_CODE = 'CLI_CODE'
}