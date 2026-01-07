
import { FileMetadata, CodeSymbol, SymbolKind } from '../types';

/**
 * Advanced Code Parser for CodeWiki.
 * Moves beyond simple Regex to a Lexical Analysis approach to build a Symbol Table.
 */

// Helper to sanitize code for snippet extraction
const extractSnippet = (lines: string[], startLine: number, limit: number = 10): string => {
  return lines.slice(startLine, Math.min(startLine + limit, lines.length)).join('\n');
};

const cleanDocString = (lines: string[], index: number): string | undefined => {
  if (index <= 0) return undefined;
  let i = index - 1;
  const docs = [];
  while (i >= 0) {
    const line = lines[i].trim();
    if (line.startsWith('*/') || line.endsWith('*/')) { i--; continue; }
    if (line.startsWith('*') || line.startsWith('//') || line.startsWith('#')) {
      docs.unshift(line.replace(/^(\/\/|#|\*)\s?/, ''));
      i--;
    } else if (line.startsWith('/*')) {
       i--; 
       break; 
    } else {
      break;
    }
  }
  return docs.length > 0 ? docs.join(' ') : undefined;
};

export const extractFileMetadata = (content: string, path: string): FileMetadata => {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  const lines = content.split('\n');
  
  const metadata: FileMetadata = {
    path,
    language: extension,
    symbols: [],
    dependencies: [],
    apiEndpoints: [],
    isDbSchema: false,
    isInfra: false
  };

  if (content.length > 200000) return metadata; // Safety cap

  // --- High-Level Classification ---
  if (['.sql', '.prisma'].includes(extension)) metadata.isDbSchema = true;
  if (path.includes('docker') || path.endsWith('.tf')) metadata.isInfra = true;

  // --- Lexical Analyzers per Language ---
  
  // 1. JavaScript / TypeScript Analyzer
  if (['js', 'jsx', 'ts', 'tsx'].includes(extension)) {
    const regexClass = /class\s+([A-Z][a-zA-Z0-9_]*)/g;
    const regexFunc = /(?:function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)/g;
    const regexImport = /import\s+.*\s+from\s+['"]([^'"]+)['"]/g;
    const regexApi = /\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/gi;

    lines.forEach((line, idx) => {
      // Classes
      let match;
      while ((match = regexClass.exec(line)) !== null) {
        metadata.symbols.push({
          id: `${match[1]}`,
          name: match[1],
          kind: 'class',
          filePath: path,
          line: idx + 1,
          codeSnippet: extractSnippet(lines, idx),
          docString: cleanDocString(lines, idx),
          references: []
        });
      }

      // Functions
      while ((match = regexFunc.exec(line)) !== null) {
        const name = match[1] || match[2];
        if (name) {
          metadata.symbols.push({
            id: `${name}`,
            name: name,
            kind: 'function',
            filePath: path,
            line: idx + 1,
            codeSnippet: extractSnippet(lines, idx),
            docString: cleanDocString(lines, idx),
            references: []
          });
        }
      }

      // Imports (Dependencies)
      while ((match = regexImport.exec(line)) !== null) {
        metadata.dependencies.push(match[1]);
      }

      // APIs
      while ((match = regexApi.exec(line)) !== null) {
        const method = match[1].toUpperCase();
        const route = match[2];
        metadata.apiEndpoints.push(`${method} ${route}`);
        metadata.symbols.push({
           id: `${method}_${route}`,
           name: `${method} ${route}`,
           kind: 'endpoint',
           filePath: path,
           line: idx + 1,
           codeSnippet: line.trim(),
           references: []
        });
      }
    });
  }

  // 2. Python Analyzer
  else if (extension === 'py') {
    const regexClass = /^class\s+([a-zA-Z0-9_]+)/;
    const regexFunc = /^def\s+([a-zA-Z0-9_]+)/;
    const regexImport = /^(?:from\s+([a-zA-Z0-9_.]+)|import\s+([a-zA-Z0-9_.]+))/;
    const regexRoute = /@app\.route\s*\(\s*['"]([^'"]+)['"]/;

    lines.forEach((line, idx) => {
      const trimmed = line.trim();
      
      const classMatch = line.match(regexClass);
      if (classMatch) {
        metadata.symbols.push({
          id: classMatch[1],
          name: classMatch[1],
          kind: 'class',
          filePath: path,
          line: idx + 1,
          codeSnippet: extractSnippet(lines, idx),
          docString: cleanDocString(lines, idx),
          references: []
        });
      }

      const funcMatch = line.match(regexFunc);
      if (funcMatch) {
         metadata.symbols.push({
          id: funcMatch[1],
          name: funcMatch[1],
          kind: 'function',
          filePath: path,
          line: idx + 1,
          codeSnippet: extractSnippet(lines, idx),
          docString: cleanDocString(lines, idx),
          references: []
        });
      }

      const importMatch = trimmed.match(regexImport);
      if (importMatch) {
        metadata.dependencies.push(importMatch[1] || importMatch[2]);
      }
      
      const routeMatch = trimmed.match(regexRoute);
      if (routeMatch) {
         metadata.apiEndpoints.push(`ENDPOINT ${routeMatch[1]}`);
      }
    });
  }

  return metadata;
};
