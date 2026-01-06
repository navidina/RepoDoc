

import { useState } from 'react';
import { OllamaConfig, ProcessingLog, ProcessedFile } from '../types';
import { IGNORED_DIRS, ALLOWED_EXTENSIONS, CONFIG_FILES, LANGUAGE_MAP, PROMPT_LEVEL_1_ROOT, PROMPT_LEVEL_2_CODE, PROMPT_LEVEL_3_ARCH, PROMPT_LEVEL_4_OPS, PROMPT_LEVEL_5_SEQUENCE, PROMPT_LEVEL_6_API, PROMPT_LEVEL_7_ERD, PROMPT_LEVEL_8_CLASS, PROMPT_LEVEL_9_INFRA } from '../utils/constants';
import { checkOllamaConnection, generateCompletion } from '../services/ollamaService';
import { extractFileMetadata } from '../services/codeParser';
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

export const useRepoProcessor = () => {
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [hasContext, setHasContext] = useState(false);
  // New state to hold raw stats for UI rendering
  const [stats, setStats] = useState<{ lang: string; lines: number; percent: number; color: string }[]>([]);

  const addLog = (message: string, type: ProcessingLog['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString('fa-IR'), message, type }]);
  };

  const processRepository = async ({ config, inputType, files, githubUrl, docLevels, vectorStoreRef }: UseRepoProcessorProps) => {
    setIsProcessing(true);
    setProgress(0);
    setGeneratedDoc('');
    setLogs([]);
    setStats([]);
    setHasContext(false);
    vectorStoreRef.current = new LocalVectorStore(config);

    try {
      addLog('در حال بررسی اتصال به Ollama...', 'info');
      const isConnected = await checkOllamaConnection(config);
      if (!isConnected) {
        throw new Error(`اتصال به Ollama در آدرس ${config.baseUrl} برقرار نشد.`);
      }
      addLog('اتصال به Ollama برقرار شد.', 'success');

      let fileTree = '';
      const configContents: string[] = [];
      const sourceFiles: ProcessedFile[] = [];
      const languageStats: Record<string, number> = {};

      addLog('فاز ۱: اسکن فایل‌ها و استخراج متادیتا (Static Analysis)...', 'info');

      // --- File Fetching Logic ---
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
            const hasIgnoredDir = pathParts.some(part => IGNORED_DIRS.has(part));
            const extension = '.' + file.name.split('.').pop()?.toLowerCase();
            
            if (hasIgnoredDir || !ALLOWED_EXTENSIONS.has(extension)) continue;
            
            fileTree += `- ${filePath}\n`;
            
            // Check if config or valid source file
            const isConfig = CONFIG_FILES.has(file.name);
            const isSmallEnough = file.size < 100000; // Increase limit slightly

            if (isConfig || isSmallEnough) {
               const content = await readFileContent(file);
               
               // Calculate LOC (Lines of Code)
               const lines = content.split(/\r\n|\r|\n/).length;
               
               const langName = LANGUAGE_MAP[extension || ''] || 'Other';
               if (langName !== 'Other') {
                   languageStats[langName] = (languageStats[langName] || 0) + lines;
               }

               if (isConfig) {
                  configContents.push(`\n--- ${file.name} ---\n${content}\n`);
                  addLog(`فایل کانفیگ پیدا شد: ${file.name}`, 'success');
               }
               
               // Add to processing list
               const metadata = extractFileMetadata(content, filePath);
               sourceFiles.push({ path: filePath, content, size: file.size, lines, metadata });
            }
          }
      } else if (inputType === 'github') {
          const repoInfo = parseGithubUrl(githubUrl);
          if (!repoInfo) throw new Error("آدرس گیت‌هاب نامعتبر است.");
          addLog(`در حال دریافت لیست فایل‌ها از ${repoInfo.owner}/${repoInfo.repo}...`, 'info');
          const { tree, branch } = await fetchGithubRepoTree(repoInfo.owner, repoInfo.repo);
          let fetchedCount = 0;
          const maxFetch = 40;
          const relevantNodes = tree.filter(node => {
              const hasIgnoredDir = node.path.split('/').some(part => IGNORED_DIRS.has(part));
              const extension = '.' + node.path.split('.').pop()?.toLowerCase();
              return node.type === 'blob' && !hasIgnoredDir && ALLOWED_EXTENSIONS.has(extension);
          });
          addLog(`تعداد ${relevantNodes.length} فایل مرتبط پیدا شد. دانلود محتوا (محدود به ${maxFetch} فایل مهم)...`, 'info');

          for (const node of relevantNodes) {
             const filename = node.path.split('/').pop() || '';
             const extension = '.' + filename.split('.').pop()?.toLowerCase();
             const isConfig = CONFIG_FILES.has(filename);
             
             fileTree += `- ${node.path}\n`;
             
             if (isConfig || fetchedCount < maxFetch) {
                 const content = await fetchGithubFileContent(repoInfo.owner, repoInfo.repo, branch, node.path);
                 fetchedCount++;
                 
                 // Calculate LOC
                 const lines = content.split(/\r\n|\r|\n/).length;
                 const langName = LANGUAGE_MAP[extension || ''] || 'Other';
                 if (langName !== 'Other') {
                    languageStats[langName] = (languageStats[langName] || 0) + lines;
                 }

                 if (isConfig) {
                     configContents.push(`\n--- ${filename} ---\n${content}\n`);
                     addLog(`فایل کانفیگ دریافت شد: ${filename}`, 'success');
                 }
                 
                 const metadata = extractFileMetadata(content, node.path);
                 sourceFiles.push({ path: node.path, content, size: node.size || 0, lines, metadata });
                 
                 if (fetchedCount % 5 === 0) setProgress(Math.round((fetchedCount / maxFetch) * 10));
             }
          }
      }

      // Generate Stats Logic
      const totalLines = Object.values(languageStats).reduce((a, b) => a + b, 0);
      let statsMarkdown = '';
      const processedStats: { lang: string; lines: number; percent: number; color: string }[] = [];
      
      const colors = ['#3B82F6', '#10B981', '#F59E0B', '#6366F1', '#EC4899', '#8B5CF6', '#14B8A6'];

      if (totalLines > 0) {
        const sortedStats = Object.entries(languageStats).sort(([, a], [, b]) => b - a);
        
        sortedStats.forEach(([lang, lines], index) => {
            const percent = parseFloat(((lines / totalLines) * 100).toFixed(1));
            processedStats.push({
                lang,
                lines,
                percent,
                color: colors[index % colors.length]
            });
        });

        // Set state for UI rendering
        setStats(processedStats);
        
        // Markdown representation (Fallback for the file itself)
        statsMarkdown = `\n| زبان / تکنولوژی | تعداد خط کد (LOC) | درصد پروژه |\n| :--- | :--- | :--- |\n${processedStats.map(s => `| **${s.lang}** | ${s.lines.toLocaleString()} خط | ${s.percent}% |`).join('\n')}\n`;
      }

      const indexingWeight = 20; 
      let totalSteps = 0;
      if (docLevels.code) totalSteps += sourceFiles.length; 
      if (docLevels.arch) totalSteps += 1; 
      if (docLevels.sequence) totalSteps += 1; 
      if (docLevels.ops) totalSteps += 1; 
      if (docLevels.api) totalSteps += 1; 
      if (docLevels.root) totalSteps += 1;
      if (docLevels.erd) totalSteps += 1;
      if (docLevels.classDiagram) totalSteps += 1;
      if (docLevels.infra) totalSteps += 1;
      
      let completedSteps = 0;
      const updateProgress = (extra: number = 0) => {
        const total = totalSteps > 0 ? totalSteps : 1;
        const analysisProgress = Math.min(Math.round((completedSteps / total) * 80), 80); 
        setProgress(analysisProgress + extra);
      };

      let parts: any = { root: '', arch: '', ops: '', seq: '', api: '', erd: '', class: '', infra: '', code: '' };

      const assembleDoc = () => {
          let doc = `# مستندات جامع پروژه\n\nتولید شده توسط RepoDocs AI\nمدل: ${config.model}\nتاریخ: ${new Date().toLocaleDateString('fa-IR')}\n\n`;
          if (statsMarkdown) doc += `## 📊 DNA پروژه (تحلیل استک)\n\n${statsMarkdown}\n\n---\n\n`;
          if (parts.root) doc += `${parts.root}\n\n---\n\n`;
          if (parts.arch) doc += `## 🏗 معماری سیستم\n\n${parts.arch}\n\n---\n\n`;
          if (parts.erd) doc += `## 🗄 مدل داده‌ها (ERD)\n\n${parts.erd}\n\n---\n\n`;
          if (parts.class) doc += `## 🧩 نمودار کلاس (Class Diagram)\n\n${parts.class}\n\n---\n\n`;
          if (parts.infra) doc += `## ☁️ زیرساخت (Infrastructure)\n\n${parts.infra}\n\n---\n\n`;
          if (parts.seq) doc += `## 🔄 نمودار توالی (Sequence Diagram)\n\n${parts.seq}\n\n---\n\n`;
          if (parts.api) doc += `## 🔌 مستندات API (OpenAPI)\n\n${parts.api}\n\n---\n\n`;
          if (parts.ops) doc += `## 🚀 راهنمای عملیاتی و دیپلوی\n\n${parts.ops}\n\n---\n\n`;
          if (parts.code) doc += `## 💻 مستندات کدها\n\n${parts.code}`;
          return doc;
      };

      addLog(`فاز ۲: ایندکس کردن برداری کدها (RAG) با مدل ${config.embeddingModel}...`, 'info');
      await vectorStoreRef.current?.addDocuments(sourceFiles, (current, total) => {
          const percentage = Math.round((current / total) * 20); 
          setProgress(percentage);
      });
      addLog('ایندکس‌سازی کدها تکمیل شد. چت هوشمند آماده است.', 'success');
      setHasContext(true);

      const fileSummaries: string[] = [];

      // Phase 3: Code Analysis
      if (docLevels.code) {
        addLog(`فاز ۳: تحلیل کدها (${sourceFiles.length} فایل) با استفاده از Map-Reduce...`, 'info');
        for (const file of sourceFiles) {
          const facts = [
            file.metadata.classes.length > 0 ? `Classes found: ${file.metadata.classes.join(', ')}` : '',
            file.metadata.functions.length > 0 ? `Functions/Methods found: ${file.metadata.functions.join(', ')}` : '',
            file.metadata.hasApiPattern ? `Potentially contains API Endpoints` : '',
            file.metadata.isDbSchema ? `Contains Database Schema Definition` : '',
            file.metadata.isInfra ? `Infrastructure Configuration File` : ''
          ].filter(Boolean).join('\n');

          const filePrompt = `File Path: ${file.path}\n\nFACTS (Detected by Parser):\n${facts}\n\nCode Content:\n\`\`\`\n${file.content}\n\`\`\``;
          const rawResponse = await generateCompletion(config, filePrompt, PROMPT_LEVEL_2_CODE);
          const summarySplit = rawResponse.split('**SUMMARY_FOR_CONTEXT**');
          const displayContent = summarySplit[0].trim();
          const technicalSummary = summarySplit[1] ? summarySplit[1].trim() : "No summary provided.";

          fileSummaries.push(`File: ${file.path}\nSummary: ${technicalSummary}\nDetected Metadata: ${JSON.stringify(file.metadata)}\n`);
          const headerHTML = generateFileHeaderHTML(file.path, file.lines);
          parts.code += `<details>\n<summary>${headerHTML}</summary>\n\n${displayContent}\n\n</details>\n\n`;

          setGeneratedDoc(assembleDoc());
          completedSteps++;
          updateProgress(20); 
        }
      }

      const reducedContext = `
CONTEXT FOR ARCHITECTURE & ROOT DOCS:
Project File Tree:
${fileTree}

Configuration Files:
${configContents.join('')}

File Technical Summaries (Map-Reduce Output):
${fileSummaries.join('\n----------------\n')}
`;

      const strictModeSuffix = "\n\nCRITICAL INSTRUCTION: DO NOT generate a summary. DO NOT use Markdown headers. Output ONLY the code block starting with ```mermaid.";

      // Phase 4+: Higher Level Docs
      if (docLevels.arch) {
        addLog('فاز ۴: تحلیل معماری کلان...', 'info');
        parts.arch = await generateCompletion(config, reducedContext, PROMPT_LEVEL_3_ARCH);
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.erd) {
        addLog('فاز ۵: ترسیم نمودار دیتابیس (ERD)...', 'info');
        const dbFiles = sourceFiles.filter(f => f.metadata.isDbSchema || f.path.includes('entity') || f.path.includes('model') || f.path.includes('schema'));
        let erdContext = dbFiles.length > 0 ? dbFiles.map(f => `File: ${f.path}\nContent:\n${f.content}`).join('\n\n') 
          : `No explicit schema files found. Infer schema from these summaries:\n${fileSummaries.filter(s => s.toLowerCase().includes('database') || s.toLowerCase().includes('model')).join('\n')}`;
        parts.erd = extractMermaidCode(await generateCompletion(config, erdContext + strictModeSuffix, PROMPT_LEVEL_7_ERD));
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.classDiagram) {
        addLog('فاز ۶: ترسیم نمودار کلاس...', 'info');
        const classContext = `List of detected classes and structure:\n${fileSummaries.filter(s => s.includes('"classes":[')).join('\n')}`;
        parts.class = extractMermaidCode(await generateCompletion(config, classContext + strictModeSuffix, PROMPT_LEVEL_8_CLASS));
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.infra) {
        addLog('فاز ۷: ترسیم نمودار زیرساخت (Docker/Cloud)...', 'info');
        const infraFiles = sourceFiles.filter(f => f.metadata.isInfra || CONFIG_FILES.has(f.path.split('/').pop() || ''));
        let infraContext = infraFiles.length > 0 ? infraFiles.map(f => `File: ${f.path}\nContent:\n${f.content}`).join('\n\n') : reducedContext;
        parts.infra = extractMermaidCode(await generateCompletion(config, infraContext + strictModeSuffix, PROMPT_LEVEL_9_INFRA));
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.sequence) {
        addLog('فاز ۸: ترسیم نمودار توالی...', 'info');
        parts.seq = extractMermaidCode(await generateCompletion(config, reducedContext + strictModeSuffix, PROMPT_LEVEL_5_SEQUENCE));
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.api) {
        addLog('فاز ۹: تولید مستندات API...', 'info');
        const apiFiles = sourceFiles.filter(f => f.metadata.hasApiPattern || f.path.includes('routes') || f.path.includes('controller'));
        if (apiFiles.length === 0) {
            parts.api = "> هیچ الگوی API (مانند REST Controller یا Route) در پروژه یافت نشد.";
        } else {
            const apiContext = apiFiles.map(f => `File: ${f.path}\nExtracted Endpoints: ${f.metadata.apiEndpoints.join(', ')}\nContent:\n${f.content}`).join('\n\n');
            const apiContent = await generateCompletion(config, apiContext, PROMPT_LEVEL_6_API);
            const jsonMatch = apiContent.match(/```json([\s\S]*?)```/);
            parts.api = jsonMatch ? `\n\`\`\`json\n${jsonMatch[1]}\n\`\`\`\n\n_برای مشاهده این مستندات، کد بالا را در [Swagger Editor](https://editor.swagger.io) کپی کنید._` : apiContent;
        }
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.ops) {
        addLog('فاز ۱۰: مستندات عملیاتی...', 'info');
        parts.ops = await generateCompletion(config, `Config Files:\n${configContents.join('\n')}`, PROMPT_LEVEL_4_OPS);
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.root) {
        addLog('فاز نهایی: تولید README...', 'info');
        parts.root = await generateCompletion(config, reducedContext, PROMPT_LEVEL_1_ROOT);
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
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

  return { logs, isProcessing, progress, generatedDoc, setGeneratedDoc, hasContext, setHasContext, processRepository, stats };
};