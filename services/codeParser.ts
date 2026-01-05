
import { FileMetadata } from '../types';

/**
 * A lightweight heuristic parser to extract "facts" from code without full AST overhead.
 * This runs in the browser and helps ground the LLM with deterministic data.
 */
export const extractFileMetadata = (content: string, path: string): FileMetadata => {
  const extension = path.split('.').pop()?.toLowerCase() || '';
  const metadata: FileMetadata = {
    path,
    language: extension,
    classes: [],
    functions: [],
    imports: [],
    apiEndpoints: [],
    hasApiPattern: false
  };

  // Skip minified or massive files
  if (content.length > 100000) return metadata;

  const lines = content.split('\n');

  // Regex Patterns
  const patterns = {
    // JS/TS: class MyClass, function myFunc, const myFunc = () =>
    jsClass: /class\s+([A-Z][a-zA-Z0-9_]*)/,
    jsFunc: /(?:function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[a-zA-Z0-9_]+)\s*=>)/,
    jsImport: /import\s+.*\s+from\s+['"]([^'"]+)['"]/,
    
    // Python: class MyClass, def my_func
    pyClass: /class\s+([a-zA-Z0-9_]+)/,
    pyFunc: /def\s+([a-zA-Z0-9_]+)/,
    pyImport: /(?:from\s+([a-zA-Z0-9_.]+) |import\s+([a-zA-Z0-9_.]+))/,

    // API Patterns (Heuristic)
    apiGet: /\.(get|post|put|delete|patch)\s*\(\s*['"]([^'"]+)['"]/, // app.get('/users')
    apiDecorator: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\s*\(\s*['"]([^'"]+)['"]/, // Spring/NestJS
    apiPyRoute: /@app\.route\s*\(\s*['"]([^'"]+)['"]/ // Flask
  };

  const isJsTs = ['js', 'jsx', 'ts', 'tsx'].includes(extension);
  const isPy = ['py'].includes(extension);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#') || trimmed.startsWith('*')) continue;

    if (isJsTs) {
      // Classes
      const classMatch = trimmed.match(patterns.jsClass);
      if (classMatch) metadata.classes.push(classMatch[1]);

      // Functions
      const funcMatch = trimmed.match(patterns.jsFunc);
      if (funcMatch) metadata.functions.push(funcMatch[1] || funcMatch[2]);

      // Imports
      const importMatch = trimmed.match(patterns.jsImport);
      if (importMatch) metadata.imports.push(importMatch[1]);

      // APIs
      const apiMatch = trimmed.match(patterns.apiGet);
      if (apiMatch) {
        metadata.apiEndpoints.push(`${apiMatch[1].toUpperCase()} ${apiMatch[2]}`);
        metadata.hasApiPattern = true;
      }
      
      // NestJS Decorators
      const decoratorMatch = trimmed.match(patterns.apiDecorator);
      if (decoratorMatch) {
          const method = decoratorMatch[1].replace('Mapping', '').toUpperCase();
          metadata.apiEndpoints.push(`${method} ${decoratorMatch[2]}`);
          metadata.hasApiPattern = true;
      }

    } else if (isPy) {
      // Classes
      const classMatch = trimmed.match(patterns.pyClass);
      if (classMatch) metadata.classes.push(classMatch[1]);

      // Functions
      const funcMatch = trimmed.match(patterns.pyFunc);
      if (funcMatch) metadata.functions.push(funcMatch[1]);

       // Imports
       const importMatch = trimmed.match(patterns.pyImport);
       if (importMatch) metadata.imports.push(importMatch[1] || importMatch[2]);

       // APIs (Flask)
       const apiMatch = trimmed.match(patterns.apiPyRoute);
       if (apiMatch) {
         metadata.apiEndpoints.push(`ENDPOINT ${apiMatch[1]}`);
         metadata.hasApiPattern = true;
       }
    }
  }

  return metadata;
};
