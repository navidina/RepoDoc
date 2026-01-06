

import React, { useState, useRef, useEffect } from 'react';
import { File as FileIcon, Folder, Play, Loader2, Download, Info, Eye, Code, Upload, MessageSquare, Send, Bot, User, Database, Layers, Zap, LayoutTemplate, BrainCircuit, Github, BarChart3, Grip, Hash } from 'lucide-react';
import { OllamaConfig } from '../types';
import { DEFAULT_MODEL, OLLAMA_DEFAULT_URL } from '../utils/constants';
import { LocalVectorStore } from '../services/vectorStore';

// Custom Hooks
import { useRepoProcessor } from '../hooks/useRepoProcessor';
import { useChat } from '../hooks/useChat';

// Components
import MarkdownRenderer from './MarkdownRenderer';

const BrowserGenerator: React.FC = () => {
  // --- Configuration & Input State ---
  const [config, setConfig] = useState<OllamaConfig>({
    baseUrl: OLLAMA_DEFAULT_URL,
    model: DEFAULT_MODEL,
    embeddingModel: 'nomic-embed-text' 
  });
  const [inputType, setInputType] = useState<'local' | 'github'>('local');
  const [files, setFiles] = useState<FileList | null>(null);
  const [githubUrl, setGithubUrl] = useState('');
  
  const [docLevels, setDocLevels] = useState({
    root: true, code: true, arch: true, ops: false, sequence: true, 
    api: false, erd: false, classDiagram: false, infra: false    
  });

  // --- UI State ---
  const [viewMode, setViewMode] = useState<'raw' | 'preview'>('preview'); 
  const [activeTab, setActiveTab] = useState<'docs' | 'chat'>('docs');
  const importInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const vectorStoreRef = useRef<LocalVectorStore | null>(null);

  // --- Hooks ---
  const { logs, isProcessing, progress, generatedDoc, setGeneratedDoc, hasContext, setHasContext, processRepository, stats } = useRepoProcessor();
  const { chatMessages, chatInput, setChatInput, isChatLoading, isRetrieving, handleSendMessage } = useChat(config, vectorStoreRef, hasContext);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  // --- Handlers ---
  const handleStartProcessing = () => {
    processRepository({ config, inputType, files, githubUrl, docLevels, vectorStoreRef });
    setActiveTab('docs');
    setViewMode('preview');
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) setFiles(e.target.files);
  };

  const handleImportMarkdown = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setGeneratedDoc(event.target?.result as string);
      setHasContext(true);
      if (importInputRef.current) importInputRef.current.value = '';
    };
    reader.readAsText(file);
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // --- Creative Stats Widget ---
  const StatsWidget = () => {
    if (!stats || stats.length === 0) return null;

    const totalLines = stats.reduce((acc, curr) => acc + curr.lines, 0);

    return (
      <div className="bg-gradient-to-br from-white to-slate-50 p-6 rounded-2xl border border-slate-200 shadow-sm mb-8 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="flex items-center justify-between mb-5">
           <div className="flex items-center gap-2">
             <div className="bg-indigo-100 p-2 rounded-xl text-indigo-600">
               <BarChart3 className="w-5 h-5" />
             </div>
             <div>
               <h3 className="text-lg font-bold text-slate-800">DNA پروژه</h3>
               <p className="text-xs text-slate-500 font-medium tracking-wide">ترکیب زبان‌ها و خطوط کد</p>
             </div>
           </div>
           <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200">
             <Hash className="w-4 h-4 text-slate-500" />
             <span className="text-xs font-bold text-slate-600 dir-ltr">{totalLines.toLocaleString()} LOC</span>
           </div>
        </div>
        
        {/* Creative Progress Bar */}
        <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex mb-6 shadow-inner">
          {stats.map((stat, idx) => (
            <div 
              key={stat.lang}
              style={{ width: `${stat.percent}%`, backgroundColor: stat.color }}
              className="h-full transition-all duration-1000 ease-out hover:opacity-80 relative group first:rounded-l-full last:rounded-r-full"
              title={`${stat.lang}: ${stat.lines} lines`}
            />
          ))}
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.lang} className="bg-white p-3 rounded-xl border border-slate-100 shadow-sm flex items-center justify-between hover:shadow-md transition-shadow group">
              <div className="flex items-center gap-2.5 overflow-hidden">
                <div 
                  className="w-3 h-3 rounded-full shrink-0 group-hover:scale-125 transition-transform" 
                  style={{ backgroundColor: stat.color }}
                />
                <span className="font-bold text-sm text-slate-700 truncate">{stat.lang}</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] text-slate-400 font-medium dir-ltr">{stat.lines.toLocaleString()} Lines</span>
                <span className="text-xs font-bold text-slate-800 dir-ltr">{stat.percent}%</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 h-full">
      {/* --- LEFT PANEL: Sidebar Controls --- */}
      <div className="xl:col-span-4 flex flex-col gap-6 h-full overflow-y-auto pr-1">
        
        {/* Source Selection Widget */}
        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center justify-between">
             <span className="flex items-center gap-3">
               <div className="bg-blue-100 p-2 rounded-xl"><Folder className="w-5 h-5 text-blue-600" /></div>
               انتخاب منبع کد
             </span>
             {files && inputType === 'local' && <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full font-bold">{files.length} فایل</span>}
          </h2>
          
          <div className="flex bg-slate-100 p-1 rounded-xl mb-4">
            <button onClick={() => setInputType('local')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${inputType === 'local' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
               <Folder className="w-4 h-4" /> پوشه محلی
            </button>
            <button onClick={() => setInputType('github')} className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition-all ${inputType === 'github' ? 'bg-white shadow-sm text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}>
               <Github className="w-4 h-4" /> گیت‌هاب
            </button>
          </div>

          {inputType === 'local' ? (
            <div className="relative group">
              <input type="file" 
                // @ts-ignore
                webkitdirectory="" directory="" onChange={handleDirectorySelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" disabled={isProcessing} 
              />
              <div className={`border-2 border-dashed rounded-2xl p-8 transition-all text-center group-hover:border-blue-400 group-hover:bg-blue-50/50 ${files ? 'border-green-300 bg-green-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
                <div className="bg-white p-3 rounded-full shadow-sm w-12 h-12 mx-auto flex items-center justify-center mb-3 text-blue-500 group-hover:scale-110 transition-transform"><Upload className="w-6 h-6" /></div>
                <p className="text-sm font-bold text-slate-700 mb-1">{files ? 'پوشه انتخاب شد' : 'انتخاب پوشه کد'}</p>
                <p className="text-xs text-slate-400">کلیک کنید یا درگ کنید</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Github className="absolute right-3 top-3 w-5 h-5 text-slate-400" />
                <input type="text" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="https://github.com/username/repo" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 pr-10 text-slate-700 text-sm dir-ltr text-left outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed bg-blue-50 text-blue-600 p-2 rounded-lg"><Info className="w-3 h-3 inline ml-1" /> نکته: برای ریپازیتوری‌های عمومی، فایل‌های اصلی و کانفیگ دانلود و تحلیل می‌شوند.</p>
            </div>
          )}
        </div>

        {/* Levels Widget */}
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
                  docLevels[level.id] ? 'bg-slate-900 border-slate-900 shadow-lg shadow-slate-900/10' : 'bg-white border-slate-100 hover:border-slate-300'
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

        {/* LLM Config Widget */}
        <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
             <div className="bg-orange-100 p-2 rounded-xl"><Zap className="w-5 h-5 text-orange-600" /></div>
             پیکربندی هوش مصنوعی
          </h2>
          <div className="space-y-4">
             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">آدرس سرور Ollama</label>
               <input type="text" value={config.baseUrl} onChange={e => setConfig({...config, baseUrl: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm dir-ltr text-left outline-none focus:ring-2 focus:ring-blue-500" placeholder="http://localhost:11434" />
             </div>
             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 block mr-1">مدل تولید متن (Main)</label>
               <input type="text" list="model-suggestions" value={config.model} onChange={e => setConfig({...config, model: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm dir-ltr text-left outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., qwen2.5-coder:14b" />
             </div>
             <div>
               <label className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1 mr-1">مدل Embedding (RAG)</label>
               <input type="text" list="embed-suggestions" value={config.embeddingModel} onChange={e => setConfig({...config, embeddingModel: e.target.value})} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-slate-700 text-sm dir-ltr text-left outline-none focus:ring-2 focus:ring-blue-500" placeholder="e.g., nomic-embed-text" />
             </div>
             <datalist id="model-suggestions">
                <option value="qwen2.5-coder:14b" /><option value="qwen2.5-coder:7b" /><option value="llama3.1" /><option value="gemma2:9b" />
              </datalist>
              <datalist id="embed-suggestions">
                <option value="nomic-embed-text" /><option value="mxbai-embed-large" /><option value="snowflake-arctic-embed" />
              </datalist>
          </div>
        </div>

        {/* Action Button & Progress */}
        <div>
          <button onClick={handleStartProcessing} disabled={(inputType === 'local' && !files) || (inputType === 'github' && !githubUrl) || isProcessing} className={`w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 active:scale-95 text-lg ${(inputType === 'local' && !files) || (inputType === 'github' && !githubUrl) || isProcessing ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none' : 'bg-slate-900 text-white shadow-slate-900/30'}`}>
            {isProcessing ? <Loader2 className="animate-spin" /> : <Play className="fill-current" />} 
            {isProcessing ? 'در حال تحلیل...' : 'شروع آنالیز جامع'}
          </button>
          {(isProcessing || progress > 0) && (
            <div className="mt-6 bg-white p-4 rounded-2xl shadow-soft">
              <div className="flex justify-between text-xs text-slate-500 mb-2 font-bold px-1"><span>پیشرفت کلی</span><span className="text-blue-600">{progress}%</span></div>
              <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden"><div className="bg-gradient-to-r from-blue-400 to-indigo-500 h-full rounded-full transition-all duration-500 ease-out relative" style={{ width: `${progress}%` }}><div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]"></div></div></div>
            </div>
          )}
        </div>

        {/* Logs */}
        <div className="flex-1 overflow-y-auto bg-slate-50 rounded-[2rem] p-5 border border-slate-100 font-sans text-xs min-h-[150px] shadow-inner-light">
          <div className="text-slate-400 mb-3 font-bold sticky top-0 bg-slate-50 pb-2 border-b border-slate-200 flex items-center gap-2"><Info className="w-3 h-3" /> گزارش لحظه‌ای</div>
          {logs.length === 0 && <span className="text-slate-400 italic pl-2">منتظر شروع عملیات...</span>}
          <div className="space-y-2">
            {logs.map((log, i) => (
              <div key={i} className={`flex items-start gap-2 ${log.type === 'error' ? 'text-red-500' : log.type === 'success' ? 'text-emerald-600' : 'text-slate-600'}`}>
                <span className="opacity-40 text-[10px] whitespace-nowrap dir-ltr font-sans bg-slate-200 px-1 rounded mt-0.5">{log.timestamp}</span><span className="leading-relaxed">{log.message}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* --- RIGHT PANEL: Content & Chat --- */}
      <div className="xl:col-span-8 bg-white rounded-[2.5rem] shadow-soft border border-white flex flex-col h-full overflow-hidden relative">
        <div className="flex items-center px-8 pt-8 pb-4 justify-between bg-white z-10">
           <div className="flex bg-slate-100/80 p-1.5 rounded-2xl">
            <button onClick={() => setActiveTab('docs')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'docs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}><FileIcon className="w-4 h-4" /> مستندات</button>
            <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'chat' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'}`}><MessageSquare className="w-4 h-4" /> چت هوشمند</button>
           </div>
           {hasContext && (
             <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-100 rounded-xl text-xs text-emerald-700 font-bold animate-in fade-in"><BrainCircuit className="w-3 h-3" /> RAG Active</div>
           )}
        </div>
        <div className="h-px bg-slate-100 mx-8"></div>

        {/* DOCS TAB */}
        {activeTab === 'docs' && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-center px-8 py-4 gap-4 bg-white">
               <div className="flex flex-wrap items-center gap-3 w-full justify-between">
                <div className="flex gap-3">
                  <input type="file" accept=".md,.markdown" ref={importInputRef} className="hidden" onChange={handleImportMarkdown} />
                  <button onClick={() => importInputRef.current?.click()} className="text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-slate-200 shadow-sm"><Upload className="w-4 h-4" /> <span className="hidden sm:inline">ایمپورت</span></button>
                  {generatedDoc && (<button onClick={downloadMarkdown} className="text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20"><Download className="w-4 h-4" /> <span className="hidden sm:inline">دانلود MD</span></button>)}
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setViewMode('preview')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'preview' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Eye className="w-3 h-3" /> نمایش</button>
                  <button onClick={() => setViewMode('raw')} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${viewMode === 'raw' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Code className="w-3 h-3" /> کد</button>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white px-8 pb-8 overflow-y-auto">
              {!generatedDoc ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-4">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center"><LayoutTemplate className="w-10 h-10" /></div>
                  <span className="font-medium">پیش‌نمایش مستندات اینجا نمایش داده می‌شود...</span>
                </div>
              ) : viewMode === 'raw' ? (
                <pre className="font-mono text-sm leading-relaxed whitespace-pre-wrap bg-slate-900 text-slate-300 p-6 rounded-2xl dir-ltr shadow-inner shadow-black/50">{generatedDoc}</pre>
              ) : (
                <div className="prose prose-slate max-w-none dir-rtl">
                  {/* Creative Stats Widget Rendered Here */}
                  <StatsWidget />
                  <MarkdownRenderer content={generatedDoc} />
                </div>
              )}
            </div>
          </>
        )}

        {/* CHAT TAB */}
        {activeTab === 'chat' && (
           <div className="flex flex-col h-full bg-slate-50/50">
             <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
               {chatMessages.filter(m => m.role !== 'system').length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-6 opacity-60">
                    <div className="w-20 h-20 bg-white rounded-3xl shadow-soft flex items-center justify-center"><Bot className="w-10 h-10 text-slate-300" /></div>
                    <div className="text-center"><p className="font-bold text-slate-600 text-lg">دستیار هوشمند پروژه</p><p className="text-sm mt-1">مدل فعال: <span className="font-mono text-blue-500 bg-blue-50 px-2 py-0.5 rounded">{config.model}</span></p></div>
                 </div>
               ) : (
                 chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                   <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}>
                     <div className={`max-w-[85%] rounded-[1.5rem] p-5 shadow-sm ${msg.role === 'user' ? 'bg-slate-900 text-white rounded-br-none shadow-slate-900/10' : 'bg-white border border-slate-100 text-slate-700 rounded-bl-none shadow-soft'}`}>
                       <div className="flex items-center gap-2 mb-3 opacity-70 text-xs pb-2 border-b border-white/10">{msg.role === 'user' ? <User className="w-3 h-3" /> : <Bot className="w-3 h-3 text-blue-500" />}<span className="font-bold">{msg.role === 'user' ? 'شما' : 'دستیار هوشمند'}</span></div>
                       {msg.role === 'user' ? <div className="whitespace-pre-wrap leading-relaxed">{msg.content}</div> : <div className="prose prose-slate prose-sm max-w-none dir-rtl"><MarkdownRenderer content={msg.content} /></div>}
                     </div>
                   </div>
                 ))
               )}
               {(isChatLoading || isRetrieving) && (
                 <div className="flex justify-end"><div className="bg-white border border-slate-100 rounded-[1.5rem] rounded-bl-none p-4 flex items-center gap-3 shadow-soft"><Loader2 className="w-4 h-4 animate-spin text-blue-500" /><span className="text-slate-500 text-sm font-medium">{isRetrieving ? 'جستجو در پایگاه دانش (RAG)...' : 'در حال تایپ...'}</span></div></div>
               )}
             </div>
             <div className="p-6 bg-white border-t border-slate-100">
               <div className="relative shadow-soft rounded-2xl">
                 <textarea value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={handleKeyDown} placeholder={hasContext ? "سوال خود را درباره پروژه بپرسید..." : "پیام خود را بنویسید..."} className="w-full bg-slate-50 border-0 rounded-2xl p-4 pl-14 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-100 resize-none h-16 max-h-32 text-sm leading-relaxed" disabled={isChatLoading || isRetrieving} />
                 <button onClick={handleSendMessage} disabled={!chatInput.trim() || isChatLoading || isRetrieving} className={`absolute left-2 top-2 bottom-2 aspect-square rounded-xl transition-all flex items-center justify-center ${!chatInput.trim() || isChatLoading || isRetrieving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-blue-600 text-white hover:bg-blue-500 shadow-lg shadow-blue-600/20'}`}><Send className="w-5 h-5 rotate-180" /></button>
               </div>
               <div className="text-[10px] text-slate-400 mt-3 text-center flex justify-center items-center gap-2 font-medium"><span>Powered by Local LLM</span>{hasContext && <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1"><Database className="w-3 h-3" /> RAG Enabled</span>}</div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default BrowserGenerator;