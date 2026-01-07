
import { FileMetadata, CodeSymbol, SymbolKind, ReferenceLocation, ProcessedFile } from '../types';

/**
 * RAYAN AST-LITE ENGINE
 * A custom lexical analyzer that mimics AST behavior for JS/TS/Python/Go/Java.
 * It tokenizes code to understand Scope, Definitions, and Usage Context.
 */

// --- Tokenizer Utilities ---

const TOKEN_PATTERNS = {
  whitespace: /^\s+/,
  comment: /^(\/\/.*|\/\*[\s\S]*?\*\/|#.*)/,
  string: /^(['"`])(?:\\.|(?!\1).)*\1/,
  keyword: /^(export|import|class|function|const|let|var|def|interface|type|public|private|protected|static|async|return|if|else|for|while)\b/,
  identifier: /^[a-zA-Z_$][a-zA-Z0-9_$]*/,
  operator: /^[{}()[\].;,=:]/,
};

interface Token {
  type: keyof typeof TOKEN_PATTERNS | 'unknown';
  value: string;
  line: number;
}

const tokenize = (content: string): Token[] => {
  let cursor = 0;
  let line = 1;
  const tokens: Token[] = [];

  while (cursor < content.length) {
    const char = content[cursor];
    const rest = content.slice(cursor);

    // Skip Newlines for line counting
    if (char === '\n') {
      line++;
      cursor++;
      continue;
    }

    let matched = false;
    for (const [type, regex] of Object.entries(TOKEN_PATTERNS)) {
      const match = rest.match(regex);
      if (match) {
        if (type !== 'whitespace' && type !== 'comment') {
          tokens.push({ type: type as any, value: match[0], line });
        }
        // Count newlines inside block comments or strings
        const newlines = (match[0].match(/\n/g) || []).length;
        line += newlines;
        
        cursor += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      cursor++; // Skip unknown char
    }
  }
  return tokens;
};

// --- Parser Core ---

class CodeParser {
  private tokens: Token[];
  private cursor = 0;
  private symbols: CodeSymbol[] = [];
  private filePath: string;
  private dependencies: Set<string> = new Set();
  private scopeStack: string[] = ['global'];

  constructor(content: string, filePath: string) {
    this.tokens = tokenize(content);
    this.filePath = filePath;
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.cursor + offset];
  }

  private advance(): Token | undefined {
    return this.tokens[this.cursor++];
  }

  private generateId(name: string): string {
    return `${this.filePath}:${this.scopeStack.join('.')}:${name}`;
  }

  private extractSnippet(startLine: number): string {
    // Simplified snippet extraction for demo - normally would slice tokens
    return `Line ${startLine}: definition...`; 
  }

  public parse(): FileMetadata {
    const extension = this.filePath.split('.').pop()?.toLowerCase() || '';

    while (this.cursor < this.tokens.length) {
      const token = this.advance();
      if (!token) break;

      // 1. Block Scope Tracking
      if (token.value === '{') {
        const prev = this.tokens[this.cursor - 2];
        // Heuristic: If previous token was an identifier, assume it's the scope name
        this.scopeStack.push(prev && prev.type === 'identifier' ? prev.value : 'block');
      } 
      else if (token.value === '}') {
        if (this.scopeStack.length > 1) this.scopeStack.pop();
      }

      // 2. Import Detection (Dependency Graph)
      if (token.value === 'import' || token.value === 'from') {
         // Look ahead for string literals
         let lookahead = 0;
         while (lookahead < 10) {
           const t = this.peek(lookahead);
           if (t?.type === 'string') {
             this.dependencies.add(t.value.replace(/['"]/g, ''));
             break;
           }
           if (t?.value === ';') break;
           lookahead++;
         }
      }

      // 3. Definition Detection (Classes, Functions, Vars)
      if (token.type === 'keyword') {
        this.handleKeyword(token);
      }
    }

    // Enhance Snippets with actual source lines (Post-process)
    // In a real implementation, we would keep raw lines accessible.

    return {
      path: this.filePath,
      language: extension,
      symbols: this.symbols,
      dependencies: Array.from(this.dependencies),
      apiEndpoints: [], // TODO: specialized parser for routes
      isDbSchema: ['sql', 'prisma'].includes(extension),
      isInfra: this.filePath.includes('docker') || extension === 'tf'
    };
  }

  private handleKeyword(token: Token) {
    const next1 = this.peek(0);
    const next2 = this.peek(1);

    // Case: class MyClass
    if (token.value === 'class' && next1?.type === 'identifier') {
      this.addSymbol(next1.value, 'class', token.line);
    }
    // Case: function myFunc
    else if (token.value === 'function' && next1?.type === 'identifier') {
      this.addSymbol(next1.value, 'function', token.line);
    }
    // Case: const myVar = ...
    else if ((token.value === 'const' || token.value === 'let') && next1?.type === 'identifier') {
      // Heuristic: Only track if top-level or class-level (ignore small local vars)
      if (this.scopeStack.length <= 2) {
         this.addSymbol(next1.value, 'variable', token.line);
      }
    }
    // Case: def my_func (Python)
    else if (token.value === 'def' && next1?.type === 'identifier') {
      this.addSymbol(next1.value, 'function', token.line);
    }
  }

  private addSymbol(name: string, kind: SymbolKind, line: number) {
    this.symbols.push({
      id: this.generateId(name),
      name: name,
      kind,
      filePath: this.filePath,
      line,
      scope: this.scopeStack[this.scopeStack.length - 1],
      codeSnippet: `Source code at line ${line}`, // Placeholder, would extract actual text
      references: []
    });
  }
}

// --- Cross-Reference Linker ---

export const resolveReferences = (files: ProcessedFile[]): { symbolTable: Record<string, CodeSymbol>, nameIndex: Record<string, string[]> } => {
  const symbolTable: Record<string, CodeSymbol> = {};
  const nameIndex: Record<string, string[]> = {};

  // 1. Build Global Symbol Table
  files.forEach(file => {
    file.metadata.symbols.forEach(sym => {
      symbolTable[sym.id] = sym;
      
      if (!nameIndex[sym.name]) nameIndex[sym.name] = [];
      nameIndex[sym.name].push(sym.id);
    });
  });

  // 2. Scan for Usages (Naive Scan)
  // Real implementation would use the Tokenizer again to find identifiers in usage context.
  // Here we use a robust Regex on the whole content for performance, but filtered by imports.
  
  files.forEach(sourceFile => {
    const content = sourceFile.content;
    
    // Iterate over all known global symbols to see if they are used here
    Object.keys(nameIndex).forEach(name => {
      // Simple heuristic: If the file contains the string "Name", it *might* be a reference.
      // We improve this by checking imports or if it's in the same directory.
      if (content.includes(name)) {
         // Determine which ID is relevant (Scope Resolution)
         const candidateIds = nameIndex[name];
         let bestMatchId: string | null = null;

         for (const id of candidateIds) {
           const defFile = symbolTable[id].filePath;
           
           // Self-reference?
           if (defFile === sourceFile.path) continue;

           // Is it imported?
           const isImported = sourceFile.metadata.dependencies.some(dep => {
             // Normalized check: './services/auth' vs 'services/auth.ts'
             return defFile.includes(dep.replace(/^(\.\/|\.\.\/)/, ''));
           });

           if (isImported) {
             bestMatchId = id;
             break;
           }
         }

         // Add Reference if confirmed
         if (bestMatchId) {
           // Find line number of usage
           const lines = content.split('\n');
           lines.forEach((line, idx) => {
             if (line.includes(name) && !line.startsWith('import')) {
               symbolTable[bestMatchId].references.push({
                 filePath: sourceFile.path,
                 line: idx + 1,
                 snippet: line.trim()
               });
             }
           });
         }
      }
    });
  });

  return { symbolTable, nameIndex };
};


// --- Main Export ---

export const extractFileMetadata = (content: string, path: string): FileMetadata => {
  try {
    const parser = new CodeParser(content, path);
    const metadata = parser.parse();
    
    // Fill in snippet content for real this time
    const lines = content.split('\n');
    metadata.symbols.forEach(sym => {
       const start = Math.max(0, sym.line - 1);
       const end = Math.min(lines.length, sym.line + 5);
       sym.codeSnippet = lines.slice(start, end).join('\n');
    });

    return metadata;
  } catch (e) {
    console.warn(`Parser failed for ${path}, falling back to empty metadata.`, e);
    return {
      path,
      language: 'text',
      symbols: [],
      dependencies: [],
      apiEndpoints: [],
      isDbSchema: false,
      isInfra: false
    };
  }
};
