import React, { useState, useRef, useEffect } from 'react';
import { File as FileIcon, Folder, Play, Loader2, Download, Info, Eye, Code, Upload, MessageSquare, Send, Bot, User, Database, Layers, Zap, LayoutTemplate, BrainCircuit, Github, BarChart3, Grip, Hash, Sparkles, Command, Box, Server, Terminal, Activity, PieChart, CheckCircle2, FileText, Cpu, Search, PenTool, ArrowRight } from 'lucide-react';
import { OllamaConfig, ProcessingLog } from '../types';
import { LocalVectorStore } from '../services/vectorStore';
import { IGNORED_DIRS, ALLOWED_EXTENSIONS } from '../utils/constants';

// Custom Hooks
import { useRepoProcessor } from '../hooks/useRepoProcessor';
import { useChat } from '../hooks/useChat';

// Components
import MarkdownRenderer from './MarkdownRenderer';

interface BrowserGeneratorProps {
  config: OllamaConfig;
}

const BrowserGenerator: React.FC<BrowserGeneratorProps> = ({ config }) => {
  // --- Input State ---
  const [inputType, setInputType] = useState<'local' | 'github'>('local');
  const [files, setFiles] = useState<FileList | null>(null);
  const [scanStats, setScanStats] = useState<{ total: number, valid: number } | null>(null);
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
  const logsEndRef = useRef<HTMLDivElement>(null);
  const vectorStoreRef = useRef<LocalVectorStore | null>(null);

  // --- Hooks ---
  const { logs, isProcessing, progress, generatedDoc, setGeneratedDoc, hasContext, setHasContext, processRepository, stats } = useRepoProcessor();
  const { chatMessages, chatInput, setChatInput, isChatLoading, isRetrieving, handleSendMessage } = useChat(config, vectorStoreRef, hasContext);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages, activeTab]);

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // --- Handlers ---
  const handleStartProcessing = () => {
    processRepository({ config, inputType, files, githubUrl, docLevels, vectorStoreRef });
    setActiveTab('docs');
    setViewMode('preview');
  };

  const handleDirectorySelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
       const fileList = e.target.files;
       let validCount = 0;
       
       // Quick Scan using constants
       Array.from(fileList).forEach(file => {
           const filePath = file.webkitRelativePath || file.name;
           const pathParts = filePath.split('/');
           const hasIgnoredDir = pathParts.some(part => IGNORED_DIRS.has(part));
           const extension = '.' + file.name.split('.').pop()?.toLowerCase();
           
           if (!hasIgnoredDir && ALLOWED_EXTENSIONS.has(extension)) {
               validCount++;
           }
       });

       setFiles(fileList);
       setScanStats({ total: fileList.length, valid: validCount });
    }
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

  // --- Creative Stats Widget (Pie Chart) ---
  const StatsWidget = () => {
    if (!stats || stats.length === 0) return null;

    const totalLines = stats.reduce((acc, curr) => acc + curr.lines, 0);
    const radius = 70;
    const circumference = 2 * Math.PI * radius;
    let accumulatedPercent = 0;

    return (
      <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-soft mb-8 relative overflow-hidden">
        {/* Title Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-8">
           <div className="flex items-center gap-4">
             <div className="bg-brand-50 p-3 rounded-2xl text-brand-600 border border-brand-100">
               <PieChart className="w-6 h-6" />
             </div>
             <div>
               <h3 className="text-xl font-bold text-slate-800">تحلیل آماری پروژه</h3>
               <p className="text-sm text-slate-400 font-medium">پراکندگی زبان‌ها و حجم کد</p>
             </div>
           </div>
           <div className="mt-4 md:mt-0 flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 shadow-sm">
             <Hash className="w-4 h-4 text-slate-400" />
             <span className="text-sm font-bold text-slate-700 dir-ltr">{totalLines.toLocaleString()} Lines</span>
           </div>
        </div>

        <div className="flex flex-col md:flex-row items-center justify-center gap-12">
            {/* Donut Chart */}
            <div className="relative w-64 h-64 flex items-center justify-center shrink-0">
                <svg viewBox="0 0 200 200" className="w-full h-full transform -rotate-90">
                    {stats.map((stat, idx) => {
                        const strokeDasharray = `${(stat.percent / 100) * circumference} ${circumference}`;
                        const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                        accumulatedPercent += stat.percent;

                        return (
                            <circle
                                key={idx}
                                cx="100"
                                cy="100"
                                r={radius}
                                fill="transparent"
                                stroke={stat.color}
                                strokeWidth="25"
                                strokeDasharray={strokeDasharray}
                                strokeDashoffset={strokeDashoffset}
                                className="transition-all duration-1000 ease-out hover:opacity-90"
                            />
                        );
                    })}
                </svg>
                {/* Center Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <span className="text-3xl font-bold text-slate-700">{stats.length}</span>
                     <span className="text-xs text-slate-400 font-medium uppercase">Languages</span>
                </div>
            </div>

            {/* Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
                {stats.map((stat) => (
                    <div key={stat.lang} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 min-w-[140px]">
                        <div className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: stat.color }} />
                        <div className="flex flex-col flex-1">
                            <div className="flex justify-between items-center mb-1">
                                <span className="text-xs font-bold text-slate-700">{stat.lang}</span>
                                <span className="text-[10px] font-bold text-slate-500">{stat.percent}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${stat.percent}%`, backgroundColor: stat.color }}></div>
                            </div>
                            <span className="text-[10px] text-slate-400 mt-1 dir-ltr text-right">{stat.lines.toLocaleString()} LOC</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
      </div>
    );
  };

  // --- Processing HUD (Creative Processing View) ---
  const ProcessingHUD = () => {
    // Determine current phase based on progress and logs
    let currentPhaseIdx = 0;
    const stages = [
      { id: 1, label: 'اسکن فایل‌ها', icon: Search, threshold: 10 },
      { id: 2, label: 'ایندکس RAG', icon: Database, threshold: 30 },
      { id: 3, label: 'تحلیل هوشمند', icon: BrainCircuit, threshold: 70 },
      { id: 4, label: 'تولید مستندات', icon: PenTool, threshold: 100 },
    ];
    
    // Simple logic to highlight stages
    if (progress > 10) currentPhaseIdx = 1;
    if (progress > 30) currentPhaseIdx = 2;
    if (progress > 80) currentPhaseIdx = 3;

    return (
      <div className="bg-[#0F172A] rounded-[2rem] p-6 shadow-2xl border border-slate-800 text-white relative overflow-hidden flex flex-col h-full animate-in fade-in zoom-in-95 duration-500">
        {/* Background Grid & Effects */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] opacity-20"></div>
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-brand-500/20 rounded-full blur-[50px] animate-pulse"></div>
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-accent-pink/20 rounded-full blur-[50px] animate-pulse delay-700"></div>

        {/* Header */}
        <div className="flex items-center justify-between mb-6 relative z-10">
          <div className="flex items-center gap-3">
             <div className="relative">
                <div className="w-3 h-3 bg-emerald-500 rounded-full animate-ping absolute top-0 right-0"></div>
                <div className="w-3 h-3 bg-emerald-500 rounded-full relative"></div>
             </div>
             <div>
                <h3 className="font-bold text-sm tracking-widest text-emerald-400">RAYAN ENGINE ONLINE</h3>
                <p className="text-[10px] text-slate-400 font-mono">Process ID: #{Math.floor(Math.random() * 9999)}</p>
             </div>
          </div>
          <div className="font-mono text-2xl font-bold text-brand-400 drop-shadow-glow">
            {progress}%
          </div>
        </div>

        {/* Pipeline Visualization */}
        <div className="flex items-center justify-between mb-8 relative z-10 px-2">
           {stages.map((stage, idx) => {
             const isActive = idx === currentPhaseIdx;
             const isCompleted = idx < currentPhaseIdx;
             
             return (
               <div key={stage.id} className="flex flex-col items-center gap-2 relative group flex-1">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-500 ${
                    isActive 
                      ? 'bg-brand-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.5)] scale-110 border border-brand-400' 
                      : isCompleted 
                        ? 'bg-slate-800 text-emerald-400 border border-emerald-900/50' 
                        : 'bg-slate-900 text-slate-600 border border-slate-800'
                  }`}>
                     <stage.icon className={`w-5 h-5 ${isActive ? 'animate-pulse' : ''}`} />
                  </div>
                  <span className={`text-[10px] font-bold whitespace-nowrap transition-colors ${isActive ? 'text-white' : 'text-slate-500'}`}>
                    {stage.label}
                  </span>
                  
                  {/* Connector Line */}
                  {idx < stages.length - 1 && (
                    <div className="absolute top-5 right-[60%] w-[calc(100%-20px)] h-0.5 bg-slate-800 -z-10 dir-rtl">
                       <div 
                         className="h-full bg-gradient-to-l from-brand-500 to-transparent transition-all duration-1000"
                         style={{ width: isCompleted ? '100%' : isActive ? '50%' : '0%' }}
                       ></div>
                    </div>
                  )}
               </div>
             );
           })}
        </div>

        {/* Live Terminal Log */}
        <div className="flex-1 bg-black/40 rounded-xl border border-slate-800/50 p-4 font-mono text-xs overflow-hidden flex flex-col relative group">
           <div className="flex items-center gap-2 mb-2 border-b border-slate-800 pb-2">
              <Terminal className="w-3 h-3 text-slate-500" />
              <span className="text-slate-500">System Logs</span>
           </div>
           
           <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar mask-gradient-b">
              {logs.length === 0 && (
                <div className="text-slate-600 italic">Waiting for process start...</div>
              )}
              {logs.map((log, i) => (
                <div key={i} className={`flex gap-2 animate-in slide-in-from-right-2 duration-300 ${
                  log.type === 'error' ? 'text-red-400' :
                  log.type === 'success' ? 'text-emerald-400' :
                  log.type === 'warning' ? 'text-yellow-400' : 'text-blue-300'
                }`}>
                   <span className="text-slate-600 shrink-0">[{log.timestamp}]</span>
                   <span className="break-all font-medium">
                     <span className="mr-2 opacity-50">{'>'}</span>
                     {log.message}
                   </span>
                </div>
              ))}
              <div ref={logsEndRef} />
           </div>

           {/* Scanning Overlay Effect */}
           <div className="absolute inset-0 pointer-events-none bg-gradient-to-b from-transparent via-brand-500/5 to-transparent h-10 w-full animate-scan top-0"></div>
        </div>

        {/* Footer Activity */}
        <div className="mt-4 flex items-center justify-between text-[10px] text-slate-500 font-mono relative z-10">
           <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 animate-bounce" />
              <span>GPU Utilization: {isProcessing ? Math.floor(Math.random() * 30 + 40) : 0}%</span>
           </div>
           <div className="flex items-center gap-2">
              <Server className="w-3 h-3" />
              <span>Local Server: Connected</span>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 h-full">
      {/* --- LEFT PANEL: Sidebar Controls --- */}
      <div className="xl:col-span-4 flex flex-col gap-8 h-full overflow-y-auto pr-1">
        
        {/* Source Selection Widget (Disable when processing) */}
        <div className={`bg-white rounded-[2rem] p-6 shadow-soft border border-white relative overflow-hidden transition-all duration-500 ${isProcessing ? 'opacity-50 grayscale pointer-events-none scale-95' : 'opacity-100'}`}>
           {/* Decorative bg blob */}
           <div className="absolute -top-10 -right-10 w-32 h-32 bg-brand-100 rounded-full blur-3xl opacity-50"></div>
           
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3 relative z-10">
               <div className="bg-brand-100 text-brand-600 p-2.5 rounded-xl shadow-sm"><Folder className="w-5 h-5" /></div>
               منبع پروژه
               {files && inputType === 'local' && <span className="mr-auto text-[10px] bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-bold shadow-sm">{files.length} فایل</span>}
          </h2>
          
          <div className="grid grid-cols-2 gap-2 bg-slate-50 p-1.5 rounded-2xl mb-6 border border-slate-100">
            <button onClick={() => setInputType('local')} className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${inputType === 'local' ? 'bg-white shadow-card text-brand-700' : 'text-slate-400 hover:text-slate-600'}`}>
               <Folder className="w-4 h-4" /> پوشه محلی
            </button>
            <button onClick={() => setInputType('github')} className={`flex items-center justify-center gap-2 py-3 text-xs font-bold rounded-xl transition-all ${inputType === 'github' ? 'bg-white shadow-card text-brand-700' : 'text-slate-400 hover:text-slate-600'}`}>
               <Github className="w-4 h-4" /> گیت‌هاب
            </button>
          </div>

          {inputType === 'local' ? (
            <div className="relative group cursor-pointer">
              <input type="file" 
                // @ts-ignore
                webkitdirectory="" directory="" onChange={handleDirectorySelect} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" disabled={isProcessing} 
              />
              <div className={`border-2 border-dashed rounded-3xl p-8 transition-all text-center group-hover:border-brand-300 group-hover:bg-brand-50/50 relative overflow-hidden flex flex-col items-center justify-center min-h-[240px] ${files ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-slate-50/50'}`}>
                 <div className="absolute inset-0 bg-grid-slate-200/20 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))]"></div>
                
                {files && scanStats ? (
                  <div className="relative z-10 animate-in zoom-in duration-300">
                     <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm">
                        <CheckCircle2 className="w-8 h-8" />
                     </div>
                     <h3 className="text-slate-800 font-bold text-lg mb-2">پوشه آماده پردازش است</h3>
                     <div className="bg-white/60 backdrop-blur-sm rounded-xl p-3 border border-emerald-100/50 shadow-sm inline-flex flex-col items-center gap-1 min-w-[180px]">
                        <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                           <FileText className="w-4 h-4" />
                           <span>{scanStats.valid} فایل کد شناسایی شد</span>
                        </div>
                        <span className="text-[10px] text-slate-400">از مجموع {scanStats.total} فایل</span>
                     </div>
                     <p className="text-xs text-slate-400 mt-4">برای تغییر پوشه کلیک کنید</p>
                  </div>
                ) : (
                  <>
                    <div className="bg-white p-4 rounded-2xl shadow-card w-16 h-16 mx-auto flex items-center justify-center mb-4 text-brand-500 group-hover:scale-110 transition-transform relative z-10">
                        <Upload className="w-8 h-8" />
                    </div>
                    <p className="text-sm font-bold text-slate-700 mb-1 relative z-10">انتخاب پوشه کد</p>
                    <p className="text-xs text-slate-400 relative z-10">کلیک کنید یا پوشه را اینجا رها کنید</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="relative group">
                <Github className="absolute right-4 top-4 w-5 h-5 text-slate-400 group-focus-within:text-brand-500 transition-colors" />
                <input type="text" value={githubUrl} onChange={(e) => setGithubUrl(e.target.value)} placeholder="username/repo" className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 pr-12 text-slate-700 text-sm dir-ltr text-left outline-none focus:ring-2 focus:ring-brand-200 transition-all shadow-inner" />
              </div>
              <div className="text-[10px] text-brand-600 bg-brand-50 p-3 rounded-xl border border-brand-100 flex items-start gap-2 leading-relaxed">
                  <Info className="w-4 h-4 shrink-0 mt-0.5" /> 
                  برای ریپازیتوری‌های عمومی، فایل‌های اصلی به صورت خودکار شناسایی می‌شوند.
              </div>
            </div>
          )}
        </div>

        {/* Levels Widget (Disable when processing) */}
        <div className={`bg-white rounded-[2rem] p-6 shadow-soft border border-white transition-all duration-500 ${isProcessing ? 'opacity-50 grayscale pointer-events-none scale-95' : 'opacity-100'}`}>
          <h2 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-3">
             <div className="bg-accent-pink/10 text-accent-pink p-2.5 rounded-xl shadow-sm"><Layers className="w-5 h-5" /></div>
             سطوح تحلیل و دیاگرام
          </h2>
          <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
             {[
               { id: 'code', label: 'تحلیل کدها', desc: 'بررسی فایل به فایل + خلاصه', icon: Code },
               { id: 'arch', label: 'معماری سیستم', desc: 'دیاگرام و پترن‌ها', icon: Layers },
               { id: 'erd', label: 'دیتابیس (ERD)', desc: 'مدل داده (Prisma/SQL)', icon: Database },
               { id: 'classDiagram', label: 'نمودار کلاس', desc: 'تحلیل شی‌گرایی', icon: Box },
               { id: 'infra', label: 'زیرساخت', desc: 'Docker / Terraform', icon: Server },
               { id: 'sequence', label: 'نمودار توالی', desc: 'سناریوی اصلی', icon: LayoutTemplate },
               { id: 'api', label: 'مستندات API', desc: 'OpenAPI Spec', icon: Zap },
               { id: 'ops', label: 'عملیاتی (DevOps)', desc: 'دیپلوی و کانفیگ', icon: Terminal },
               { id: 'root', label: 'ریشه (README)', desc: 'معرفی و نصب', icon: FileIcon },
             ].map((level) => (
                <label key={level.id} className={`flex items-center justify-between p-4 rounded-2xl border cursor-pointer transition-all duration-300 group relative overflow-hidden ${
                  // @ts-ignore
                  docLevels[level.id] 
                    ? 'bg-[#1E293B] border-slate-800 text-white shadow-lg shadow-slate-900/10 scale-[1.02]' 
                    : 'bg-white border-slate-100 hover:border-brand-200 text-slate-600'
                }`}>
                  <div className="flex items-center gap-4 relative z-10">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center transition-colors ${
                          // @ts-ignore
                          docLevels[level.id] ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-400'
                      }`}>
                          <level.icon className="w-5 h-5" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{level.label}</span>
                        <span className={`text-[10px] ${
                            // @ts-ignore
                            docLevels[level.id] ? 'text-slate-300' : 'text-slate-400'
                        }`}>{level.desc}</span>
                      </div>
                  </div>
                  
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors relative z-10 ${
                    // @ts-ignore
                    docLevels[level.id] ? 'border-brand-400 bg-brand-500' : 'border-slate-200 bg-slate-50'
                  }`}>
                    {/* @ts-ignore */}
                    {docLevels[level.id] && <div className="w-2.5 h-2.5 bg-white rounded-full shadow-sm"></div>}
                  </div>

                  <input type="checkbox" 
                    // @ts-ignore
                    checked={docLevels[level.id]} 
                    // @ts-ignore
                    onChange={e => setDocLevels({...docLevels, [level.id]: e.target.checked})} 
                    className="hidden" 
                  />
                </label>
             ))}
          </div>
        </div>

        {/* Action Button OR Creative HUD */}
        {!isProcessing ? (
          <div className="bg-white rounded-[2rem] p-6 shadow-soft border border-white">
            <button onClick={handleStartProcessing} disabled={(inputType === 'local' && !files) || (inputType === 'github' && !githubUrl) || isProcessing} className={`w-full py-5 rounded-2xl font-bold flex items-center justify-center gap-3 transition-all text-lg relative overflow-hidden group ${(inputType === 'local' && !files) || (inputType === 'github' && !githubUrl) || isProcessing ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-gradient-to-r from-brand-600 to-brand-500 text-white shadow-glow hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]'}`}>
              {!(isProcessing) && <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 rounded-2xl"></div>}
              {isProcessing ? <Loader2 className="animate-spin" /> : <Sparkles className="fill-current" />} 
              <span className="relative">{isProcessing ? 'در حال تحلیل هوشمند...' : 'شروع آنالیز'}</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 min-h-[400px]">
             <ProcessingHUD />
          </div>
        )}

      </div>

      {/* --- RIGHT PANEL: Content & Chat --- */}
      <div className="xl:col-span-8 bg-white rounded-[2.5rem] shadow-soft border border-white flex flex-col h-full overflow-hidden relative z-0">
        
        {/* Top Tab Bar */}
        <div className="flex items-center px-8 pt-8 pb-4 justify-between bg-white z-10 border-b border-slate-100">
           <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
            <button onClick={() => setActiveTab('docs')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'docs' ? 'bg-white text-slate-900 shadow-card' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}><FileIcon className="w-4 h-4" /> مستندات</button>
            <button onClick={() => setActiveTab('chat')} className={`flex items-center gap-2 px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'chat' ? 'bg-white text-brand-700 shadow-card' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100/50'}`}><MessageSquare className="w-4 h-4" /> چت هوشمند</button>
           </div>
           
           {/* RAG Status Indicator */}
           <div className={`hidden sm:flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${hasContext ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-slate-50 text-slate-300 border border-slate-100'}`}>
              <BrainCircuit className="w-4 h-4" /> 
              {hasContext ? 'RAG Connected' : 'No Context'}
           </div>
        </div>

        {/* DOCS TAB */}
        {activeTab === 'docs' && (
          <>
            <div className="flex flex-col sm:flex-row justify-between items-center px-8 py-4 gap-4 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
               <div className="flex flex-wrap items-center gap-3 w-full justify-between">
                <div className="flex gap-3">
                  <input type="file" accept=".md,.markdown" ref={importInputRef} className="hidden" onChange={handleImportMarkdown} />
                  <button onClick={() => importInputRef.current?.click()} className="text-xs font-bold bg-white text-slate-600 hover:bg-slate-50 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all border border-slate-200 shadow-sm"><Upload className="w-4 h-4" /> <span className="hidden sm:inline">آپلود</span></button>
                  {generatedDoc && (<button onClick={downloadMarkdown} className="text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 px-4 py-2.5 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-slate-900/20"><Download className="w-4 h-4" /> <span className="hidden sm:inline">ذخیره</span></button>)}
                </div>
                <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                  <button onClick={() => setViewMode('preview')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'preview' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Eye className="w-3 h-3" /> بصری</button>
                  <button onClick={() => setViewMode('raw')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${viewMode === 'raw' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}><Code className="w-3 h-3" /> کد</button>
                </div>
              </div>
            </div>

            <div className="flex-1 bg-white px-8 pb-8 overflow-y-auto custom-scrollbar">
              {!generatedDoc ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 gap-6">
                  <div className="relative">
                     <div className="absolute inset-0 bg-brand-100 rounded-full blur-xl opacity-50"></div>
                     <div className="w-32 h-32 bg-slate-50 rounded-[2rem] flex items-center justify-center shadow-card relative z-10 border border-slate-100">
                        <LayoutTemplate className="w-12 h-12 text-brand-200" />
                     </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-lg font-bold text-slate-700">مستندات خالی است</h3>
                    <p className="text-sm text-slate-400 mt-2">پروژه را انتخاب کنید و دکمه شروع را بزنید</p>
                  </div>
                </div>
              ) : viewMode === 'raw' ? (
                <pre className="font-mono text-sm leading-loose whitespace-pre-wrap bg-[#1E293B] text-slate-300 p-8 rounded-3xl dir-ltr shadow-inner shadow-black/50 border border-slate-700">{generatedDoc}</pre>
              ) : (
                <div className="prose prose-slate max-w-none dir-rtl prose-headings:font-bold prose-headings:text-slate-800 prose-p:text-slate-600 prose-pre:rounded-2xl prose-pre:shadow-lg prose-img:rounded-2xl">
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
           <div className="flex flex-col h-full bg-[#FAFAFC]">
             <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
               {chatMessages.filter(m => m.role !== 'system').length === 0 ? (
                 <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-8 opacity-70">
                    <div className="w-24 h-24 bg-white rounded-[2rem] shadow-glow flex items-center justify-center border border-white"><Bot className="w-12 h-12 text-brand-500" /></div>
                    <div className="text-center space-y-2">
                        <p className="font-bold text-slate-700 text-xl">چت با کد بیس پروژه</p>
                        <p className="text-sm bg-brand-50 text-brand-600 px-3 py-1 rounded-full inline-block font-mono border border-brand-100">{config.model}</p>
                    </div>
                 </div>
               ) : (
                 chatMessages.filter(m => m.role !== 'system').map((msg, idx) => (
                   <div key={idx} className={`flex w-full ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                     <div className={`flex gap-4 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${msg.role === 'user' ? 'bg-slate-800 text-white' : 'bg-white text-brand-600 border border-brand-100'}`}>
                            {msg.role === 'user' ? <User className="w-5 h-5" /> : <Bot className="w-5 h-5" />}
                        </div>
                        
                        {/* Bubble */}
                        <div className={`p-6 rounded-[2rem] shadow-sm relative group transition-all ${
                            msg.role === 'user' 
                            ? 'bg-slate-800 text-white rounded-tr-none shadow-lg shadow-slate-900/20' 
                            : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none shadow-soft'
                        }`}>
                            <div className="prose prose-sm max-w-none dir-rtl leading-relaxed">
                                {msg.role === 'user' ? msg.content : <MarkdownRenderer content={msg.content} />}
                            </div>
                        </div>
                     </div>
                   </div>
                 ))
               )}
               {(isChatLoading || isRetrieving) && (
                 <div className="flex justify-start w-full">
                    <div className="flex gap-4 max-w-[85%]">
                        <div className="w-10 h-10 rounded-2xl bg-white border border-brand-100 flex items-center justify-center shrink-0 shadow-sm"><Loader2 className="w-5 h-5 animate-spin text-brand-500" /></div>
                        <div className="bg-white border border-slate-100 px-6 py-4 rounded-[2rem] rounded-tl-none shadow-soft flex items-center gap-3">
                            <span className="flex gap-1">
                                <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce"></span>
                                <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce delay-100"></span>
                                <span className="w-2 h-2 bg-brand-400 rounded-full animate-bounce delay-200"></span>
                            </span>
                            <span className="text-slate-500 text-xs font-bold">{isRetrieving ? 'جستجو در بردارها...' : 'نوشتن پاسخ...'}</span>
                        </div>
                    </div>
                 </div>
               )}
             </div>
             
             {/* Chat Input Area */}
             <div className="p-6 bg-white border-t border-slate-100 z-20">
               <div className="relative shadow-soft rounded-[2rem] bg-slate-50 border border-slate-200 focus-within:ring-2 focus-within:ring-brand-100 focus-within:border-brand-300 transition-all">
                 <textarea 
                    value={chatInput} 
                    onChange={(e) => setChatInput(e.target.value)} 
                    onKeyDown={handleKeyDown} 
                    placeholder={hasContext ? "سوال فنی خود را بپرسید..." : "پیام..."} 
                    className="w-full bg-transparent border-0 rounded-[2rem] p-5 pl-16 text-slate-800 placeholder-slate-400 focus:ring-0 resize-none h-20 max-h-32 text-sm leading-relaxed" 
                    disabled={isChatLoading || isRetrieving} 
                 />
                 <button 
                    onClick={handleSendMessage} 
                    disabled={!chatInput.trim() || isChatLoading || isRetrieving} 
                    className={`absolute left-3 top-3 bottom-3 aspect-square rounded-2xl transition-all flex items-center justify-center ${!chatInput.trim() || isChatLoading || isRetrieving ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-brand-600 text-white hover:bg-brand-700 shadow-lg shadow-brand-600/30 hover:scale-105 active:scale-95'}`}
                 >
                    <Send className="w-5 h-5 rotate-180 ml-1" />
                 </button>
               </div>
               
               <div className="flex justify-center items-center gap-4 mt-4 opacity-60">
                  <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                      <Command className="w-3 h-3" />
                      <span>Enter برای ارسال</span>
                  </div>
                  <div className="w-px h-3 bg-slate-300"></div>
                  <div className="text-[10px] text-slate-400 font-medium flex items-center gap-1.5">
                      <Database className="w-3 h-3" />
                      <span>Local RAG</span>
                  </div>
               </div>
             </div>
           </div>
        )}
      </div>
    </div>
  );
};

export default BrowserGenerator;