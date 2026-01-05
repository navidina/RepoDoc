

import { FileMetadata } from '../types';

/**
 * A lightweight heuristic parser to extract "facts" from code without full AST overhead.
 * This runs in the browser and helps ground the LLM with deterministic data.
 * 
 * Updated: Improved comment handling to reduce false positives from commented-out code.
 * Updated: Detection for Database Schemas and Infrastructure files.
 */
export const extractFileMetadata = (content: string, path: string): FileMetadata => {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  const filename = path.split('/').pop()?.toLowerCase() || '';
  
  const metadata: FileMetadata = {
    path,
    language: extension,
    classes: [],
    functions: [],
    imports: [],
    apiEndpoints: [],
    hasApiPattern: false,
    isDbSchema: false,
    isInfra: false
  };

  // Skip minified or massive files
  if (content.length > 100000) return metadata;

  // --- 1. File Type Detection based on Name/Extension (Fast check) ---
  
  // Database Detection
  if (['.sql', '.prisma'].includes(extension)) {
      metadata.isDbSchema = true;
  }
  
  // Infra Detection
  if (['dockerfile', 'docker-compose.yml', 'docker-compose.yaml', 'main.tf', 'variables.tf', 'outputs.tf'].includes(filename) || extension === '.tf') {
      metadata.isInfra = true;
  }

  const lines = content.split('\n');

  // Regex Patterns
  const patterns = {
    // JS/TS
    jsClass: /class\s+([A-Z][a-zA-Z0-9_]*)/,
    jsFunc: /(?:function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)/,
    jsImport: /import\s+.*\s+from\s+['"]([^'"]+)['"]/,
    
    // Python
    pyClass: /class\s+([a-zA-Z0-9_]+)/,
    pyFunc: /def\s+([a-zA-Z0-9_]+)/,
    pyImport: /(?:from\s+([a-zA-Z0-9_.]+) |import\s+([a-zA-Z0-9_.]+))/,

    // API Patterns
    apiGet: /\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/, // app.get('/users')
    apiDecorator: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(\s*['"]([^'"]+)['"]/, // Spring/NestJS
    apiPyRoute: /@app\.route\s*\(\s*['"]([^'"]+)['"]/, // Flask

    // DB Patterns (in code)
    typeOrmEntity: /@Entity\(['"]?([a-zA-Z0-9_]+)['"]?\)/, // TypeORM
    mongooseSchema: /new\s+Schema\(/, // Mongoose
    sqlCreateTable: /CREATE\s+TABLE\s+([a-zA-Z0-9_]+)/i
  };

  const isJsTs = ['js', 'jsx', 'ts', 'tsx'].includes(extension);
  const isPy = ['py'].includes(extension);

  let inBlockComment = false;

  for (const line of lines) {
    let trimmed = line.trim();
    if (!trimmed) continue;

    // --- Comment Handling ---
    if (isJsTs) {
      if (inBlockComment) {
        if (trimmed.includes('*/')) {
          inBlockComment = false;
          trimmed = trimmed.split('*/')[1].trim(); 
        } else {
          continue;
        }
      }

      if (trimmed.startsWith('/*')) {
        if (trimmed.includes('*/')) {
           trimmed = trimmed.replace(/\/\*.*?\*\//g, '').trim();
        } else {
           inBlockComment = true;
           continue;
        }
      }
      
      const commentIdx = trimmed.indexOf('//');
      if (commentIdx !== -1) {
        trimmed = trimmed.substring(0, commentIdx).trim();
      }
    } else if (isPy || extension === '.tf' || extension === '.yml' || extension === '.yaml') {
      const commentIdx = trimmed.indexOf('#');
      if (commentIdx !== -1) {
         trimmed = trimmed.substring(0, commentIdx).trim();
      }
    }

    if (!trimmed) continue;

    // --- Content-Based Parsing ---

    if (metadata.isDbSchema === false) {
       if (trimmed.match(patterns.typeOrmEntity) || trimmed.match(patterns.mongooseSchema) || trimmed.match(patterns.sqlCreateTable)) {
           metadata.isDbSchema = true;
       }
    }

    if (isJsTs) {
      const classMatch = trimmed.match(patterns.jsClass);
      if (classMatch) metadata.classes.push(classMatch[1]);

      const funcMatch = trimmed.match(patterns.jsFunc);
      if (funcMatch) metadata.functions.push(funcMatch[1] || funcMatch[2]);

      const importMatch = trimmed.match(patterns.jsImport);
      if (importMatch) metadata.imports.push(importMatch[1]);

      const apiMatch = trimmed.match(patterns.apiGet);
      if (apiMatch) {
        metadata.apiEndpoints.push(`${apiMatch[1].toUpperCase()} ${apiMatch[2]}`);
        metadata.hasApiPattern = true;
      }
      
      const decoratorMatch = trimmed.match(patterns.apiDecorator);
      if (decoratorMatch) {
          const method = decoratorMatch[1].replace('Mapping', '').toUpperCase();
          metadata.apiEndpoints.push(`${method} ${decoratorMatch[2]}`);
          metadata.hasApiPattern = true;
      }

    } else if (isPy) {
      const classMatch = trimmed.match(patterns.pyClass);
      if (classMatch) metadata.classes.push(classMatch[1]);

      const funcMatch = trimmed.match(patterns.pyFunc);
      if (funcMatch) metadata.functions.push(funcMatch[1]);

       const importMatch = trimmed.match(patterns.pyImport);
       if (importMatch) metadata.imports.push(importMatch[1] || importMatch[2]);

       const apiMatch = trimmed.match(patterns.apiPyRoute);
       if (apiMatch) {
         metadata.apiEndpoints.push(`ENDPOINT ${apiMatch[1]}`);
         metadata.hasApiPattern = true;
       }
    }
  }

  return metadata;
};