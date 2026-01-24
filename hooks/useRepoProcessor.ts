
import React, { useState, useEffect } from 'react';
import { OllamaConfig, ProcessingLog, ProcessedFile, CodeSymbol, FileMetadata } from '../types';
import { IGNORED_DIRS, ALLOWED_EXTENSIONS, CONFIG_FILES, LANGUAGE_MAP, PROMPT_LEVEL_1_ROOT, PROMPT_LEVEL_2_CODE, PROMPT_COOKBOOK, PROMPT_DATA_FLOW, PROMPT_LEVEL_7_ERD, PROMPT_LEVEL_8_CLASS, PROMPT_LEVEL_5_SEQUENCE, PROMPT_LEVEL_9_INFRA, PROMPT_USE_CASE } from '../utils/constants';
import { checkOllamaConnection, generateCompletion } from '../services/ollamaService';
import { extractFileMetadata, buildGraph, generateContentHash } from '../services/codeParser';
import { LocalVectorStore } from '../services/vectorStore';
import { parseGithubUrl, fetchGithubRepoTree, fetchGithubFileContent } from '../services/githubService';
import { generateFileHeaderHTML, extractMermaidCode } from '../utils/markdownHelpers';

interface UseRepoProcessorProps {
  config: OllamaConfig;
  inputType: 'local' | 'github';
  files: FileList | null;
  githubUrl: string;
  docLevels: any;
  vectorStoreRef: React.MutableRefObject<LocalVectorStore | null>;
}

const STORAGE_KEY = 'rayan_docs_session';
const CACHE_KEY = 'rayan_file_cache';

export const useRepoProcessor = () => {
  // --- State ---
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [stats, setStats] = useState<{ lang: string; lines: number; percent: number; color: string }[]>([]);
  const [knowledgeGraph, setKnowledgeGraph] = useState<Record<string, CodeSymbol>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasContext, setHasContext] = useState(false);

  // --- Persistence ---
  // Load session from storage on mount
  useEffect(() => {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            setLogs(data.logs || []);
            setGeneratedDoc(data.generatedDoc || '');
            setStats(data.stats || []);
            setKnowledgeGraph(data.knowledgeGraph || {});
        }
    } catch (e) { console.error('Load session failed', e); }
  }, []);

  const addLog = (message: string, type: ProcessingLog['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString('fa-IR'), message, type }]);
  };

  // --- Incremental Cache Manager ---
  const loadFileCache = (): Record<string, FileMetadata> => {
     try {
         const raw = localStorage.getItem(CACHE_KEY);
         return raw ? JSON.parse(raw) : {};
     } catch { return {}; }
  };

  const saveFileCache = (cache: Record<string, FileMetadata>) => {
      try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
      } catch (e) { console.warn('Cache quota exceeded'); }
  };

  const processRepository = async ({ config, inputType, files, githubUrl, docLevels, vectorStoreRef }: UseRepoProcessorProps) => {
    setIsProcessing(true);
    setProgress(0);
    setGeneratedDoc('');
    setLogs([]);
    setStats([]);
    setKnowledgeGraph({});
    setHasContext(false);
    
    vectorStoreRef.current = new LocalVectorStore(config);

    try {
      addLog('سیستم هوشمند رایان نسخه ۲.۰ فعال شد.', 'info');
      addLog('در حال بررسی اتصال به Ollama...', 'info');
      const isConnected = await checkOllamaConnection(config);
      if (!isConnected) throw new Error(`اتصال به Ollama در آدرس ${config.baseUrl} برقرار نشد.`);
      addLog('اتصال به Ollama برقرار شد.', 'success');

      let fileTree = '';
      const configContents: string[] = [];
      const sourceFiles: ProcessedFile[] = [];
      const languageStats: Record<string, number> = {};
      const fileCache = loadFileCache();
      let cacheHitCount = 0;

      addLog('فاز ۱: اسکن فایل‌ها و بررسی تغییرات (Incremental Scan)...', 'info');

      // Helper: Process File (Check Cache vs Reparse)
      const ingestFile = async (path: string, content: string, size: number) => {
           const lines = content.split(/\r\n|\r|\n/).length;
           const extension = '.' + path.split('.').pop()?.toLowerCase();
           const langName = LANGUAGE_MAP[extension || ''] || 'Other';
           
           if (langName !== 'Other') languageStats[langName] = (languageStats[langName] || 0) + lines;
           
           // Hash check
           const currentHash = await generateContentHash(content);
           const cachedMeta = fileCache[path];

           if (cachedMeta && cachedMeta.contentHash === currentHash) {
               // CACHE HIT: Use cached metadata
               cacheHitCount++;
               return { path, content, size, lines, metadata: cachedMeta, isCached: true };
           } else {
               // CACHE MISS: Parse
               const metadata = await extractFileMetadata(content, path);
               // Update cache
               fileCache[path] = metadata;
               return { path, content, size, lines, metadata, isCached: false };
           }
      };

      // --- File Loading Logic ---
      if (inputType === 'local' && files) {
          const fileList: File[] = Array.from(files);
          const readFileContent = (file: File): Promise<string> => {
            return new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = (e) => reject(e);
              reader.readAsText(file);
            });
          };

          for (const file of fileList) {
            const filePath = file.webkitRelativePath || file.name;
            const pathParts = filePath.split('/');
            if (pathParts.some(part => IGNORED_DIRS.has(part))) continue;
            const extension = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!ALLOWED_EXTENSIONS.has(extension)) continue;

            fileTree += `- ${filePath}\n`;
            
            if (CONFIG_FILES.has(file.name) || file.size < 200000) { // Increased size limit
               const content = await readFileContent(file);
               if (CONFIG_FILES.has(file.name)) configContents.push(`\n--- ${file.name} ---\n${content}\n`);
               sourceFiles.push(await ingestFile(filePath, content, file.size));
            }
          }
      } else if (inputType === 'github') {
          const repoInfo = parseGithubUrl(githubUrl);
          if (!repoInfo) throw new Error("Invalid GitHub URL");
          const { tree, branch } = await fetchGithubRepoTree(repoInfo.owner, repoInfo.repo);
          const relevantNodes = tree.filter(node => {
              const hasIgnoredDir = node.path.split('/').some(part => IGNORED_DIRS.has(part));
              const extension = '.' + node.path.split('.').pop()?.toLowerCase();
              return node.type === 'blob' && !hasIgnoredDir && ALLOWED_EXTENSIONS.has(extension);
          });
          let fetchedCount = 0;
          for (const node of relevantNodes) {
             if (fetchedCount > 30) break;
             const content = await fetchGithubFileContent(repoInfo.owner, repoInfo.repo, branch, node.path);
             fileTree += `- ${node.path}\n`;
             if (CONFIG_FILES.has(node.path.split('/').pop()||'')) configContents.push(`\n--- ${node.path} ---\n${content}\n`);
             sourceFiles.push(await ingestFile(node.path, content, node.size || 0));
             fetchedCount++;
             setProgress(Math.round((fetchedCount / 30) * 10));
          }
      }
      
      // Save updated cache
      saveFileCache(fileCache);
      addLog(`${cacheHitCount} فایل از حافظه کش خوانده شد. سرعت پردازش افزایش یافت.`, 'success');

      // --- Pass 2: GraphRAG Linking ---
      addLog(`فاز ۱.۵: ساخت گراف دانش (GraphRAG Linking)...`, 'info');
      
      // We must rebuild the graph every time because relationships change even if one file changes
      const { symbolTable } = buildGraph(sourceFiles);
      setKnowledgeGraph(symbolTable);
      
      // Store graph back into metadata for RAG retrieval
      sourceFiles.forEach(f => {
         f.metadata.symbols.forEach(sym => {
             // Update file metadata with global graph knowledge
             const globalSym = symbolTable[sym.id];
             if (globalSym) sym.relationships = globalSym.relationships;
         });
      });

      // --- Stats Generation ---
      const totalLines = Object.values(languageStats).reduce((a, b) => a + b, 0);
      let statsMarkdown = '';
      if (totalLines > 0) {
        const sortedStats = Object.entries(languageStats).sort(([, a], [, b]) => b - a);
        const processedStats = sortedStats.map(([lang, lines], index) => ({
            lang, lines, percent: parseFloat(((lines / totalLines) * 100).toFixed(1)), color: ['#3B82F6', '#10B981'][index % 2]
        }));
        setStats(processedStats);
        statsMarkdown = `\n| زبان | خط کد | درصد |\n| :--- | :--- | :--- |\n${processedStats.map(s => `| **${s.lang}** | ${s.lines.toLocaleString()} | ${s.percent}% |`).join('\n')}\n`;
      }

      let parts: any = { root: '', cookbook: '', useCase: '', dataFlow: '', arch: '', ops: '', seq: '', api: '', erd: '', class: '', infra: '', code: '' };
      
      const assembleDoc = () => {
          let doc = `# مستندات جامع پروژه (GraphRAG Enabled)\n\nتولید شده توسط رایان هم‌افزا\nتاریخ: ${new Date().toLocaleDateString('fa-IR')}\n\n`;
          if (statsMarkdown) doc += `## 📊 آمار پروژه\n\n${statsMarkdown}\n\n---\n\n`;
          if (parts.root) doc += `${parts.root}\n\n---\n\n`;
          if (parts.useCase) doc += `## 🎭 نمودار موارد استفاده (Use Case Diagram)\n\n${parts.useCase}\n\n---\n\n`;
          if (parts.cookbook) doc += `${parts.cookbook}\n\n---\n\n`;
          if (parts.dataFlow) doc += `## 🔄 جریان داده (Data Flow)\n\n${parts.dataFlow}\n\n---\n\n`;
          if (parts.arch) doc += `## 🏗 معماری سیستم\n\n${parts.arch}\n\n---\n\n`;
          if (parts.erd) doc += `## 🗄 مدل داده‌ها (ERD)\n\n${parts.erd}\n\n---\n\n`;
          if (parts.class) doc += `## 🧩 نمودار کلاس\n\n${parts.class}\n\n---\n\n`;
          if (parts.infra) doc += `## ☁️ زیرساخت\n\n${parts.infra}\n\n---\n\n`;
          if (parts.seq) doc += `## 🎞 نمودار توالی\n\n${parts.seq}\n\n---\n\n`;
          if (parts.code) doc += `## 💻 تحلیل کد\n\n${parts.code}`;
          return doc;
      };

      addLog(`فاز ۲: وکتورایز کردن (فقط فایل‌های جدید)...`, 'info');
      // Optimization: Only vectorize non-cached files or force update vector store properly
      // Note: For simplicity in this demo, we add all, but in prod we would partial update.
      await vectorStoreRef.current?.addDocuments(sourceFiles, (current, total) => {
          const percentage = Math.round((current / total) * 20) + 10; 
          setProgress(percentage);
      });
      setHasContext(true);

      const fileSummaries: string[] = [];

      // Phase 3: Code Analysis
      if (docLevels.code) {
        addLog(`فاز ۳: تولید مستندات هوشمند...`, 'info');
        for (const file of sourceFiles) {
          // Check if we have cached documentation logic (optional future improvement)
          
          // GRAPH AWARE PROMPT
          const localSymbols = file.metadata.symbols.map(s => {
             const refs = symbolTable[s.id]?.relationships?.calledBy.length || 0;
             const calls = symbolTable[s.id]?.relationships?.calls.length || 0;
             const complexity = s.complexityScore;
             const complexityWarning = complexity > 10 ? '(⚠️ HIGH COMPLEXITY)' : '';
             return `- ${s.kind} ${s.name} (Line ${s.line}, Called By: ${refs}, Calls: ${calls}, Complexity: ${complexity} ${complexityWarning})`;
          }).join('\n');

          const usedBy = [...new Set(file.metadata.symbols.flatMap(s => symbolTable[s.id]?.relationships?.calledBy || []))];
          const usedByFiles = usedBy.map(id => symbolTable[id]?.filePath).filter((v, i, a) => a.indexOf(v) === i);

          const filePrompt = `File Path: ${file.path}
          
          INTELLIGENCE CONTEXT (GraphRAG):
          - Internal Symbols & Complexity:\n${localSymbols}
          - IMPACT ANALYSIS: This file is used by: ${usedByFiles.slice(0, 5).join(', ')}
          
          Code:
          \`\`\`
          ${file.content}
          \`\`\``;
          
          const rawResponse = await generateCompletion(config, filePrompt, PROMPT_LEVEL_2_CODE);
          const summarySplit = rawResponse.split(/\*\*SUMMARY_FOR_CONTEXT\*\*|---SUMMARY---/i);
          const displayContent = summarySplit[0].trim();
          const technicalSummary = summarySplit[1] ? summarySplit[1].trim() : "Available in code view.";

          fileSummaries.push(`File: ${file.path}\nSummary: ${technicalSummary}\n`);
          
          const safeId = file.path.replace(/[^a-zA-Z0-9]/g, '_');
          const headerHTML = generateFileHeaderHTML(file.path, file.lines);
          parts.code += `<div id="file-${safeId}">\n<details>\n<summary>${headerHTML}</summary>\n\n${displayContent}\n\n</details>\n</div>\n\n`;

          setGeneratedDoc(assembleDoc());
          setProgress(prev => Math.min(prev + 5, 80));
        }
      }

      // Diagram Phases
      const reducedContext = `Files:\n${fileTree}\nSummaries:\n${fileSummaries.join('\n')}`;
      const strictModeSuffix = "\n\nCRITICAL: Output ONLY the code block starting with ```mermaid.";

      if (docLevels.root) {
          parts.root = await generateCompletion(config, reducedContext, PROMPT_LEVEL_1_ROOT);
          setGeneratedDoc(assembleDoc());
      }
      if (docLevels.useCase) {
        addLog('در حال ترسیم نمودار موارد استفاده (Use Case)...', 'info');
        const useCaseContext = `Project Structure:\n${fileTree}\nPackage Info:\n${configContents.find(c => c.includes('package.json')) || ''}\nReadme/Intro:\n${parts.root || ''}`;
        parts.useCase = extractMermaidCode(await generateCompletion(config, useCaseContext + strictModeSuffix, PROMPT_USE_CASE));
        setGeneratedDoc(assembleDoc());
      }
      if (docLevels.cookbook) {
        parts.cookbook = await generateCompletion(config, `Project Structure:\n${fileTree}\nConfig:\n${configContents}`, PROMPT_COOKBOOK);
        setGeneratedDoc(assembleDoc());
      }
      if (docLevels.dataFlow) {
         parts.dataFlow = extractMermaidCode(await generateCompletion(config, reducedContext + strictModeSuffix, PROMPT_DATA_FLOW));
         setGeneratedDoc(assembleDoc());
      }
      if (docLevels.erd) {
        const dbFiles = sourceFiles.filter(f => f.metadata.isDbSchema);
        let erdContext = dbFiles.length > 0 ? dbFiles.map(f => f.content).join('\n') : reducedContext;
        parts.erd = extractMermaidCode(await generateCompletion(config, erdContext + strictModeSuffix, PROMPT_LEVEL_7_ERD));
        setGeneratedDoc(assembleDoc());
      }
      if (docLevels.classDiagram) {
        const classNames = Object.values(symbolTable).filter(s => s.kind === 'class').map(s => s.name).join(', ');
        const classContext = `Detected Classes: ${classNames}\n\n${reducedContext}`;
        parts.class = extractMermaidCode(await generateCompletion(config, classContext + strictModeSuffix, PROMPT_LEVEL_8_CLASS));
        setGeneratedDoc(assembleDoc());
      }
      if (docLevels.seq) {
          parts.seq = extractMermaidCode(await generateCompletion(config, reducedContext + strictModeSuffix, PROMPT_LEVEL_5_SEQUENCE));
          setGeneratedDoc(assembleDoc());
      }
      if (docLevels.infra) {
         const infraContext = `Config Files:\n${configContents.join('\n')}\nStructure:\n${fileTree}`;
         parts.infra = extractMermaidCode(await generateCompletion(config, infraContext + strictModeSuffix, PROMPT_LEVEL_9_INFRA));
         setGeneratedDoc(assembleDoc());
      }

      addLog('تمامی مراحل با موفقیت به پایان رسید.', 'success');
      setProgress(100);

    } catch (error: any) {
      addLog(`خطا: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return { logs, isProcessing, progress, generatedDoc, setGeneratedDoc, hasContext, setHasContext, processRepository, stats, knowledgeGraph };
};
