
import { FileMetadata, CodeSymbol, SymbolKind, ProcessedFile, SymbolRelationships } from '../types';

/**
 * RAYAN SEMANTIC ENGINE (v2.0)
 * Replaces Regex with a Token-Stream State Machine.
 * Features:
 * 1. Scope Tracking (Global -> Class -> Method -> Block)
 * 2. Complexity Analysis (Cyclomatic Score)
 * 3. Hash Generation (Incremental Indexing)
 * 4. Call Graph Building (GraphRAG)
 */

// --- Utils ---

export const generateContentHash = async (content: string): Promise<string> => {
  // Simple DJB2 hash for string (fast and sufficient for client-side diffing)
  let hash = 5381;
  for (let i = 0; i < content.length; i++) {
    hash = ((hash << 5) + hash) + content.charCodeAt(i); /* hash * 33 + c */
  }
  return hash.toString(16);
};

const calculateCyclomaticComplexity = (code: string): number => {
  // Heuristic: Start at 1, add 1 for each branching construct
  let score = 1;
  const branchingPatterns = [
    /\bif\b/g, /\belse\b/g, /\bfor\b/g, /\bwhile\b/g, 
    /\bcase\b/g, /\bcatch\b/g, /\?.*:/g, /&&/g, /\|\|/g
  ];
  branchingPatterns.forEach(p => {
    const matches = code.match(p);
    if (matches) score += matches.length;
  });
  return score;
};

// --- Tokenizer ---

const TOKEN_TYPES = {
  whitespace: /^\s+/,
  comment: /^(\/\/.*|\/\*[\s\S]*?\*\/|#.*|""".*""")/,
  string: /^(['"`])(?:\\.|(?!\1).)*\1/,
  keyword: /^(export|import|from|class|function|const|let|var|def|interface|type|public|private|protected|static|async|await|return|if|else|for|while|try|catch|new|extends|implements)\b/,
  identifier: /^[a-zA-Z_$][a-zA-Z0-9_$]*/,
  operator: /^[{}()[\].;,=:<>\+\-\*\/!&\|]/,
};

interface Token {
  type: keyof typeof TOKEN_TYPES | 'unknown';
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

    if (char === '\n') {
      line++;
      cursor++;
      continue;
    }

    let matched = false;
    for (const [type, regex] of Object.entries(TOKEN_TYPES)) {
      const match = rest.match(regex);
      if (match) {
        if (type !== 'whitespace' && type !== 'comment') {
          tokens.push({ type: type as any, value: match[0], line });
        }
        const newlines = (match[0].match(/\n/g) || []).length;
        line += newlines;
        cursor += match[0].length;
        matched = true;
        break;
      }
    }

    if (!matched) {
      cursor++;
    }
  }
  return tokens;
};

// --- Semantic Parser (AST-Lite) ---

class SemanticParser {
  private tokens: Token[];
  private cursor = 0;
  private symbols: CodeSymbol[] = [];
  private filePath: string;
  private dependencies: Set<string> = new Set();
  
  // Scope Stack: Tracks where we are (e.g. ['global', 'class:User', 'method:login'])
  private scopeStack: string[] = ['global'];
  private braceBalanceStack: number[] = [0]; // Tracks {} depth per scope

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
    // Sanitize scope for ID generation
    const scopeStr = this.scopeStack.join('.').replace(/[:\s]/g, '_');
    return `${this.filePath}:${scopeStr}:${name}`;
  }

  public parse(): FileMetadata {
    const extension = this.filePath.split('.').pop()?.toLowerCase() || '';

    while (this.cursor < this.tokens.length) {
      const token = this.advance();
      if (!token) break;

      // 1. Scope Management (Brace Counting)
      if (token.value === '{') {
        this.braceBalanceStack[this.braceBalanceStack.length - 1]++;
      } else if (token.value === '}') {
        this.braceBalanceStack[this.braceBalanceStack.length - 1]--;
        // If balance hits 0, we exited the current scope
        if (this.braceBalanceStack[this.braceBalanceStack.length - 1] === 0 && this.scopeStack.length > 1) {
           this.scopeStack.pop();
           this.braceBalanceStack.pop();
        }
      }

      // 2. Dependency Tracking
      if (token.value === 'import' || token.value === 'from') {
         this.parseImport();
      }

      // 3. Definition Detection (State Machine)
      if (token.type === 'keyword') {
        this.parseDefinition(token);
      }
    }

    // Post-Process: Calculate Complexity for each symbol
    this.symbols.forEach(sym => {
       sym.complexityScore = calculateCyclomaticComplexity(sym.codeSnippet);
    });

    return {
      path: this.filePath,
      language: extension,
      contentHash: '', // Will be filled externally
      lastProcessed: Date.now(),
      symbols: this.symbols,
      dependencies: Array.from(this.dependencies),
      apiEndpoints: [],
      isDbSchema: ['sql', 'prisma'].includes(extension),
      isInfra: this.filePath.includes('docker') || extension === 'tf'
    };
  }

  private parseImport() {
    let lookahead = 0;
    while (lookahead < 15) { // Limit lookahead
       const t = this.peek(lookahead);
       if (t?.type === 'string') {
         this.dependencies.add(t.value.replace(/['"]/g, ''));
       }
       if (t?.value === ';' || t?.value === '\n') break;
       lookahead++;
    }
  }

  private parseDefinition(token: Token) {
    const next1 = this.peek(0);
    const next2 = this.peek(1);
    const next3 = this.peek(2);

    let kind: SymbolKind | null = null;
    let name = '';

    // Pattern: class MyClass
    if (token.value === 'class' && next1?.type === 'identifier') {
      kind = 'class';
      name = next1.value;
      this.enterScope(`class:${name}`);
    }
    // Pattern: interface MyInterface
    else if (token.value === 'interface' && next1?.type === 'identifier') {
      kind = 'interface';
      name = next1.value;
      this.enterScope(`interface:${name}`);
    }
    // Pattern: function myFunc
    else if ((token.value === 'function' || token.value === 'def') && next1?.type === 'identifier') {
      kind = 'function';
      name = next1.value;
      this.enterScope(`function:${name}`);
    }
    // Pattern: const/let/var myVar = ...
    else if ((token.value === 'const' || token.value === 'let' || token.value === 'var') && next1?.type === 'identifier') {
       // Only track top-level or class-level variables
       if (this.scopeStack.length <= 2) {
          kind = 'variable';
          name = next1.value;
          // Variables don't usually create a brace scope like classes/funcs, so we don't enterScope
       }
    }
    // Pattern (TS/JS Method): public myMethod() or myMethod() {
    else if (next1?.value === '(' && this.scopeStack[this.scopeStack.length-1].startsWith('class')) {
       // Only if previous wasn't a reserved keyword (like 'if', 'while')
       if (token.type === 'identifier') {
          kind = 'method';
          name = token.value;
          this.enterScope(`method:${name}`);
       }
    }

    if (kind && name) {
      this.addSymbol(name, kind, token.line);
    }
  }

  private enterScope(scopeName: string) {
    this.scopeStack.push(scopeName);
    this.braceBalanceStack.push(0);
  }

  private addSymbol(name: string, kind: SymbolKind, line: number) {
    this.symbols.push({
      id: this.generateId(name),
      name: name,
      kind,
      filePath: this.filePath,
      line,
      scope: this.scopeStack[this.scopeStack.length - 2] || 'global', // Parent scope
      codeSnippet: '', // Extracted later
      relationships: { calledBy: [], calls: [] },
      complexityScore: 0
    });
  }
}

// --- GraphRAG Linker (Pass 2) ---

export const buildGraph = (files: ProcessedFile[]): { symbolTable: Record<string, CodeSymbol>, nameIndex: Record<string, string[]> } => {
  const symbolTable: Record<string, CodeSymbol> = {};
  const nameIndex: Record<string, string[]> = {};

  // 1. Initialize Tables
  files.forEach(file => {
    file.metadata.symbols.forEach(sym => {
      symbolTable[sym.id] = sym;
      if (!nameIndex[sym.name]) nameIndex[sym.name] = [];
      nameIndex[sym.name].push(sym.id);
    });
  });

  // 2. Build Call Graph (Who calls who?)
  // We scan the *content* of each symbol to see if it invokes other symbols.
  
  files.forEach(file => {
    // For each defined symbol in this file
    file.metadata.symbols.forEach(sourceSym => {
      // Analyze its code snippet body (simplified)
      const body = sourceSym.codeSnippet;
      
      // Check against all known symbol names
      // Optimization: Filter candidate names by file dependencies first
      
      // For every other symbol in the universe (naive O(n^2), optimized by nameIndex)
      Object.keys(nameIndex).forEach(targetName => {
        if (body.includes(targetName)) {
           // Potential call detected.
           // Disambiguate: Which 'User' is it? (Import check)
           const candidateIds = nameIndex[targetName];
           
           for (const targetId of candidateIds) {
             if (sourceSym.id === targetId) continue; // Self-reference
             
             const targetSym = symbolTable[targetId];
             
             // Is it reachable?
             // 1. Same file?
             // 2. Imported?
             const isSameFile = file.path === targetSym.filePath;
             const isImported = file.metadata.dependencies.some(dep => targetSym.filePath.includes(dep.replace('./', '')));
             
             if (isSameFile || isImported) {
                // Link them!
                if (!sourceSym.relationships.calls.includes(targetId)) {
                    sourceSym.relationships.calls.push(targetId);
                }
                if (!targetSym.relationships.calledBy.includes(sourceSym.id)) {
                    targetSym.relationships.calledBy.push(sourceSym.id);
                }
             }
           }
        }
      });
    });
  });

  return { symbolTable, nameIndex };
};

export const extractFileMetadata = async (content: string, path: string): Promise<FileMetadata> => {
  try {
    const parser = new SemanticParser(content, path);
    const metadata = parser.parse();
    metadata.contentHash = await generateContentHash(content);
    
    // Extract actual snippets
    const lines = content.split('\n');
    metadata.symbols.forEach(sym => {
       const start = Math.max(0, sym.line - 1);
       // Simple heuristic: read until next empty line or 15 lines max
       let end = Math.min(lines.length, sym.line + 15);
       for(let i = sym.line; i < end; i++) {
          if (lines[i].trim() === '}') { end = i + 1; break; }
       }
       sym.codeSnippet = lines.slice(start, end).join('\n');
    });

    return metadata;
  } catch (e) {
    console.warn(`Semantic Parser failed for ${path}`, e);
    return {
      path,
      language: 'text',
      contentHash: '',
      lastProcessed: Date.now(),
      symbols: [],
      dependencies: [],
      apiEndpoints: [],
      isDbSchema: false,
      isInfra: false
    };
  }
};
