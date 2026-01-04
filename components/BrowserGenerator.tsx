import React, { useState, useRef, useEffect } from 'react';
import { File as FileIcon, Folder, Play, CheckCircle, AlertCircle, Loader2, Download, Info, Eye, Code, Upload, MessageSquare, Send, Bot, User, Database, Layers, Server, LayoutTemplate, GitMerge, ChevronRight, Zap } from 'lucide-react';
// @ts-ignore
import ReactMarkdown from 'https://esm.sh/react-markdown@9.0.1?deps=react@19.2.3';
// @ts-ignore
import remarkGfm from 'https://esm.sh/remark-gfm@4.0.0';
// @ts-ignore
import mermaid from 'https://esm.sh/mermaid@10.9.0';
import { OllamaConfig, ProcessingLog, ChatMessage } from '../types';
import { IGNORED_DIRS, IGNORED_EXTENSIONS, CONFIG_FILES, DEFAULT_MODEL, OLLAMA_DEFAULT_URL, PROMPT_LEVEL_1_ROOT, PROMPT_LEVEL_2_CODE, PROMPT_LEVEL_3_ARCH, PROMPT_LEVEL_4_OPS, PROMPT_LEVEL_5_SEQUENCE } from '../utils/constants';
import { generateCompletion, checkOllamaConnection, sendChatRequest } from '../services/ollamaService';

// --- Helper Component: Mermaid Renderer ---
const MermaidRenderer = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [isError, setIsError] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Function to fix common LLM mistakes in Mermaid syntax
  const fixMermaidSyntax = (rawCode: string) => {
    let fixed = rawCode
      .replace(/```mermaid/g, '')
      .replace(/```/g, '')
      .trim();
    
    // Fix 1: Ensure flowchart TD if mistakenly graph TD
    if (fixed.startsWith('graph ')) {
       fixed = fixed.replace('graph ', 'flowchart ');
    }

    // Fix 2: Quote unquoted parentheses in node labels (The "cli()" crasher)
    // Regex matches: [ followed by anything NOT quote, then (, then ), then anything NOT quote, then ]
    // Converts A[text()] to A["text()"]
    // It captures the content inside [] and wraps it in quotes if it contains ()
    fixed = fixed.replace(/\[([^"\]\n]*\([^"\]\n]*\)[^"\]\n]*)\]/g, '["$1"]');

    // Fix 3: Quote unquoted parentheses in edge labels if possible (simplified)
    // text in || or text in -- --
    
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
        // render returns an object { svg: string }
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


const BrowserGenerator: React.FC = () => {
  // --- General State ---
  const [logs, setLogs] = useState<ProcessingLog[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0); 
  const [config, setConfig] = useState<OllamaConfig>({
    baseUrl: OLLAMA_DEFAULT_URL,
    model: DEFAULT_MODEL
  });
  const [files, setFiles] = useState<FileList | null>(null);
  
  // --- Documentation Levels State ---
  const [docLevels, setDocLevels] = useState({
    root: true,    // Level 1
    code: true,    // Level 2
    arch: true,    // Level 3
    ops: false,    // Level 4
    sequence: true // Level 5 (New)
  });

  // --- Documentation State ---
  const [generatedDoc, setGeneratedDoc] = useState<string>('');
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>('preview'); 
  const importInputRef = useRef<HTMLInputElement>(null);

  // --- Chat State ---
  const [activeTab, setActiveTab] = useState<'docs' | 'chat'>('docs');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'شما یک دستیار هوشمند برنامه‌نویسی هستید. پاسخ‌ها باید کوتاه، دقیق و حرفه‌ای باشند. برای توضیحات کد از Markdown استفاده کنید.' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [hasContext, setHasContext] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  
  const addLog = (message: string, type: ProcessingLog['type'] = 'info') => {
    setLogs(prev => [...prev, { timestamp: new Date().toLocaleTimeString('fa-IR'), message, type }]);
  };

  // --- Scroll to bottom of chat ---
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  const updateChatContext = (docContent: string) => {
    const contextSystemMessage = `*** PROJECT CONTEXT START ***
${docContent}
*** PROJECT CONTEXT END ***

ROLE & INSTRUCTIONS:
You are a dedicated Technical Assistant for the project described above.
1. Answer the user's questions **EXCLUSIVELY** based on the content within "*** PROJECT CONTEXT START ***" and "*** PROJECT CONTEXT END ***".
2. Do **NOT** provide generic programming advice. If the user asks "How to run?", look specifically for "Installation", "Scripts", or "Usage" sections in the provided context.
3. If the answer is explicitly found in the context, translate the instructions to Persian and explain them clearly.
4. If the answer is NOT found in the context, say: "متاسفانه اطلاعاتی در مورد این سوال در مستندات پروژه یافت نشد."
5. Always answer in Persian.`;

    setChatMessages([
      { role: 'system', content: contextSystemMessage }
    ]);
    setHasContext(true);
  };

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
      updateChatContext(text);
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

  const processRepository = async () => {
    if (!files) return;
    setIsProcessing(true);
    setProgress(0);
    setGeneratedDoc('');
    setLogs([]);
    setViewMode('preview');
    setActiveTab('docs');
    setHasContext(false);

    try {
      addLog('در حال بررسی اتصال به Ollama...', 'info');
      const isConnected = await checkOllamaConnection(config);
      if (!isConnected) {
        throw new Error(`اتصال به Ollama در آدرس ${config.baseUrl} برقرار نشد.`);
      }
      addLog('اتصال به Ollama برقرار شد.', 'success');

      const fileList: File[] = Array.from(files);
      let fileTree = '';
      const configContents: string[] = [];
      const sourceFiles: { path: string; content: string }[] = [];

      addLog('در حال اسکن و فیلتر کردن فایل‌ها...', 'info');

      const readFileContent = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.onerror = (e) => reject(e);
          reader.readAsText(file);
        });
      };

      for (const file of fileList) {
        // Use webkitRelativePath for structure, fallback to name if missing
        const filePath = file.webkitRelativePath || file.name;
        const pathParts = filePath.split('/');
        const hasIgnoredDir = pathParts.some(part => IGNORED_DIRS.has(part));
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (hasIgnoredDir || IGNORED_EXTENSIONS.has(extension)) continue;

        fileTree += `- ${filePath}\n`;

        if (CONFIG_FILES.has(file.name)) {
          const content = await readFileContent(file);
          configContents.push(`\n--- ${file.name} ---\n${content}\n`);
          addLog(`فایل کانفیگ پیدا شد: ${file.name}`, 'success');
        } else if (file.size < 20000) {
          const content = await readFileContent(file);
          sourceFiles.push({ path: filePath, content });
        }
      }

      // Calculate total steps based on selected levels
      let totalSteps = 0;
      if (docLevels.code) totalSteps += sourceFiles.length; // Step 1: Code Analysis
      if (docLevels.arch) totalSteps += 1; // Step 2: Arch
      if (docLevels.sequence) totalSteps += 1; // Step 3: Sequence
      if (docLevels.ops) totalSteps += 1; // Step 4: Ops
      if (docLevels.root) totalSteps += 1; // Step 5: Root (Summary)
      
      let completedSteps = 0;
      const updateProgress = () => {
        completedSteps++;
        const percent = Math.min(Math.round((completedSteps / totalSteps) * 100), 100);
        setProgress(percent);
      };

      // --- Variables to hold parts of documentation ---
      // We use these to assemble the final doc in the correct order (Root -> Arch -> Seq -> Ops -> Code)
      // even if we generate them in a different order (Code Analysis first).
      let partRoot = '';
      let partArch = '';
      let partOps = '';
      let partSeq = '';
      let partCode = '';

      const assembleDoc = () => {
          let doc = `# مستندات جامع پروژه\n\nتولید شده توسط RepoDocs AI\nمدل: ${config.model}\nتاریخ: ${new Date().toLocaleDateString('fa-IR')}\n\n`;
          if (partRoot) doc += `${partRoot}\n\n---\n\n`;
          if (partArch) doc += `## 🏗 معماری سیستم\n\n${partArch}\n\n---\n\n`;
          if (partSeq) doc += `## 🔄 نمودار توالی فرآیندها (Sequence Diagram)\n\n${partSeq}\n\n---\n\n`;
          if (partOps) doc += `## 🚀 راهنمای عملیاتی و دیپلوی\n\n${partOps}\n\n---\n\n`;
          if (partCode) doc += `## 💻 مستندات کدها\n\n${partCode}`;
          return doc;
      };

      // --- Prepare Initial Context ---
      const fullSourceContext = sourceFiles.map(f => `\n--- SOURCE FILE: ${f.path} ---\n${f.content}`).join('\n');
      
      // Store code analysis results here to improve context for later steps
      let analysisSummaries = '';

      // =========================================================================================
      // PHASE 1: Deep Code Analysis (Level 2)
      // We run this FIRST to understand the code before drawing diagrams.
      // =========================================================================================
      if (docLevels.code) {
        addLog(`سطح ۲: تحلیل عمیق ${sourceFiles.length} فایل کد (جهت درک سیستم)...`, 'info');
        
        for (const file of sourceFiles) {
          addLog(`در حال تحلیل ${file.path}...`, 'info');
          const filePrompt = `File Path: ${file.path}\n\nCode Content:\n\`\`\`\n${file.content}\n\`\`\``;
          const fileAnalysis = await generateCompletion(config, filePrompt, PROMPT_LEVEL_2_CODE);
          
          // Add to doc part
          partCode += `<details>\n<summary><strong>📄 ${file.path}</strong></summary>\n\n${fileAnalysis}\n\n</details>\n\n`;
          
          // Add to context for next steps (Valuable!)
          analysisSummaries += `\n>>> Analysis Summary for ${file.path}:\n${fileAnalysis}\n`;

          setGeneratedDoc(assembleDoc());
          updateProgress(); 
        }
      }

      // Create enriched context with analysis results
      const globalContextWithAnalysis = `Project File Tree:\n${fileTree}\n\nConfiguration Files:\n${configContents.join('')}\n\nSource Code Content:\n${fullSourceContext}\n\n${analysisSummaries ? `Expert Code Analysis Insights:\n${analysisSummaries}` : ''}`;


      // =========================================================================================
      // PHASE 2: Architecture (Level 3)
      // Now uses the enriched context
      // =========================================================================================
      if (docLevels.arch) {
        addLog('سطح ۳: تحلیل معماری و سیستم (بر اساس تحلیل کدها)...', 'info');
        const archPrompt = `${globalContextWithAnalysis}\n\nدستور اصلی: با توجه به کدها و تحلیل‌های انجام شده، یک دیاگرام معماری دقیق (Architecture Diagram) با فرمت Mermaid (flowchart TD) تولید کن که نشان دهد کامپوننت‌های کد (مثل توابع، کلاس‌ها و APIها) چگونه با هم در ارتباط هستند. حتما متن‌ها را در کوتیشن "..." بگذار.`;
        const archContent = await generateCompletion(config, archPrompt, PROMPT_LEVEL_3_ARCH);
        partArch = archContent;
        setGeneratedDoc(assembleDoc());
        updateProgress();
      }

      // =========================================================================================
      // PHASE 3: Sequence Diagram (Level 5)
      // Now uses the enriched context
      // =========================================================================================
      if (docLevels.sequence) {
        addLog('سطح ۵: ترسیم نمودار توالی (Sequence Diagram)...', 'info');
        const sequenceContext = `${globalContextWithAnalysis}\n\nدستور اصلی: بر اساس منطق موجود در کدها و تحلیل‌های انجام شده، سناریوی اصلی برنامه (مثلاً نحوه پردازش یک درخواست توسط کاربر) را استخراج کن و نمودار توالی (Sequence Diagram) آن را با فرمت Mermaid و زبان فارسی رسم کن. دقت کن که فقط sequenceDiagram مجاز است و متن‌ها باید در کوتیشن باشند.`;
        const seqContent = await generateCompletion(config, sequenceContext, PROMPT_LEVEL_5_SEQUENCE);
        partSeq = seqContent;
        setGeneratedDoc(assembleDoc());
        updateProgress();
      }

      // =========================================================================================
      // PHASE 4: Operational (Level 4)
      // =========================================================================================
      if (docLevels.ops) {
        addLog('سطح ۴: تولید مستندات عملیاتی (DevOps)...', 'info');
        const opsPrompt = `Config Files:\n${configContents.join('\n')}\n\n(No source code provided, infer from configs)`;
        const opsContent = await generateCompletion(config, opsPrompt, PROMPT_LEVEL_4_OPS);
        partOps = opsContent;
        setGeneratedDoc(assembleDoc());
        updateProgress();
      }

      // =========================================================================================
      // PHASE 5: Root Documentation (Level 1)
      // Done last to utilize full understanding for the "Introduction"
      // =========================================================================================
      if (docLevels.root) {
        addLog('سطح ۱: تولید مستندات ریشه (README)...', 'info');
        const readmeContent = await generateCompletion(config, globalContextWithAnalysis, PROMPT_LEVEL_1_ROOT);
        partRoot = readmeContent;
        setGeneratedDoc(assembleDoc());
        updateProgress();
      }

      addLog('تولید تمامی سطوح مستندات با موفقیت انجام شد!', 'success');
      setProgress(100);
      updateChatContext(assembleDoc());

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
      let messagesToSend = [...chatMessages, newUserMessage];
      
      if (hasContext) {
        const lastMsgIndex = messagesToSend.length - 1;
        messagesToSend[lastMsgIndex] = {
          role: 'user',
          content: `${userText}\n\n(IMPORTANT: Answer ONLY based on the PROJECT CONTEXT provided in the system prompt. Do not use outside knowledge.)`
        };
      }

      const responseContent = await sendChatRequest(config, messagesToSend);
      setChatMessages(prev => [...prev, { role: 'assistant', content: responseContent }]);
    } catch (error) {
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
        // Custom summary/details styling
        details: ({node, ...props}: any) => <details className="group bg-white border border-slate-200 rounded-xl mb-3 overflow-hidden transition-all shadow-sm hover:shadow-md" {...props} />,
        summary: ({node, ...props}: any) => <summary className="cursor-pointer p-4 font-mono text-sm font-medium hover:bg-slate-50 select-none text-slate-700 outline-none flex items-center gap-2" {...props} />
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
      {/* Left Panel: Controls (Styled as a dashboard widget column) */}
      <div className="xl:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-1">
        
        {/* Widget: File Selection */}
        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
             <span className="flex items-center gap-3">
               <div className="bg-blue-100 p-2 rounded-xl"><Folder className="w-5 h-5 text-blue-600" /></div>
               انتخاب پروژه
             </span>
             {files && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">{files.length} فایل</span>}
          </h2>
          
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
        </div>

        {/* Widget: Config Levels */}
        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
             <div className="bg-purple-100 p-2 rounded-xl"><Layers className="w-5 h-5 text-purple-600" /></div>
             سطوح تحلیل
          </h2>
          <div className="space-y-3">
             {[
               { id: 'code', label: 'تحلیل کدها', desc: 'بررسی فایل به فایل', color: 'slate' },
               { id: 'arch', label: 'معماری سیستم', desc: 'دیاگرام و پترن‌ها', color: 'indigo' },
               { id: 'sequence', label: 'نمودار توالی', desc: 'سناریوی اصلی', color: 'purple' },
               { id: 'ops', label: 'عملیاتی (DevOps)', desc: 'دیپلوی و کانفیگ', color: 'pink' },
               { id: 'root', label: 'ریشه (README)', desc: 'معرفی و نصب', color: 'blue' }
             ].map((level) => (
                <label key={level.id} className={`flex items-center gap-4 p-4 rounded-2xl border cursor-pointer transition-all duration-300 group hover:shadow-md ${
                  // @ts-ignore
                  docLevels[level.id] 
                  ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/10' 
                  : 'bg-white border-slate-100 hover:border-slate-300'
                }`}>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
                    // @ts-ignore
                    docLevels[level.id] ? 'border-white bg-transparent' : 'border-slate-300 bg-slate-50'
                  }`}>
                    {/* @ts-ignore */}
                    {docLevels[level.id] && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
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
                    <span className={`text-[11px] transition-colors ${
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
               <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">مدل زبانی</label>
               <input 
                  type="text" 
                  list="model-suggestions"
                  value={config.model} 
                  onChange={e => setConfig({...config, model: e.target.value})}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm dir-ltr text-left placeholder-slate-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                  placeholder="e.g., qwen2.5-coder:14b"
               />
             </div>
             <datalist id="model-suggestions">
                <option value="qwen2.5-coder:14b" />
                <option value="qwen2.5-coder:7b" />
                <option value="llama3.1" />
                <option value="gemma2:9b" />
              </datalist>
          </div>
        </div>

        {/* Action Button */}
        <div>
          <button
            onClick={processRepository}
            disabled={!files || isProcessing}
            className={`w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 text-lg
              ${!files || isProcessing 
                ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' 
                : 'bg-slate-900 text-white shadow-slate-900/30'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />} 
            {isProcessing ? 'در حال تحلیل...' : 'شروع آنالیز پروژه'}
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

      {/* Right Panel: Output & Chat (Styled as main content area) */}
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
                <Database className="w-3 h-3" />
                محتوا بارگذاری شد
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
               {isChatLoading && (
                 <div className="flex justify-end">
                   <div className="bg-white border border-slate-100 rounded-[1.5rem] rounded-bl-none p-4 flex items-center gap-3 shadow-soft">
                     <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                     <span className="text-slate-500 text-sm font-medium">در حال تایپ...</span>
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
                   disabled={isChatLoading}
                 />
                 <button
                   onClick={handleSendMessage}
                   disabled={!chatInput.trim() || isChatLoading}
                   className={`absolute left-2 top-2 bottom-2 aspect-square rounded-xl transition-all flex items-center justify-center ${
                     !chatInput.trim() || isChatLoading
                     ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                     : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'
                   }`}
                 >
                   <Send className="w-5 h-5 rotate-180" />
                 </button>
               </div>
               <div className="text-[10px] text-slate-400 mt-3 text-center flex justify-center items-center gap-2 font-medium">
                 <span>Powered by Local LLM</span>
                 {hasContext && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Context Aware</span>}
               </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default BrowserGenerator;