
import { useState, useEffect } from 'react';
import { OllamaConfig, ProcessingLog, ProcessedFile, CodeSymbol, RepoSummary, RepoIntelSnapshot } from '../types';
import { IGNORED_DIRS, ALLOWED_EXTENSIONS, CONFIG_FILES, LANGUAGE_MAP, PROMPT_LEVEL_1_ROOT, PROMPT_LEVEL_2_CODE, PROMPT_LEVEL_3_ARCH, PROMPT_LEVEL_5_SEQUENCE, PROMPT_LEVEL_7_ERD, PROMPT_LEVEL_8_CLASS, PROMPT_LEVEL_9_INFRA, PROMPT_LEVEL_10_USE_CASE } from '../utils/constants';
import { checkOllamaConnection, checkEmbeddingModelAvailable, generateCompletion } from '../services/ollamaService';
import { extractFileMetadata, resolveReferences } from '../services/codeParser';
import { LocalVectorStore } from '../services/vectorStore';
import { parseGithubUrl, fetchGithubRepoTree, fetchGithubFileContent, fetchGithubCommits, fetchGithubCommitFiles } from '../services/githubService';
import { generateFileHeaderHTML, extractMermaidCode, normalizeUseCaseDiagram, buildDependencyMermaid } from '../utils/markdownHelpers';
import { buildRunbookMarkdown } from '../utils/runbook';
import { analyzeDocQuality } from '../utils/docQuality';
import { buildApiCallInsights } from '../utils/apiCallInsights';
import { detectRepoSummary } from '../utils/repoDetection';
import { buildRepoInsights } from '../utils/repoDocumentation';

interface UseRepoProcessorProps {
  config: OllamaConfig;
  inputType: 'local' | 'github';
  files: FileList | null;
  githubUrl: string;
  docLevels: any;
  vectorStoreRef: React.MutableRefObject<LocalVectorStore | null>;
}

const STORAGE_KEY = 'rayan_docs_session';

export const useRepoProcessor = () => {
  // --- State ---
  const [logs, setLogs] = useState<ProcessingLog[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).logs || [] : [];
    } catch (e) { return []; }
  });

  const [generatedDoc, setGeneratedDoc] = useState<string>(() => {
    if (typeof window === 'undefined') return '';
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).generatedDoc || '' : '';
    } catch (e) { return ''; }
  });

  const [stats, setStats] = useState<{ lang: string; lines: number; percent: number; color: string }[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).stats || [] : [];
    } catch (e) { return []; }
  });

  const [repoSummary, setRepoSummary] = useState<RepoSummary | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).repoSummary || null : null;
    } catch (e) { return null; }
  });

  const [repoIntel, setRepoIntel] = useState<RepoIntelSnapshot | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? JSON.parse(saved).repoIntel || null : null;
    } catch (e) { return null; }
  });
  
  // Updated: Store Full Symbol Table
  const [knowledgeGraph, setKnowledgeGraph] = useState<Record<string, CodeSymbol>>(() => {
     if (typeof window === 'undefined') return {};
     try {
       const saved = localStorage.getItem(STORAGE_KEY);
       return saved ? JSON.parse(saved).knowledgeGraph || {} : {};
     } catch (e) { return {}; }
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasContext, setHasContext] = useState(false);

  // --- Persistence Effect ---
  useEffect(() => {
    if (isProcessing) return;
    try {
      const sessionData = {
        logs,
        generatedDoc,
        stats,
        repoSummary,
        repoIntel,
        knowledgeGraph,
        lastUpdated: new Date().toISOString()
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessionData));
    } catch (e) {
      console.warn('Failed to save session to localStorage:', e);
    }
  }, [logs, generatedDoc, stats, repoSummary, repoIntel, knowledgeGraph, isProcessing]);


  const addLog = (message: string, type: ProcessingLog['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString('fa-IR'), message, type }]);
  };

  const processRepository = async ({ config, inputType, files, githubUrl, docLevels, vectorStoreRef }: UseRepoProcessorProps) => {
    setIsProcessing(true);
    setProgress(0);
    setGeneratedDoc('');
    setLogs([]);
    setStats([]);
    setRepoSummary(null);
    setRepoIntel(null);
    setKnowledgeGraph({});
    setHasContext(false);
    
    localStorage.removeItem(STORAGE_KEY);
    vectorStoreRef.current = new LocalVectorStore(config);

    try {
      addLog('در حال بررسی اتصال به Ollama...', 'info');
      const isConnected = await checkOllamaConnection(config);
      if (!isConnected) throw new Error(`اتصال به Ollama در آدرس ${config.baseUrl} برقرار نشد.`);
      addLog('اتصال به Ollama برقرار شد.', 'success');

      const embeddingsAvailable = await checkEmbeddingModelAvailable(config);
      if (!embeddingsAvailable) {
        addLog('مدل embedding در Ollama یافت نشد؛ RAG فقط با جستجوی کلیدواژه ادامه می‌یابد.', 'warning');
      }
      vectorStoreRef.current = new LocalVectorStore(config, embeddingsAvailable);

      let fileTree = '';
      const configContents: string[] = [];
      const configFileContents: Record<string, string> = {};
      const sourceFiles: ProcessedFile[] = [];
      const languageStats: Record<string, number> = {};
      let repoName = '';
      let detectedSummary: RepoSummary | null = null;
      let repoIntelSnapshot: RepoIntelSnapshot | null = null;

      addLog('فاز ۱: اسکن لغوی و توکن‌بندی فایل‌ها (Lexical Analysis)...', 'info');

      // Helper to process a single file content
      const ingestFile = (path: string, content: string, size: number) => {
           const lines = content.split(/\r\n|\r|\n/).length;
           const extension = '.' + path.split('.').pop()?.toLowerCase();
           const langName = LANGUAGE_MAP[extension || ''] || 'Other';
           
           if (langName !== 'Other') languageStats[langName] = (languageStats[langName] || 0) + lines;
           
           // Pass 1: Parse Definitions (Local)
           const metadata = extractFileMetadata(content, path);
           return { path, content, size, lines, metadata };
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
            if (!repoName && filePath.includes('/')) {
              repoName = filePath.split('/')[0];
            }
            const pathParts = filePath.split('/');
            if (pathParts.some(part => IGNORED_DIRS.has(part))) continue;
            const extension = '.' + file.name.split('.').pop()?.toLowerCase();
            if (!ALLOWED_EXTENSIONS.has(extension)) continue;

            fileTree += `- ${filePath}\n`;
            
            if (CONFIG_FILES.has(file.name) || file.size < 100000) {
               const content = await readFileContent(file);
               if (CONFIG_FILES.has(file.name)) {
                 configContents.push(`\n--- ${file.name} ---\n${content}\n`);
                 configFileContents[file.name] = content;
               }
               sourceFiles.push(ingestFile(filePath, content, file.size));
            }
          }
      } else if (inputType === 'github') {
          // Github logic omitted for brevity (same structure as original, calling ingestFile)
          const repoInfo = parseGithubUrl(githubUrl);
          if (!repoInfo) throw new Error("Invalid GitHub URL");
          repoName = repoInfo.repo;
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
             if (CONFIG_FILES.has(node.path.split('/').pop()||'')) {
               const configFileName = node.path.split('/').pop() || '';
               configContents.push(`\n--- ${node.path} ---\n${content}\n`);
               if (configFileName) configFileContents[configFileName] = content;
             }
             sourceFiles.push(ingestFile(node.path, content, node.size || 0));
             fetchedCount++;
             setProgress(Math.round((fetchedCount / 30) * 10));
          }

          try {
            const commits = await fetchGithubCommits(repoInfo.owner, repoInfo.repo, 15);
            const hotspots: Record<string, number> = {};
            const committerCounts: Record<string, number> = {};
            for (const commit of commits.slice(0, 6)) {
              committerCounts[commit.author] = (committerCounts[commit.author] || 0) + 1;
              const files = await fetchGithubCommitFiles(repoInfo.owner, repoInfo.repo, commit.sha);
              files.forEach(file => {
                hotspots[file.filename] = (hotspots[file.filename] || 0) + 1;
              });
            }
            const topCommitters = Object.entries(committerCounts)
              .map(([name, commitsCount]) => ({ name, commits: commitsCount }))
              .sort((a, b) => b.commits - a.commits)
              .slice(0, 5);
            const hotspotList = Object.entries(hotspots)
              .map(([path, changes]) => ({ path, changes }))
              .sort((a, b) => b.changes - a.changes)
              .slice(0, 8);
            repoIntelSnapshot = {
              commitCount: commits.length,
              latestCommitDate: commits[0]?.date,
              topCommitters,
              hotspots: hotspotList
            };
            setRepoIntel(repoIntelSnapshot);
          } catch (error) {
            console.warn('Repo intelligence fetch failed:', error);
          }
      }

      if (!repoName && inputType === 'local') {
        repoName = 'پروژه محلی';
      }

      if (sourceFiles.length > 0) {
        detectedSummary = detectRepoSummary(sourceFiles, configFileContents, repoName);
        setRepoSummary(detectedSummary);
      }

      // --- Pass 2: Cross-Reference Linking ---
      addLog(`فاز ۱.۵: تحلیل وابستگی‌ها و لینک‌دهی مراجع (${sourceFiles.length} فایل)...`, 'info');
      
      const { symbolTable, nameIndex } = resolveReferences(sourceFiles);
      setKnowledgeGraph(symbolTable); // This is the "CodeWiki" brain
      
      // Update metadata in sourceFiles with resolved references for context
      // (Optional optimization: write back to sourceFiles if needed for RAG)

      // --- Stats Generation ---
      const totalLines = Object.values(languageStats).reduce((a, b) => a + b, 0);
      let statsMarkdown = '';
      let repoIntelMarkdown = '';
      let repoInsightsMarkdown = '';
      let readerSummary = '';
      const processedStats: { lang: string; lines: number; percent: number; color: string }[] = [];
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6'];
      if (totalLines > 0) {
        const sortedStats = Object.entries(languageStats).sort(([, a], [, b]) => b - a);
        sortedStats.forEach(([lang, lines], index) => {
            const percent = parseFloat(((lines / totalLines) * 100).toFixed(1));
            processedStats.push({ lang, lines, percent, color: colors[index % colors.length] });
        });
        setStats(processedStats);
        statsMarkdown = `\n| زبان / تکنولوژی | تعداد خط کد (LOC) | درصد پروژه |\n| :--- | :--- | :--- |\n${processedStats.map(s => `| **${s.lang}** | ${s.lines.toLocaleString()} خط | ${s.percent}% |`).join('\n')}\n`;
        ({ readerSummary, insightsMarkdown: repoInsightsMarkdown } = buildRepoInsights(detectedSummary, {
          topLanguage: processedStats[0]?.lang,
          filePaths: sourceFiles.map(file => file.path),
          configContents: configFileContents
        }));
      }
      if (!repoInsightsMarkdown) {
        ({ readerSummary, insightsMarkdown: repoInsightsMarkdown } = buildRepoInsights(detectedSummary, {
          filePaths: sourceFiles.map(file => file.path),
          configContents: configFileContents
        }));
      }

      if (repoIntelSnapshot) {
        const hotspotLines = repoIntelSnapshot.hotspots.length
          ? repoIntelSnapshot.hotspots.map(hotspot => `- ${hotspot.path} (${hotspot.changes} تغییر)`).join('\n')
          : '- داده‌ای یافت نشد';
        const committerLines = repoIntelSnapshot.topCommitters.length
          ? repoIntelSnapshot.topCommitters.map(committer => `- ${committer.name} (${committer.commits} commit)`).join('\n')
          : '- داده‌ای یافت نشد';
        repoIntelMarkdown = [
          '## 🧠 هوشمندی مخزن (Repository Intelligence)',
          `- تعداد commitهای بررسی‌شده: ${repoIntelSnapshot.commitCount}`,
          repoIntelSnapshot.latestCommitDate ? `- آخرین commit: ${new Date(repoIntelSnapshot.latestCommitDate).toLocaleString('fa-IR')}` : '- آخرین commit: نامشخص',
          '',
          '### 🔥 نقاط پرچرخش (Hotspots)',
          hotspotLines,
          '',
          '### 👥 مالکیت فایل‌ها (Ownership)',
          committerLines
        ].join('\n');
      } else {
        repoIntelMarkdown = [
          '## 🧠 هوشمندی مخزن (Repository Intelligence)',
          '- تاریخچه تغییرات برای این ورودی در دسترس نیست.',
          '- برای دریافت داده‌های commit/history از مخزن GitHub استفاده کنید.'
        ].join('\n');
      }

      // --- Documentation Generation Pipeline ---
      let parts: any = { root: '', arch: '', ops: '', seq: '', api: '', erd: '', class: '', infra: '', useCase: '', code: '' };
      const runbookMarkdown = buildRunbookMarkdown(sourceFiles.map(file => file.path), configFileContents);
      const apiCallMarkdown = buildApiCallInsights(sourceFiles);
      let qualityMarkdown = '';
      const dependencyEdges: [string, string][] = [];
      sourceFiles.forEach(file => {
        file.metadata.dependencies.forEach(dep => {
          dependencyEdges.push([file.path, dep]);
        });
      });
      const dependencyMermaid = buildDependencyMermaid(dependencyEdges.slice(0, 60));
      const assembleDoc = () => {
          let doc = `# مستندات جامع پروژه (CodeWiki)\n\nتولید شده توسط دستیار هوشمند رایان هم‌افزا\nمدل: ${config.model}\nتاریخ: ${new Date().toLocaleDateString('fa-IR')}\n\n`;
          if (readerSummary) {
            doc += `## ✨ خلاصه خواننده‌محور\n\n${readerSummary}\n\n---\n\n`;
          }
          if (statsMarkdown) doc += `## 📊 DNA پروژه\n\n${statsMarkdown}\n\n---\n\n`;
          if (repoIntelMarkdown) doc += `${repoIntelMarkdown}\n\n---\n\n`;
          if (repoInsightsMarkdown) doc += `${repoInsightsMarkdown}\n\n---\n\n`;
          if (dependencyMermaid) doc += `## 🧩 گراف وابستگی‌ها (Dependency Graph)\n\n${dependencyMermaid}\n\n---\n\n`;
          if (runbookMarkdown) doc += `${runbookMarkdown}\n\n---\n\n`;
          if (apiCallMarkdown) doc += `${apiCallMarkdown}\n\n---\n\n`;
          if (qualityMarkdown) doc += `${qualityMarkdown}\n\n---\n\n`;
          if (parts.root) doc += `${parts.root}\n\n---\n\n`;
          if (parts.arch) doc += `## 🏗 معماری سیستم\n\n${parts.arch}\n\n---\n\n`;
          if (parts.erd) doc += `## 🗄 مدل داده‌ها (ERD)\n\n${parts.erd}\n\n---\n\n`;
          if (parts.class) doc += `## 🧩 نمودار کلاس (Class Diagram)\n\n${parts.class}\n\n---\n\n`;
          if (parts.infra) doc += `## ☁️ زیرساخت و معماری کلان (Infrastructure Diagram)\n\n${parts.infra}\n\n---\n\n`;
          if (parts.seq) doc += `## 🔄 نمودار توالی سناریوی اصلی (Sequence Diagram)\n\n${parts.seq}\n\n---\n\n`;
          if (parts.useCase) doc += `## 🎯 نمودار Use Case (Frontend)\n\n${parts.useCase}\n\n---\n\n`;
          if (parts.code) doc += `## 💻 مستندات کدها\n\n${parts.code}`;
          return doc;
      };

      addLog(`فاز ۲: ایندکس کردن ترکیبی (Hybrid Search Indexing)...`, 'info');
      await vectorStoreRef.current?.addDocuments(sourceFiles, (current, total) => {
          const percentage = Math.round((current / total) * 20) + 10; 
          setProgress(percentage);
      });
      setHasContext(true);

      const fileSummaries: string[] = [];

      // Phase 3: Code Analysis with Deep Context
      if (docLevels.code) {
        addLog(`فاز ۳: تولید مستندات هوشمند...`, 'info');
        for (const file of sourceFiles) {
          // Provide Symbol Context to LLM
          const localSymbols = file.metadata.symbols.map(s => {
             const refs = symbolTable[s.id]?.references?.length || 0;
             return `- ${s.kind} ${s.name} (Line ${s.line}, Used ${refs} times)`;
          }).join('\n');
          
          const filePrompt = `File Path: ${file.path}\n\nSTRUCTURE & SYMBOLS:\n${localSymbols}\n\nCode Content:\n\`\`\`\n${file.content}\n\`\`\``;
          const rawResponse = await generateCompletion(config, filePrompt, PROMPT_LEVEL_2_CODE);
          
          const summarySplit = rawResponse.split(/\*\*SUMMARY_FOR_CONTEXT\*\*|---SUMMARY---/i);
          const displayContent = summarySplit[0].trim();
          const technicalSummary = summarySplit[1] ? summarySplit[1].trim() : "Available in code view.";

          fileSummaries.push(`File: ${file.path}\nSummary: ${technicalSummary}\n`);
          
          // Generate ID for scrolling
          const safeId = file.path.replace(/[^a-zA-Z0-9]/g, '_');
          const headerHTML = generateFileHeaderHTML(file.path, file.lines);
          
          // Wrap in a div with ID for navigation
          parts.code += `<div id="file-${safeId}">\n<details>\n<summary>${headerHTML}</summary>\n\n${displayContent}\n\n</details>\n</div>\n\n`;

          setGeneratedDoc(assembleDoc());
          setProgress(prev => Math.min(prev + 5, 80));
        }
      }

      // Generation of Diagram Phases (Arch, ERD, Sequence, Infra)
      const reducedContext = `Files:\n${fileTree}\nSummaries:\n${fileSummaries.join('\n')}`;
      const strictModeSuffix = "\n\nCRITICAL INSTRUCTION: DO NOT generate a summary. Output ONLY the code block starting with ```mermaid.";

      if (docLevels.root) {
          parts.root = await generateCompletion(config, reducedContext, PROMPT_LEVEL_1_ROOT);
          setGeneratedDoc(assembleDoc());
      }
      if (docLevels.erd) {
        const dbFiles = sourceFiles.filter(f => f.metadata.isDbSchema);
        let erdContext = dbFiles.length > 0 ? dbFiles.map(f => f.content).join('\n') : reducedContext;
        parts.erd = extractMermaidCode(await generateCompletion(config, erdContext + strictModeSuffix, PROMPT_LEVEL_7_ERD));
        setGeneratedDoc(assembleDoc());
      }
      if (docLevels.classDiagram) {
        // Use high-level class definitions for better diagram
        const classNames = Object.values(symbolTable).filter(s => s.kind === 'class').map(s => s.name).join(', ');
        const classContext = `Detected Classes: ${classNames}\n\n${reducedContext}`;
        parts.class = extractMermaidCode(await generateCompletion(config, classContext + strictModeSuffix, PROMPT_LEVEL_8_CLASS));
        setGeneratedDoc(assembleDoc());
      }
      if (docLevels.sequence) {
         parts.seq = extractMermaidCode(await generateCompletion(config, reducedContext + strictModeSuffix, PROMPT_LEVEL_5_SEQUENCE));
         setGeneratedDoc(assembleDoc());
      }
      if (docLevels.infra) {
         const infraContext = `Config Files Content:\n${configContents.join('\n')}\n\nProject Structure:\n${fileTree}`;
         parts.infra = extractMermaidCode(await generateCompletion(config, infraContext + strictModeSuffix, PROMPT_LEVEL_9_INFRA));
         setGeneratedDoc(assembleDoc());
      }
      if (detectedSummary?.type === 'frontend') {
         const useCaseContext = `Project Structure:\n${fileTree}\n\nSummaries:\n${fileSummaries.join('\n')}`;
         const rawUseCase = await generateCompletion(config, useCaseContext + strictModeSuffix, PROMPT_LEVEL_10_USE_CASE);
         parts.useCase = normalizeUseCaseDiagram(extractMermaidCode(rawUseCase));
         setGeneratedDoc(assembleDoc());
      }

      const finalDoc = assembleDoc();
      const quality = analyzeDocQuality(finalDoc);
      const qualityLines = quality.warnings.length
        ? quality.warnings.map(warning => `- ${warning}`).join('\n')
        : '- موردی یافت نشد.';
      qualityMarkdown = [
        '## ✅ کنترل کیفیت مستندات',
        `- تعداد سرفصل‌ها: ${quality.headingCount}`,
        `- تعداد موارد TODO/FIXME: ${quality.todoCount}`,
        '',
        '### هشدارها',
        qualityLines
      ].join('\n');
      setGeneratedDoc(assembleDoc());

      addLog('تمامی مراحل با موفقیت به پایان رسید.', 'success');
      setProgress(100);

    } catch (error: any) {
      addLog(`خطا: ${error.message}`, 'error');
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return { logs, isProcessing, progress, generatedDoc, setGeneratedDoc, hasContext, setHasContext, processRepository, stats, repoSummary, knowledgeGraph };
};
