import React, { useState, useRef, useEffect } from 'react';
import { File as FileIcon, Folder, Play, CheckCircle, AlertCircle, Loader2, Download, Info, Eye, Code, Upload, MessageSquare, Send, Bot, User, Database, Layers, Server, LayoutTemplate, GitMerge } from 'lucide-react';
// @ts-ignore
import ReactMarkdown from 'https://esm.sh/react-markdown@9.0.1?deps=react@19.2.3';
// @ts-ignore
import remarkGfm from 'https://esm.sh/remark-gfm@4.0.0';
// @ts-ignore
import mermaid from 'mermaid';
import { OllamaConfig, ProcessingLog, ChatMessage } from '../types';
import { IGNORED_DIRS, IGNORED_EXTENSIONS, CONFIG_FILES, DEFAULT_MODEL, OLLAMA_DEFAULT_URL, PROMPT_LEVEL_1_ROOT, PROMPT_LEVEL_2_CODE, PROMPT_LEVEL_3_ARCH, PROMPT_LEVEL_4_OPS, PROMPT_LEVEL_5_SEQUENCE } from '../utils/constants';
import { generateCompletion, checkOllamaConnection, sendChatRequest } from '../services/ollamaService';

// --- Helper Component: Mermaid Renderer ---
const MermaidRenderer = ({ code }: { code: string }) => {
  const [svg, setSvg] = useState('');
  const [isError, setIsError] = useState(false);

  useEffect(() => {
    const renderDiagram = async () => {
      if (!code) return;
      try {
        setIsError(false);
        // Initialize with a standard theme that looks good on white background
        mermaid.initialize({ startOnLoad: false, theme: 'default', securityLevel: 'loose' });
        const id = `mermaid-${Math.random().toString(36).substring(2, 11)}`;
        const { svg } = await mermaid.render(id, code);
        setSvg(svg);
      } catch (error) {
        console.error('Mermaid rendering failed:', error);
        setIsError(true);
      }
    };

    renderDiagram();
  }, [code]);

  if (isError) {
    return (
      <div className="bg-red-900/20 border border-red-500/50 p-4 rounded text-left dir-ltr my-4">
        <p className="text-red-400 text-xs font-mono mb-2">Mermaid Syntax Error</p>
        <pre className="text-gray-300 text-xs font-mono overflow-auto whitespace-pre-wrap">{code}</pre>
      </div>
    );
  }

  if (!svg) {
    return (
       <div className="flex items-center justify-center p-6 bg-gray-800/50 rounded-lg my-4 border border-gray-700">
         <Loader2 className="w-5 h-5 animate-spin text-blue-400" />
         <span className="ml-2 text-xs text-gray-400 font-mono">Rendering Diagram...</span>
       </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 my-6 overflow-x-auto shadow-xl text-center border-4 border-gray-200">
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
        const pathParts = file.webkitRelativePath.split('/');
        const hasIgnoredDir = pathParts.some(part => IGNORED_DIRS.has(part));
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (hasIgnoredDir || IGNORED_EXTENSIONS.has(extension)) continue;

        fileTree += `- ${file.webkitRelativePath}\n`;

        if (CONFIG_FILES.has(file.name)) {
          const content = await readFileContent(file);
          configContents.push(`\n--- ${file.name} ---\n${content}\n`);
          addLog(`فایل کانفیگ پیدا شد: ${file.name}`, 'success');
        } else if (file.size < 20000) {
          const content = await readFileContent(file);
          sourceFiles.push({ path: file.webkitRelativePath, content });
        }
      }

      // Calculate total steps based on selected levels
      let totalSteps = 0;
      if (docLevels.root) totalSteps += 1;
      if (docLevels.arch) totalSteps += 1;
      if (docLevels.ops) totalSteps += 1;
      if (docLevels.sequence) totalSteps += 1; // New Step
      if (docLevels.code) totalSteps += sourceFiles.length;

      let completedSteps = 0;
      const updateProgress = () => {
        completedSteps++;
        const percent = Math.min(Math.round((completedSteps / totalSteps) * 100), 100);
        setProgress(percent);
      };

      let documentation = `# مستندات جامع پروژه\n\nتولید شده توسط RepoDocs AI\nمدل: ${config.model}\nتاریخ: ${new Date().toLocaleDateString('fa-IR')}\n\n`;
      
      const globalContext = `Here is the file tree of the project:\n${fileTree}\n\nAnd here are the configuration files:\n${configContents.join('')}`;

      // --- LEVEL 1: ROOT Documentation ---
      if (docLevels.root) {
        addLog('سطح ۱: تولید مستندات ریشه (README)...', 'info');
        const readmeContent = await generateCompletion(config, globalContext, PROMPT_LEVEL_1_ROOT);
        documentation += `${readmeContent}\n\n---\n\n`;
        setGeneratedDoc(documentation);
        updateProgress();
      }

      // --- LEVEL 3: Architecture Documentation ---
      if (docLevels.arch) {
        addLog('سطح ۳: تحلیل معماری و سیستم...', 'info');
        const archContent = await generateCompletion(config, globalContext, PROMPT_LEVEL_3_ARCH);
        documentation += `## 🏗 معماری سیستم\n\n${archContent}\n\n---\n\n`;
        setGeneratedDoc(documentation);
        updateProgress();
      }

      // --- LEVEL 4: Operational Documentation ---
      if (docLevels.ops) {
        addLog('سطح ۴: تولید مستندات عملیاتی (DevOps)...', 'info');
        const opsPrompt = `Config Files:\n${configContents.join('\n')}\n\n(No source code provided, infer from configs)`;
        const opsContent = await generateCompletion(config, opsPrompt, PROMPT_LEVEL_4_OPS);
        documentation += `## 🚀 راهنمای عملیاتی و دیپلوی\n\n${opsContent}\n\n---\n\n`;
        setGeneratedDoc(documentation);
        updateProgress();
      }

      // --- LEVEL 5: Sequence Diagram (NEW) ---
      if (docLevels.sequence) {
        addLog('سطح ۵: ترسیم نمودار توالی (Sequence Diagram)...', 'info');
        // We pass global context + a hint to look at source files structure implicitly
        const sequenceContext = `Project Structure:\n${fileTree}\n\nConfigs:\n${configContents.join('\n')}\n\nPlease infer the main application flow based on file names and typical patterns.`;
        const seqContent = await generateCompletion(config, sequenceContext, PROMPT_LEVEL_5_SEQUENCE);
        documentation += `## 🔄 نمودار توالی فرآیندها (Sequence Diagram)\n\n${seqContent}\n\n---\n\n`;
        setGeneratedDoc(documentation);
        updateProgress();
      }

      // --- LEVEL 2: Code Documentation ---
      if (docLevels.code) {
        addLog(`سطح ۲: تحلیل جزئی ${sourceFiles.length} فایل کد...`, 'info');
        documentation += `## 💻 مستندات کدها\n\n`;
        
        for (const file of sourceFiles) {
          addLog(`در حال تحلیل ${file.path}...`, 'info');
          const filePrompt = `File Path: ${file.path}\n\nCode Content:\n\`\`\`\n${file.content}\n\`\`\``;
          const fileAnalysis = await generateCompletion(config, filePrompt, PROMPT_LEVEL_2_CODE);
          
          // Use <details> for cleaner UI in Markdown
          documentation += `<details>\n<summary><strong>📄 ${file.path}</strong></summary>\n\n${fileAnalysis}\n\n</details>\n\n`;
          setGeneratedDoc(documentation);
          updateProgress(); 
        }
      }

      addLog('تولید تمامی سطوح مستندات با موفقیت انجام شد!', 'success');
      setProgress(100);
      updateChatContext(documentation);

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
        h1: ({node, ...props}: any) => <h1 className="text-2xl font-bold text-blue-300 my-4 border-b border-gray-700 pb-2" {...props} />,
        h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-white mt-8 mb-4 flex items-center gap-2" {...props} />,
        h3: ({node, ...props}: any) => <h3 className="text-lg font-semibold text-blue-200 mt-6 mb-2" {...props} />,
        p: ({node, ...props}: any) => <p className="text-gray-300 leading-7 mb-3 text-justify" {...props} />,
        ul: ({node, ...props}: any) => <ul className="list-disc list-outside mr-6 space-y-1 mb-3 text-gray-300" {...props} />,
        ol: ({node, ...props}: any) => <ol className="list-decimal list-outside mr-6 space-y-1 mb-3 text-gray-300" {...props} />,
        table: ({node, ...props}: any) => <div className="overflow-x-auto my-4 border border-gray-700 rounded"><table className="w-full text-right" {...props} /></div>,
        thead: ({node, ...props}: any) => <thead className="bg-gray-800 text-gray-100" {...props} />,
        th: ({node, ...props}: any) => <th className="px-4 py-2 border-b border-gray-600 font-bold text-blue-300" {...props} />,
        td: ({node, ...props}: any) => <td className="px-4 py-2 border-b border-gray-700/50" {...props} />,
        code: ({node, inline, className, children, ...props}: any) => {
          const match = /language-(\w+)/.exec(className || '');
          const isMermaid = match && match[1] === 'mermaid';
          
          if (!inline && isMermaid) {
             return <MermaidRenderer code={String(children).replace(/\n$/, '')} />;
          }

          return inline ? (
            <code className="bg-gray-800 text-pink-300 px-1.5 py-0.5 rounded text-sm font-mono border border-gray-700" {...props}>{children}</code>
          ) : (
            <div className="my-3 dir-ltr"><code className="block bg-[#1e1e1e] p-3 rounded-lg overflow-x-auto text-sm font-mono text-gray-300 border border-gray-700" {...props}>{children}</code></div>
          )
        },
        // Custom summary/details styling
        details: ({node, ...props}: any) => <details className="bg-gray-800/50 border border-gray-700 rounded-lg mb-2 overflow-hidden open:bg-gray-800 transition-all" {...props} />,
        summary: ({node, ...props}: any) => <summary className="cursor-pointer p-3 font-mono text-sm hover:bg-gray-700/50 select-none text-blue-300 outline-none" {...props} />
      }}
    >
      {content}
    </ReactMarkdown>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
      {/* Left Panel: Controls */}
      <div className="bg-gray-800 rounded-xl p-6 shadow-lg border border-gray-700 flex flex-col gap-6">
        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Folder className="w-5 h-5 text-blue-400" />
            ۱. انتخاب پوشه پروژه
          </h2>
          <div className="relative">
            <input
              type="file"
              // @ts-ignore
              webkitdirectory=""
              directory=""
              onChange={handleDirectorySelect}
              className="block w-full text-sm text-gray-400
                file:ml-4 file:py-2 file:px-4
                file:rounded-full file:border-0
                file:text-sm file:font-semibold
                file:bg-blue-600 file:text-white
                hover:file:bg-blue-700
                cursor-pointer border border-gray-600 rounded-lg bg-gray-900"
              disabled={isProcessing}
            />
          </div>
          {files && (
            <p className="mt-2 text-sm text-green-400">
              {files.length} فایل شناسایی شد
            </p>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Layers className="w-5 h-5 text-purple-400" />
            ۲. سطوح مستندسازی
          </h2>
          <div className="grid grid-cols-2 gap-3">
             <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${docLevels.root ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                <input type="checkbox" checked={docLevels.root} onChange={e => setDocLevels({...docLevels, root: e.target.checked})} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 rounded focus:ring-blue-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">ریشه (README)</span>
                  <span className="text-[10px] text-gray-400">معرفی و نصب</span>
                </div>
             </label>
             <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${docLevels.arch ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                <input type="checkbox" checked={docLevels.arch} onChange={e => setDocLevels({...docLevels, arch: e.target.checked})} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 rounded focus:ring-blue-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">معماری</span>
                  <span className="text-[10px] text-gray-400">دیاگرام و پترن‌ها</span>
                </div>
             </label>
             <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${docLevels.sequence ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                <input type="checkbox" checked={docLevels.sequence} onChange={e => setDocLevels({...docLevels, sequence: e.target.checked})} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 rounded focus:ring-blue-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">نمودار توالی</span>
                  <span className="text-[10px] text-gray-400">مخصوص مدیر محصول</span>
                </div>
             </label>
             <label className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${docLevels.ops ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                <input type="checkbox" checked={docLevels.ops} onChange={e => setDocLevels({...docLevels, ops: e.target.checked})} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 rounded focus:ring-blue-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">عملیاتی (DevOps)</span>
                  <span className="text-[10px] text-gray-400">دیپلوی و کانفیگ</span>
                </div>
             </label>
             <label className={`col-span-2 flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${docLevels.code ? 'bg-blue-900/30 border-blue-500' : 'bg-gray-900 border-gray-700 hover:border-gray-600'}`}>
                <input type="checkbox" checked={docLevels.code} onChange={e => setDocLevels({...docLevels, code: e.target.checked})} className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-500 rounded focus:ring-blue-500" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-white">سطح کد (تحلیل کامل)</span>
                  <span className="text-[10px] text-gray-400">تحلیل فایل به فایل (زمان‌بر)</span>
                </div>
             </label>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-400" />
            ۳. تنظیمات مدل زبانی
          </h2>
          <div className="space-y-3">
             <input 
                type="text" 
                value={config.baseUrl} 
                onChange={e => setConfig({...config, baseUrl: e.target.value})}
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm dir-ltr text-left placeholder-gray-500"
                placeholder="URL (http://localhost:11434)"
             />
             <input 
                type="text" 
                list="model-suggestions"
                value={config.model} 
                onChange={e => setConfig({...config, model: e.target.value})}
                className="w-full bg-gray-900 border border-gray-600 rounded p-2 text-white text-sm dir-ltr text-left placeholder-gray-500"
                placeholder="Model Name (e.g., qwen2.5-coder:14b)"
             />
             <datalist id="model-suggestions">
                <option value="qwen2.5-coder:14b" />
                <option value="qwen2.5-coder:7b" />
                <option value="llama3.1" />
                <option value="gemma2:9b" />
              </datalist>
          </div>
        </div>

        <div>
          <button
            onClick={processRepository}
            disabled={!files || isProcessing}
            className={`w-full py-4 rounded-lg font-bold flex items-center justify-center gap-2 transition-all mb-4
              ${!files || isProcessing 
                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-lg'}`}
          >
            {isProcessing ? <Loader2 className="animate-spin" /> : <Play className="rotate-180" />} 
            {isProcessing ? 'در حال تولید مستندات...' : 'شروع آنالیز'}
          </button>

          {(isProcessing || progress > 0) && (
            <div className="mb-4 animate-in fade-in duration-500">
              <div className="flex justify-between text-xs text-gray-400 mb-2 font-mono">
                <span>پیشرفت پروژه</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-900 rounded-full h-3 overflow-hidden border border-gray-700 relative">
                <div 
                  className="bg-gradient-to-r from-blue-500 to-purple-500 h-full rounded-full transition-all duration-300 ease-out shadow-[0_0_12px_rgba(59,130,246,0.6)] relative" 
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-900 rounded-lg p-4 border border-gray-700 font-mono text-xs max-h-48">
          <div className="text-gray-400 mb-2 font-bold sticky top-0 bg-gray-900 pb-2 border-b border-gray-800">گزارش پردازش:</div>
          {logs.length === 0 && <span className="text-gray-600 italic">لاگ‌ها اینجا نمایش داده می‌شوند...</span>}
          {logs.map((log, i) => (
            <div key={i} className={`mb-1 ${
              log.type === 'error' ? 'text-red-400' : 
              log.type === 'success' ? 'text-green-400' : 
              'text-blue-300'
            }`}>
              <span className="opacity-50 text-[10px] ml-2 inline-block dir-ltr">[{log.timestamp}]</span>
              {log.message}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel: Output & Chat */}
      <div className="bg-gray-800 rounded-xl shadow-lg border border-gray-700 flex flex-col h-full overflow-hidden">
        {/* Header Tabs */}
        <div className="flex items-center border-b border-gray-700 px-4 justify-between">
           <div className="flex">
            <button 
              onClick={() => setActiveTab('docs')}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'docs' 
                ? 'border-blue-500 text-white' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileIcon className="w-4 h-4" />
              مستندات
            </button>
            <button 
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-4 text-sm font-bold border-b-2 transition-colors ${
                activeTab === 'chat' 
                ? 'border-green-500 text-white' 
                : 'border-transparent text-gray-400 hover:text-gray-200'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              چت هوشمند
            </button>
           </div>
           
           {hasContext && (
             <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 bg-green-900/30 border border-green-800 rounded text-[10px] text-green-400 animate-in fade-in">
                <Database className="w-3 h-3" />
                مستندات در حافظه
             </div>
           )}
        </div>

        {/* --- DOCS TAB CONTENT --- */}
        {activeTab === 'docs' && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-center p-4 border-b border-gray-700 gap-4 bg-gray-800/50">
               <div className="flex flex-wrap items-center gap-2 w-full justify-between">
                <div className="flex gap-2">
                  <input 
                    type="file" 
                    accept=".md,.markdown" 
                    ref={importInputRef} 
                    className="hidden" 
                    onChange={handleImportMarkdown}
                  />
                  <button 
                    onClick={() => importInputRef.current?.click()}
                    className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded flex items-center gap-2 transition-colors border border-gray-600"
                    title="بارگذاری فایل Markdown"
                  >
                    <Upload className="w-4 h-4" /> <span className="hidden sm:inline">ایمپورت</span>
                  </button>

                  {generatedDoc && (
                    <button onClick={downloadMarkdown} className="text-sm bg-gray-700 hover:bg-gray-600 px-3 py-2 rounded flex items-center gap-2 transition-colors border border-gray-600">
                      <Download className="w-4 h-4" /> <span className="hidden sm:inline">دانلود</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2 bg-gray-900 p-1 rounded-lg border border-gray-600">
                  <button 
                    onClick={() => setViewMode('preview')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all ${
                      viewMode === 'preview' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setViewMode('raw')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded text-sm transition-all ${
                      viewMode === 'raw' ? 'bg-purple-600 text-white shadow' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <Code className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-gray-900 p-6 overflow-y-auto text-gray-300">
              {!generatedDoc ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-600 italic gap-2">
                  <Folder className="w-12 h-12 opacity-20" />
                  <span>پیش‌نمایش مستندات اینجا نمایش داده می‌شود...</span>
                </div>
              ) : viewMode === 'raw' ? (
                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap">{generatedDoc}</pre>
              ) : (
                <div className="prose prose-invert prose-blue max-w-none dir-rtl">
                  <MarkdownRenderer content={generatedDoc} />
                </div>
              )}
            </div>
          </>
        )}

        {/* --- CHAT TAB CONTENT --- */}
        {activeTab === 'chat' && (
           <div className="flex flex-col h-full bg-gray-900">
             {/* Chat History */}
             <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
               {chatMessages.filter(m => m.role !== 'system').length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-4 opacity-50">
                    <Bot className="w-16 h-16" />
                    <p className="text-center">سوالات برنامه‌نویسی خود را بپرسید.<br/>مدل فعلی: <span className="font-mono text-blue-400">{config.model}</span></p>
                    {!hasContext && (
                      <p className="text-xs text-yellow-500 mt-2 bg-yellow-900/20 px-3 py-1 rounded">
                        برای پاسخ‌دهی دقیق، لطفا ابتدا آنالیز کنید یا فایل مستندات را ایمپورت کنید.
                      </p>
                    )}
                 </div>
               ) : (
                 chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                   <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                     <div className={`max-w-[85%] rounded-2xl p-4 ${
                       msg.role === 'user' 
                       ? 'bg-blue-600 text-white rounded-br-none' 
                       : 'bg-gray-800 border border-gray-700 text-gray-200 rounded-bl-none'
                     }`}>
                       <div className="flex items-center gap-2 mb-2 opacity-70 text-xs border-b border-white/10 pb-1">
                          {msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3" />}
                          <span>{msg.role === 'user' ? 'شما' : config.model}</span>
                       </div>
                       {msg.role === 'user' ? (
                         <div className="whitespace-pre-wrap">{msg.content}</div>
                       ) : (
                         <div className="prose prose-invert prose-sm max-w-none dir-rtl">
                           <MarkdownRenderer content={msg.content} />
                         </div>
                       )}
                     </div>
                   </div>
                 ))
               )}
               {isChatLoading && (
                 <div className="flex justify-end">
                   <div className="bg-gray-800 border border-gray-700 rounded-2xl rounded-bl-none p-4 flex items-center gap-3">
                     <Loader2 className="w-4 h-4 animate-spin text-green-400" />
                     <span className="text-gray-400 text-sm animate-pulse">در حال نوشتن...</span>
                   </div>
                 </div>
               )}
             </div>

             {/* Chat Input */}
             <div className="p-4 bg-gray-800 border-t border-gray-700">
               <div className="relative">
                 <textarea
                   value={chatInput}
                   onChange={(e) => setChatInput(e.target.value)}
                   onKeyDown={handleKeyDown}
                   placeholder={hasContext ? "سوال در مورد این پروژه..." : "سوال عمومی خود را بپرسید..."}
                   className="w-full bg-gray-900 border border-gray-600 rounded-xl p-3 pl-12 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 resize-none h-14 max-h-32 text-sm"
                   disabled={isChatLoading}
                 />
                 <button
                   onClick={handleSendMessage}
                   disabled={!chatInput.trim() || isChatLoading}
                   className={`absolute left-2 top-2 p-2 rounded-lg transition-colors ${
                     !chatInput.trim() || isChatLoading
                     ? 'text-gray-600 cursor-not-allowed'
                     : 'bg-blue-600 text-white hover:bg-blue-500'
                   }`}
                 >
                   <Send className="w-4 h-4 rotate-180" />
                 </button>
               </div>
               <div className="text-[10px] text-gray-500 mt-2 text-center flex justify-center items-center gap-2">
                 <span>پاسخ‌ها توسط مدل محلی تولید می‌شوند.</span>
                 {hasContext && <span className="text-green-500 font-bold">(حالت پروژه محور فعال است)</span>}
               </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default BrowserGenerator;