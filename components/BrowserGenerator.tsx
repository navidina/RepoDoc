import React, { useState, useRef, useEffect } from 'react';
import { File as FileIcon, Folder, Play, CheckCircle, AlertCircle, Loader2, Download, Info, Eye, Code, Upload, MessageSquare, Send, Bot, User, Database, Layers, Zap, LayoutTemplate, BrainCircuit, Github, Link } from 'lucide-react';
// @ts-ignore
import ReactMarkdown from 'https://esm.sh/react-markdown@9.0.1?deps=react@19.2.3';
// @ts-ignore
import remarkGfm from 'https://esm.sh/remark-gfm@4.0.0';
// @ts-ignore
import rehypeRaw from 'https://esm.sh/rehype-raw@7.0.0?bundle';
// @ts-ignore
import mermaid from 'https://esm.sh/mermaid@10.9.0';
import { OllamaConfig, ProcessingLog, ChatMessage, FileMetadata, ProcessedFile } from '../types';
import { IGNORED_DIRS, ALLOWED_EXTENSIONS, CONFIG_FILES, DEFAULT_MODEL, OLLAMA_DEFAULT_URL, PROMPT_LEVEL_1_ROOT, PROMPT_LEVEL_2_CODE, PROMPT_LEVEL_3_ARCH, PROMPT_LEVEL_4_OPS, PROMPT_LEVEL_5_SEQUENCE, PROMPT_LEVEL_6_API, PROMPT_LEVEL_7_ERD, PROMPT_LEVEL_8_CLASS, PROMPT_LEVEL_9_INFRA, LANGUAGE_MAP } from '../utils/constants';
import { generateCompletion, checkOllamaConnection, sendChatRequest } from '../services/ollamaService';
import { extractFileMetadata } from '../services/codeParser';
import { LocalVectorStore } from '../services/vectorStore';
import { parseGithubUrl, fetchGithubRepoTree, fetchGithubFileContent } from '../services/githubService';

// --- Helper Component: Mermaid Renderer ---
const MermaidRenderer = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const fixMermaidSyntax = (rawCode: string) => {
    let fixed = rawCode
      .replace(/```mermaid/g, '')
      .replace(/```/g, '')
      .trim();
    
    if (fixed.startsWith('graph ')) {
       fixed = fixed.replace('graph ', 'flowchart ');
    }

    if (fixed.includes('flowchart') || fixed.includes('graph')) {
       fixed = fixed.replace(/\[([^"\]\n]*\([^"\]\n]*\)[^"\]\n]*)\]/g, '["$1"]');
    }

    return fixed;
  };

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;
      try {
        setIsError(false);
        const cleanCode = fixMermaidSyntax(code);

        mermaid.initialize({ 
          startOnLoad: false, 
          theme: 'base', 
          themeVariables: { 
            fontFamily: 'Vazirmatn', 
            primaryColor: '#e2e8f0', 
            primaryTextColor: '#1e293b', 
            lineColor: '#64748b',
            fontSize: '14px'
          }, 
          securityLevel: 'loose',
          flowchart: { htmlLabels: true }
        });

        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg } = await mermaid.render(id, cleanCode);
        setSvg(svg);
      } catch (error: any) {
        console.error('Mermaid rendering failed:', error);
        setIsError(true);
        setErrorMsg(error.message || 'Unknown syntax error');
      }
    };

    renderDiagram();
  }, [code]);

  if (isError) {
    return (
      <div className="bg-red-50 border border-red-200 p-4 rounded-xl text-left dir-ltr my-4 shadow-sm">
        <p className="text-red-600 text-xs font-mono mb-2 font-bold flex items-center gap-2">
          <AlertCircle className="w-3 h-3" /> Mermaid Syntax Error
        </p>
        <div className="text-red-500 text-[10px] mb-2 font-mono">{errorMsg}</div>
        <pre className="text-red-800 text-xs font-mono overflow-auto whitespace-pre-wrap bg-red-100/50 p-2 rounded max-h-40">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
       <div className="flex items-center justify-center p-8 bg-slate-50 rounded-2xl my-4 border border-dashed border-slate-300">
         <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
         <span className="ml-3 text-sm text-slate-500 font-medium">در حال ترسیم دیاگرام...</span>
       </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 my-6 overflow-x-auto shadow-soft text-center border border-slate-100">
       <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
};

// --- Helper: Generate Clean File Header HTML ---
const generateFileHeaderHTML = (path: string, size: number) => {
  const parts = path.split('/');
  const filename = parts.pop();
  const dir = parts.join('/');
  const sizeKb = (size / 1024).toFixed(1);
  
  // Clean LTR container for file info, using utility classes defined in global CSS or inline styles
  return `
<div class="file-header">
  <div class="file-info-group">
    <span class="file-icon">📄</span>
    <span class="file-name">${filename}</span>
    <span class="file-path">${dir ? `${dir}/` : ''}</span>
  </div>
  <span class="file-size">${sizeKb} KB</span>
</div>`;
};

// --- Helper: Extract Mermaid Code Block ---
const extractMermaidCode = (response: string): string => {
  const match = response.match(/```mermaid([\s\S]*?)```/);
  return match ? `\`\`\`mermaid${match[1]}\`\`\`` : `\`\`\`mermaid\n${response}\n\`\`\``; // Fallback if no block found but implied
};

const BrowserGenerator: React.FC = () => {
  // --- General State ---
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [config, setConfig] = useState<OllamaConfig>({
    baseUrl: OLLAMA_DEFAULT_URL,
    model: DEFAULT_MODEL,
    embeddingModel: 'nomic-embed-text' 
  });
  
  // Input State
  const [inputType, setInputType] = useState<'local' | 'github'>('local');
  const [files, setFiles] = useState<FileList | null>(null);
  const [githubUrl, setGithubUrl] = useState('');

  const vectorStoreRef = useRef<LocalVectorStore | null>(null);
  
  // --- Documentation Levels State ---
  const [docLevels, setDocLevels] = useState({
    root: true,    
    code: true,    
    arch: true,    
    ops: false,    
    sequence: true, 
    api: false,     
    erd: false,     
    classDiagram: false, 
    infra: false    
  });

  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>('preview'); 
  const importInputRef = useRef<HTMLInputElement>(null);

  // --- Chat State ---
  const [activeTab, setActiveTab] = useState<'docs' | 'chat'>('docs');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'شما یک دستیار هوشمند برنامه‌نویسی هستید. پاسخ‌ها باید کوتاه، دقیق و حرفه‌ای باشند.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [hasContext, setHasContext] = useState(false);
  const [isRetrieving, setIsRetrieving] = useState(false); 
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const addLog = (message: string, type: ProcessingLog['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString('fa-IR'), message, type }]);
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(e.target.files);
      addLog(`تعداد ${e.target.files.length} فایل انتخاب شد. آماده پردازش.`, 'info');
      setProgress(0);
    }
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setGeneratedDoc(text);
      setHasContext(true);
      setViewMode('preview');
      setActiveTab('docs');
      addLog(`فایل ${file.name} با موفقیت بارگذاری شد.`, 'success');
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.onerror = () => {
      addLog('خطا در خواندن فایل Markdown.', 'error');
    };
    reader.readAsText(file);
  };

  // --- MAIN PROCESSING PIPELINE ---
  const processRepository = async () => {
    if (inputType === 'local' && !files) return;
    if (inputType === 'github' && !githubUrl) return;

    setIsProcessing(true);
    setProgress(0);
    setGeneratedDoc('');
    setLogs([]);
    setViewMode('preview');
    setActiveTab('docs');
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

      // --- File Fetching Strategy ---
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
            
            const langName = LANGUAGE_MAP[extension || ''] || 'Other';
            if (langName !== 'Other') {
                languageStats[langName] = (languageStats[langName] || 0) + file.size;
            }

            fileTree += `- ${filePath}\n`;

            if (CONFIG_FILES.has(file.name)) {
              const content = await readFileContent(file);
              configContents.push(`\n--- ${file.name} ---\n${content}\n`);
              addLog(`فایل کانفیگ پیدا شد: ${file.name}`, 'success');
              if (file.name.includes('docker') || file.name.endsWith('.prisma') || file.name.endsWith('.tf')) {
                 const metadata = extractFileMetadata(content, filePath);
                 sourceFiles.push({ path: filePath, content, size: file.size, metadata });
              }
            } else if (file.size < 50000) { 
              const content = await readFileContent(file);
              const metadata = extractFileMetadata(content, filePath);
              sourceFiles.push({ path: filePath, content, size: file.size, metadata });
            }
          }
      } else if (inputType === 'github') {
          const repoInfo = parseGithubUrl(githubUrl);
          if (!repoInfo) throw new Error("آدرس گیت‌هاب نامعتبر است.");
          
          addLog(`در حال دریافت لیست فایل‌ها از ${repoInfo.owner}/${repoInfo.repo}...`, 'info');
          const { tree, branch } = await fetchGithubRepoTree(repoInfo.owner, repoInfo.repo);
          
          let fetchedCount = 0;
          const maxFetch = 40; // Limit for performance

          // Prioritize config files and allowed extensions
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
             
             // Update Stats (approximate size if not available)
             const size = node.size || 1000;
             const langName = LANGUAGE_MAP[extension || ''] || 'Other';
             if (langName !== 'Other') languageStats[langName] = (languageStats[langName] || 0) + size;
             
             fileTree += `- ${node.path}\n`;

             // Fetch logic: Always fetch configs, fetch others up to limit
             if (isConfig || fetchedCount < maxFetch) {
                 const content = await fetchGithubFileContent(repoInfo.owner, repoInfo.repo, branch, node.path);
                 fetchedCount++;
                 
                 if (isConfig) {
                     configContents.push(`\n--- ${filename} ---\n${content}\n`);
                     addLog(`فایل کانفیگ دریافت شد: ${filename}`, 'success');
                 }
                 
                 // Add to sourceFiles if strictly code or special config
                 if (isConfig && (filename.includes('docker') || filename.endsWith('.prisma') || filename.endsWith('.tf'))) {
                     const metadata = extractFileMetadata(content, node.path);
                     sourceFiles.push({ path: node.path, content, size, metadata });
                 } else if (!isConfig && content.length < 50000) {
                     const metadata = extractFileMetadata(content, node.path);
                     sourceFiles.push({ path: node.path, content, size, metadata });
                 }
                 
                 // Update progress visually during fetch
                 if (fetchedCount % 5 === 0) setProgress(Math.round((fetchedCount / maxFetch) * 10));
             }
          }
      }

      // Generate Stats
      const totalBytes = Object.values(languageStats).reduce((a, b) => a + b, 0);
      let statsMarkdown = '';
      if (totalBytes > 0) {
        const sortedStats = Object.entries(languageStats)
          .sort(([, a], [, b]) => b - a)
          .map(([lang, size]) => ({
             lang,
             size,
             percent: ((size / totalBytes) * 100).toFixed(1)
          }));
        
        statsMarkdown = `
| زبان / تکنولوژی | حجم (KB) | درصد استفاده |
| :--- | :--- | :--- |
${sortedStats.map(s => `| ${s.lang} | ${(s.size / 1024).toFixed(1)} KB | ${s.percent}% |`).join('\n')}
`;
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

      let partRoot = '';
      let partArch = '';
      let partOps = '';
      let partSeq = '';
      let partApi = '';
      let partErd = '';
      let partClass = '';
      let partInfra = '';
      let partCode = '';

      const assembleDoc = () => {
          let doc = `# مستندات جامع پروژه\n\nتولید شده توسط RepoDocs AI\nمدل: ${config.model}\nتاریخ: ${new Date().toLocaleDateString('fa-IR')}\n\n`;
          if (statsMarkdown) doc += `## 📊 آمار و تکنولوژی‌های پروژه\n\n${statsMarkdown}\n\n---\n\n`;
          if (partRoot) doc += `${partRoot}\n\n---\n\n`;
          if (partArch) doc += `## 🏗 معماری سیستم\n\n${partArch}\n\n---\n\n`;
          if (partErd) doc += `## 🗄 مدل داده‌ها (ERD)\n\n${partErd}\n\n---\n\n`;
          if (partClass) doc += `## 🧩 نمودار کلاس (Class Diagram)\n\n${partClass}\n\n---\n\n`;
          if (partInfra) doc += `## ☁️ زیرساخت (Infrastructure)\n\n${partInfra}\n\n---\n\n`;
          if (partSeq) doc += `## 🔄 نمودار توالی (Sequence Diagram)\n\n${partSeq}\n\n---\n\n`;
          if (partApi) doc += `## 🔌 مستندات API (OpenAPI)\n\n${partApi}\n\n---\n\n`;
          if (partOps) doc += `## 🚀 راهنمای عملیاتی و دیپلوی\n\n${partOps}\n\n---\n\n`;
          if (partCode) doc += `## 💻 مستندات کدها\n\n${partCode}`;
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

      // Phase 2: Code Analysis (Level 2)
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

          const headerHTML = generateFileHeaderHTML(file.path, file.size);
          // Use standard markdown details/summary. The CSS in index.html will handle styling.
          partCode += `
<details>
<summary>${headerHTML}</summary>

${displayContent}

</details>
\n`;

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

      // Diagrams & Architecture
      if (docLevels.arch) {
        addLog('فاز ۴: تحلیل معماری کلان...', 'info');
        const archContent = await generateCompletion(config, reducedContext, PROMPT_LEVEL_3_ARCH);
        partArch = archContent;
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.erd) {
        addLog('فاز ۵: ترسیم نمودار دیتابیس (ERD)...', 'info');
        const dbFiles = sourceFiles.filter(f => f.metadata.isDbSchema || f.path.includes('entity') || f.path.includes('model'));
        if (dbFiles.length > 0) {
            const dbContext = dbFiles.map(f => `File: ${f.path}\nContent:\n${f.content}`).join('\n\n');
            const erdContent = await generateCompletion(config, dbContext, PROMPT_LEVEL_7_ERD);
            partErd = extractMermaidCode(erdContent);
        } else {
            partErd = "> فایل مشخصی برای اسکیما دیتابیس پیدا نشد.";
        }
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.classDiagram) {
        addLog('فاز ۶: ترسیم نمودار کلاس...', 'info');
        const classContext = `
        List of detected classes and structure:
        ${fileSummaries.filter(s => s.includes('"classes":[')).join('\n')}
        `;
        const classContent = await generateCompletion(config, classContext, PROMPT_LEVEL_8_CLASS);
        partClass = extractMermaidCode(classContent);
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.infra) {
        addLog('فاز ۷: ترسیم نمودار زیرساخت (Docker/Cloud)...', 'info');
        const infraFiles = sourceFiles.filter(f => f.metadata.isInfra || CONFIG_FILES.has(f.path.split('/').pop() || ''));
        if (infraFiles.length > 0) {
            const infraContext = infraFiles.map(f => `File: ${f.path}\nContent:\n${f.content}`).join('\n\n');
            const infraContent = await generateCompletion(config, infraContext, PROMPT_LEVEL_9_INFRA);
            partInfra = extractMermaidCode(infraContent);
        } else {
            partInfra = "> فایل‌های زیرساخت پیدا نشد.";
        }
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.sequence) {
        addLog('فاز ۸: ترسیم نمودار توالی...', 'info');
        const seqContent = await generateCompletion(config, reducedContext, PROMPT_LEVEL_5_SEQUENCE);
        partSeq = extractMermaidCode(seqContent);
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.api) {
        addLog('فاز ۹: تولید مستندات API...', 'info');
        const apiFiles = sourceFiles.filter(f => f.metadata.hasApiPattern || f.path.includes('routes') || f.path.includes('controller'));
        if (apiFiles.length === 0) {
            partApi = "> هیچ الگوی API (مانند REST Controller یا Route) در پروژه یافت نشد.";
        } else {
            const apiContext = apiFiles.map(f => `File: ${f.path}\nExtracted Endpoints: ${f.metadata.apiEndpoints.join(', ')}\nContent:\n${f.content}`).join('\n\n');
            const apiContent = await generateCompletion(config, apiContext, PROMPT_LEVEL_6_API);
            const jsonMatch = apiContent.match(/```json([\s\S]*?)```/);
            if (jsonMatch) {
               partApi = `\n\`\`\`json\n${jsonMatch[1]}\n\`\`\`\n\n_برای مشاهده این مستندات، کد بالا را در [Swagger Editor](https://editor.swagger.io) کپی کنید._`;
            } else {
               partApi = apiContent;
            }
        }
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.ops) {
        addLog('فاز ۱۰: مستندات عملیاتی...', 'info');
        const opsPrompt = `Config Files:\n${configContents.join('\n')}`;
        const opsContent = await generateCompletion(config, opsPrompt, PROMPT_LEVEL_4_OPS);
        partOps = opsContent;
        setGeneratedDoc(assembleDoc());
        completedSteps++;
        updateProgress(20);
      }

      if (docLevels.root) {
        addLog('فاز نهایی: تولید README...', 'info');
        const readmeContent = await generateCompletion(config, reducedContext, PROMPT_LEVEL_1_ROOT);
        partRoot = readmeContent;
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

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading) return;

    const userText = chatInput;
    const newUserMessage: ChatMessage = { role: 'user', content: userText };
    setChatMessages(prev => [...prev, newUserMessage]);
    setChatInput('');
    setIsChatLoading(true);

    try {
      let contextContent = "";
      
      if (hasContext && vectorStoreRef.current) {
         setIsRetrieving(true);
         const relevantDocs = await vectorStoreRef.current.similaritySearch(userText, 5);
         
         if (relevantDocs.length > 0) {
           const chunksText = relevantDocs.map(d => `SOURCE: ${d.metadata.filePath}\n\`\`\`\n${d.content}\n\`\`\``).join('\n\n');
           contextContent = `*** RETRIEVED PROJECT SOURCE CODE ***\n${chunksText}\n*** END SOURCE ***\n\n`;
         }
         setIsRetrieving(false);
      }

      const systemMessage: ChatMessage = { 
         role: 'system', 
         content: `You are an expert code assistant. 
         ${contextContent ? `Use the following retrieved code snippets to answer the user's question:\n${contextContent}` : 'Answer based on your general knowledge.'}
         
         Rules:
         1. Always answer in Persian (Farsi).
         2. Be concise and technical.
         3. If the answer is in the retrieved code, cite the file name.`
      };

      const messagesToSend = [systemMessage, ...chatMessages.filter(m => m.role !== 'system'), newUserMessage];

      const responseContent = await sendChatRequest(config, messagesToSend);
      setChatMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (error) {
      setIsRetrieving(false);
      setChatMessages(prev => [...prev, { role: 'assistant', content: '**خطا در برقراری ارتباط با مدل.** لطفا تنظیمات Ollama را بررسی کنید.' }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const downloadMarkdown = () => {
    const blob = new Blob([generatedDoc], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'DOCUMENTATION.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  const MarkdownRenderer = ({ content }: { content: string }) => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw]}
      components={{
        h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-slate-900 my-6 border-b-2 border-slate-100 pb-3" {...props} />,
        h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-slate-800 mt-8 mb-4 flex items-center gap-2" {...props} />,
        h3: ({node, ...props}: any) => <h3 className="text-lg font-semibold text-slate-700 mt-6 mb-2" {...props} />,
        p: ({node, ...props}: any) => <p className="text-slate-600 leading-8 mb-4 text-justify" {...props} />,
        ul: ({node, ...props}: any) => <ul className="list-disc list-outside mr-6 space-y-2 mb-4 text-slate-600" {...props} />,
        ol: ({node, ...props}: any) => <ol className="list-decimal list-outside mr-6 space-y-2 mb-4 text-slate-600" {...props} />,
        table: ({node, ...props}: any) => <div className="overflow-x-auto my-6 border border-slate-200 rounded-xl shadow-sm"><table className="w-full text-right" {...props} /></div>,
        thead: ({node, ...props}: any) => <thead className="bg-slate-50 text-slate-700" {...props} />,
        th: ({node, ...props}: any) => <th className="px-6 py-3 border-b border-slate-200 font-bold text-xs uppercase tracking-wider text-slate-500" {...props} />,
        td: ({node, ...props}: any) => <td className="px-6 py-4 border-b border-slate-100 text-sm" {...props} />,
        code: ({node, inline, className, children, ...props}: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const isMermaid = match && match[1] === 'mermaid';
          
          if (!inline && isMermaid) {
             return <MermaidRenderer code={String(children).replace(/\n$/, '')} />;
          }

          return inline ? (
            <code className="bg-slate-100 text-pink-600 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200 shadow-sm" {...props}>{children}</code>
          ) : (
            <div className="my-4 dir-ltr"><code className="block bg-[#1E293B] p-4 rounded-xl overflow-x-auto text-sm font-mono text-slate-300 border border-slate-800 shadow-lg" {...props}>{children}</code></div>
          )
        },
        // IMPORTANT: Styles for details/summary to look good in UI without polluting Markdown file with classes
        details: ({node, ...props}: any) => <details className="group bg-white border border-slate-200 rounded-xl mb-3 overflow-hidden transition-all shadow-sm hover:shadow-md" {...props} />,
        summary: ({node, ...props}: any) => <summary className="cursor-pointer p-4 hover:bg-slate-50 select-none text-slate-700 outline-none" {...props} />
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
      {/* Left Panel: Controls */}
      <div className="xl:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-1">
        
        {/* Widget: Source Selection (Updated) */}
        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
             <span className="flex items-center gap-3">
               <div className="bg-blue-100 p-2 rounded-xl"><Folder className="w-5 h-5 text-blue-600" /></div>
               انتخاب منبع کد
             </span>
             {files && inputType === 'local' && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">{files.length} فایل</span>}
          </h2>
          
          {/* Tabs */}
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
            <button 
               onClick={() => setInputType('local')}
               className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${inputType === 'local' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
               <Folder className="w-4 h-4" /> پوشه محلی
            </button>
            <button 
               onClick={() => setInputType('github')}
               className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${inputType === 'github' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
            >
               <Github className="w-4 h-4" /> گیت‌هاب
            </button>
          </div>

          {inputType === 'local' ? (
            <div className="relative group">
              <input
                type="file"
                // @ts-ignore
                webkitdirectory=""
                directory=""
                onChange={handleDirectorySelect}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                disabled={isProcessing}
              />
              <div className={`border-2 border-dashed rounded-2xl p-8 transition-all text-center group-hover:border-blue-400 group-hover:bg-blue-50/50 ${files ? 'border-green-300 bg-green-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="bg-white p-3 rounded-full shadow-sm w-12 h-12 mx-auto flex items-center justify-center mb-3 text-blue-500 group-hover:scale-110 transition-transform">
                  <Upload className="w-6 h-6" />
                </div>
                <p className="text-sm font-bold text-slate-700 mb-1">{files ? 'پوشه انتخاب شد' : 'انتخاب پوشه کد'}</p>
                <p className="text-xs text-slate-400">کلیک کنید یا درگ کنید</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Github className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                <input 
                  type="text" 
                  value={githubUrl}
                  onChange={(e) => setGithubUrl(e.target.value)}
                  placeholder="https://github.com/username/repo"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-10 text-slate-700 text-sm dir-ltr text-left outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed bg-blue-50 text-blue-600 p-2 rounded-lg">
                <Info className="w-3 h-3 inline ml-1" />
                نکته: برای ریپازیتوری‌های عمومی، فایل‌های اصلی و کانفیگ دانلود و تحلیل می‌شوند.
              </p>
            </div>
          )}
        </div>

        {/* Widget: Config Levels */}
        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
             <div className="bg-purple-100 p-2 rounded-xl"><Layers className="w-5 h-5 text-purple-600" /></div>
             سطوح تحلیل و دیاگرام
          </h2>
          <div className="space-y-3">
             {[
               { id: 'code', label: 'تحلیل کدها', desc: 'بررسی فایل به فایل + خلاصه', color: 'slate' },
               { id: 'arch', label: 'معماری سیستم', desc: 'دیاگرام و پترن‌ها', color: 'indigo' },
               { id: 'erd', label: 'دیتابیس (ERD)', desc: 'مدل داده (Prisma/SQL)', color: 'blue' }, 
               { id: 'classDiagram', label: 'نمودار کلاس', desc: 'تحلیل شی‌گرایی', color: 'orange' }, 
               { id: 'infra', label: 'زیرساخت', desc: 'Docker / Terraform', color: 'cyan' }, 
               { id: 'sequence', label: 'نمودار توالی', desc: 'سناریوی اصلی', color: 'purple' },
               { id: 'api', label: 'مستندات API', desc: 'OpenAPI Spec', color: 'emerald' },
               { id: 'ops', label: 'عملیاتی (DevOps)', desc: 'دیپلوی و کانفیگ', color: 'pink' },
               { id: 'root', label: 'ریشه (README)', desc: 'معرفی و نصب', color: 'blue' }
             ].map((level) => (
                <label key={level.id} className={`flex items-center gap-4 p-3.5 rounded-2xl border cursor-pointer transition-all duration-300 group hover:shadow-md ${
                  // @ts-ignore
                  docLevels[level.id] 
                  ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/10' 
                  : 'bg-white border-slate-100 hover:border-slate-300'
                }`}>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                    // @ts-ignore
                    docLevels[level.id] ? 'border-white bg-transparent' : 'border-slate-300 bg-slate-50'
                  }`}>
                    {/* @ts-ignore */}
                    {docLevels[level.id] && <div className="w-2 h-2 bg-white rounded-full" />}
                  </div>
                  <input type="checkbox" 
                    // @ts-ignore
                    checked={docLevels[level.id]} 
                    // @ts-ignore
                    onChange={e => setDocLevels({...docLevels, [level.id]: e.target.checked})} 
                    className="hidden" 
                  />
                  <div className="flex flex-col">
                    <span className={`text-sm font-bold transition-colors ${
                      // @ts-ignore
                      docLevels[level.id] ? 'text-white' : 'text-slate-700'
                    }`}>{level.label}</span>
                    <span className={`text-[10px] transition-colors ${
                      // @ts-ignore
                      docLevels[level.id] ? 'text-slate-400' : 'text-slate-400'
                    }`}>{level.desc}</span>
                  </div>
                </label>
             ))}
          </div>
        </div>

        {/* Widget: LLM Config */}
        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-xl"><Zap className="w-5 h-5 text-orange-600" /></div>
             پیکربندی هوش مصنوعی
          </h2>
          <div className="space-y-4">
             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">آدرس سرور Ollama</label>
               <input 
                  type="text" 
                  value={config.baseUrl} 
                  onChange={e => setConfig({...config, baseUrl: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm dir-ltr text-left placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="http://localhost:11434"
               />
             </div>
             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">مدل تولید متن (Main)</label>
               <input 
                  type="text" 
                  list="model-suggestions"
                  value={config.model} 
                  onChange={e => setConfig({...config, model: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm dir-ltr text-left placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g., qwen2.5-coder:14b"
               />
             </div>
             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1 mr-1">
                 مدل Embedding (RAG)
               </label>
               <input 
                  type="text" 
                  list="embed-suggestions"
                  value={config.embeddingModel} 
                  onChange={e => setConfig({...config, embeddingModel: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm dir-ltr text-left placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g., nomic-embed-text"
               />
             </div>
             <datalist id="model-suggestions">
                <option value="qwen2.5-coder:14b" />
                <option value="qwen2.5-coder:7b" />
                <option value="llama3.1" />
                <option value="gemma2:9b" />
              </datalist>
              <datalist id="embed-suggestions">
                <option value="nomic-embed-text" />
                <option value="mxbai-embed-large" />
                <option value="snowflake-arctic-embed" />
              </datalist>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={processRepository}
            disabled={(inputType === 'local' && !files) || (inputType === 'github' && !githubUrl) || isProcessing}
            className={`w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 text-lg
              ${(inputType === 'local' && !files) || (inputType === 'github' && !githubUrl) || isProcessing 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-slate-900 text-white shadow-slate-900/30'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />} 
            {isProcessing ? 'در حال تحلیل...' : 'شروع آنالیز جامع'}
          </button>

          {(isProcessing || progress > 0) && (
            <div className="mt-6 bg-white p-4 rounded-2xl shadow-soft">
              <div className="flex justify-between text-xs text-slate-500 mb-2 font-bold px-1">
                <span>پیشرفت کلی</span>
                <span className="text-blue-600">{progress}%</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out relative" 
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto bg-slate-50 rounded-[2rem] p-5 border border-slate-100 font-sans text-xs min-h-[150px] shadow-inner-light">
          <div className="text-slate-400 mb-3 font-bold sticky top-0 bg-slate-50 pb-2 border-b border-slate-200 flex items-center gap-2">
            <Info className="w-3 h-3" />
            گزارش لحظه‌ای
          </div>
          {logs.length === 0 && <span className="text-slate-400 italic pl-2">منتظر شروع عملیات...</span>}
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className={`flex items-start gap-2 ${
                log.type === 'error' ? 'text-red-500' : 
                log.type === 'success' ? 'text-emerald-600' : 
                'text-slate-600'
              }`}>
                <span className="opacity-40 text-[10px] whitespace-nowrap dir-ltr font-sans bg-slate-200 px-1 rounded mt-0.5">{log.timestamp}</span>
                <span className="leading-relaxed">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Panel: Output & Chat */}
      <div className="xl:col-span-8 bg-white rounded-[2.5rem] shadow-soft border border-white flex flex-col h-full overflow-hidden relative">
        {/* Header Tabs */}
        <div className="flex items-center px-8 pt-8 pb-4 justify-between bg-white z-10">
           <div className="flex bg-slate-100/80 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab('docs')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'docs' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <FileIcon className="w-4 h-4" />
              مستندات
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${
                activeTab === 'chat' 
                ? 'bg-white text-slate-900 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              چت هوشمند
            </button>
           </div>
           
           {hasContext && (
             <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold animate-in fade-in">
                <BrainCircuit className="w-3 h-3" />
                RAG Active
             </div>
           )}
        </div>

        <div className="h-px bg-slate-100 mx-8"></div>

        {/* --- DOCS TAB CONTENT --- */}
        {activeTab === 'docs' && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-center px-8 py-4 gap-4 bg-white">
               <div className="flex flex-wrap items-center gap-3 w-full justify-between">
                <div className="flex gap-3">
                  <input 
                    type="file" 
                    accept=".md,.markdown" 
                    ref={importInputRef} 
                    className="hidden" 
                    onChange={handleImportMarkdown}
                  />
                  <button 
                    onClick={() => importInputRef.current?.click()}
                    className="text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-slate-200 shadow-sm"
                  >
                    <Upload className="w-4 h-4" /> <span className="hidden sm:inline">ایمپورت</span>
                  </button>

                  {generatedDoc && (
                    <button onClick={downloadMarkdown} className="text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20">
                      <Download className="w-4 h-4" /> <span className="hidden sm:inline">دانلود MD</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button 
                    onClick={() => setViewMode('preview')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Eye className="w-3 h-3" /> نمایش
                  </button>
                  <button 
                    onClick={() => setViewMode('raw')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                      viewMode === 'raw' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <Code className="w-3 h-3" /> کد
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white px-8 pb-8 overflow-y-auto">
              {!generatedDoc ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center">
                    <LayoutTemplate className="w-10 h-10" />
                  </div>
                  <span className="font-medium">پیش‌نمایش مستندات اینجا نمایش داده می‌شود...</span>
                </div>
              ) : viewMode === 'raw' ? (
                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap bg-slate-900 text-slate-300 p-6 rounded-2xl dir-ltr shadow-inner shadow-black/50">{generatedDoc}</pre>
              ) : (
                <div className="prose prose-slate max-w-none dir-rtl">
                  <MarkdownRenderer content={generatedDoc} />
                </div>
              )}
            </div>
          </>
        )}

        {/* --- CHAT TAB CONTENT --- */}
        {activeTab === 'chat' && (
           <div className="flex flex-col h-full bg-slate-50/50">
             {/* Chat History */}
             <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
               {chatMessages.filter(m => m.role !== 'system').length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6 opacity-60">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-soft flex items-center justify-center">
                       <Bot className="w-10 h-10 text-slate-300" />
                    </div>
                    <div className="text-center">
                      <p className="font-bold text-slate-600 text-lg">دستیار هوشمند پروژه</p>
                      <p className="text-sm mt-1">مدل فعال: <span className="font-mono text-blue-500 bg-blue-50 px-2 py-0.5 rounded">{config.model}</span></p>
                    </div>
                 </div>
               ) : (
                 chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                   <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                     <div className={`max-w-[85%] rounded-[1.5rem] p-5 shadow-sm ${
                       msg.role === 'user' 
                       ? 'bg-slate-900 text-white rounded-br-none shadow-slate-900/10' 
                       : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-soft'
                     }`}>
                       <div className="flex items-center gap-2 mb-3 opacity-70 text-xs pb-2 border-b border-white/10">
                          {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-blue-500" />}
                          <span className="font-bold">{msg.role === 'user' ? 'شما' : 'دستیار هوشمند'}</span>
                       </div>
                       {msg.role === 'user' ? (
                         <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div>
                       ) : (
                         <div className="prose prose-slate prose-sm max-w-none dir-rtl">
                           <MarkdownRenderer content={msg.content} />
                         </div>
                       )}
                     </div>
                   </div>
                 ))
               )}
               {(isChatLoading || isRetrieving) && (
                 <div className="flex justify-end">
                   <div className="bg-white border border-slate-100 rounded-[1.5rem] rounded-bl-none p-4 flex items-center gap-3 shadow-soft">
                     <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                     <span className="text-slate-500 text-sm font-medium">
                        {isRetrieving ? 'جستجو در پایگاه دانش (RAG)...' : 'در حال تایپ...'}
                     </span>
                   </div>
                 </div>
               )}
             </div>

             {/* Chat Input */}
             <div className="p-6 bg-white border-t border-slate-100">
               <div className="relative shadow-soft rounded-2xl">
                 <textarea
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder={hasContext ? "سوال خود را درباره پروژه بپرسید..." : "پیام خود را بنویسید..."}
                   className="w-full bg-slate-50 border-0 rounded-2xl p-4 pl-14 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-100 resize-none h-16 max-h-32 text-sm leading-relaxed"
                   disabled={isChatLoading || isRetrieving}
                 />
                 <button
                   onClick={handleSendMessage}
                   disabled={!chatInput.trim() || isChatLoading || isRetrieving}
                   className={`absolute left-2 top-2 bottom-2 aspect-square rounded-xl transition-all flex items-center justify-center ${
                     !chatInput.trim() || isChatLoading || isRetrieving
                     ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                     : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                   }`}
                 >
                   <Send className="w-5 h-5 rotate-180" />
                 </button>
               </div>
               <div className="text-[10px] text-slate-400 mt-3 text-center flex justify-center items-center gap-2 font-medium">
                 <span>Powered by Local LLM</span>
                 {hasContext && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Database className="w-3 h-3" /> RAG Enabled</span>}
               </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default BrowserGenerator;