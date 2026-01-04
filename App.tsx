import React, { useState } from 'react';
import { Terminal, Globe, Github, LayoutDashboard } from 'lucide-react';
import BrowserGenerator from './components/BrowserGenerator';
import CliCodeViewer from './components/CliCodeViewer';
import { AppMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.BROWSER);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#F0F2F5]">
      {/* Header - Designed as a floating top bar */}
      <header className="sticky top-0 z-50 pt-4 px-6 pb-2">
        <div className="bg-white/80 backdrop-blur-md rounded-2xl shadow-sm border border-white/50 mx-auto max-w-[1600px] px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-slate-900 p-2.5 rounded-xl shadow-lg shadow-slate-900/20">
              <LayoutDashboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                STEINMANN <span className="text-slate-400 font-light">Docs</span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase">Intelligent Repository Analysis</p>
            </div>
          </div>
          
          <nav className="flex items-center bg-slate-100/50 rounded-2xl p-1.5 border border-slate-200/50">
            <button
              onClick={() => setMode(AppMode.BROWSER)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                mode === AppMode.BROWSER 
                  ? 'bg-white text-slate-900 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.1)]' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <Globe className="w-4 h-4" />
              نسخه وب
            </button>
            <button
              onClick={() => setMode(AppMode.CLI_CODE)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                mode === AppMode.CLI_CODE 
                  ? 'bg-white text-slate-900 shadow-[0_2px_10px_-2px_rgba(0,0,0,0.1)]' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
              }`}
            >
              <Terminal className="w-4 h-4" />
              نسخه CLI
            </button>
          </nav>

          <div className="flex items-center gap-3">
             <a href="https://github.com" target="_blank" rel="noreferrer" className="p-2.5 rounded-full bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-300 transition-all shadow-sm">
                <Github className="w-5 h-5" />
             </a>
             <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 shadow-md ring-2 ring-white flex items-center justify-center text-white font-bold text-sm">
                AI
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-6 overflow-hidden">
        <div className="max-w-[1600px] mx-auto h-full">
          {mode === AppMode.BROWSER ? (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex-1 min-h-0">
                <BrowserGenerator />
              </div>
            </div>
          ) : (
             <div className="h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
               <div className="mb-8 text-center">
                <h2 className="text-3xl font-bold text-slate-900 mb-3">کد منبع CLI</h2>
                <p className="text-slate-500 max-w-xl mx-auto">
                  برای استفاده از این ابزار در خط فرمان، کدهای زیر را در فایل‌های مربوطه کپی کنید. این نسخه سبک و سریع است.
                </p>
              </div>
               <CliCodeViewer />
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;