import React, { useState } from 'react';
import { Settings, Github, Cpu, LayoutGrid, Sliders } from 'lucide-react';
import BrowserGenerator from './components/BrowserGenerator';
import SettingsView from './components/SettingsView';
import { AppMode, OllamaConfig } from './types';
import { DEFAULT_MODEL, OLLAMA_DEFAULT_URL } from './utils/constants';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.DASHBOARD);
  
  // Lifted Config State
  const [config, setConfig] = useState<OllamaConfig>({
    baseUrl: OLLAMA_DEFAULT_URL,
    model: DEFAULT_MODEL,
    embeddingModel: 'nomic-embed-text' 
  });

  return (
    <div className="min-h-screen flex flex-col font-sans bg-[#F5F6FB] overflow-x-hidden">
      {/* Background Decor - Subtle Orbs */}
      <div className="fixed top-[-10%] right-[-5%] w-96 h-96 bg-brand-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="fixed top-[-10%] left-[-5%] w-96 h-96 bg-accent-pink/20 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 pt-4 px-6 pb-2">
        <div className="bg-white/70 backdrop-blur-xl rounded-3xl shadow-card border border-white/60 mx-auto max-w-[1600px] px-6 h-20 flex items-center justify-between">
          
          {/* Logo Section */}
          <div className="flex items-center gap-4">
            <div className="bg-gradient-to-br from-brand-600 to-brand-800 p-2.5 rounded-2xl shadow-lg shadow-brand-500/30 text-white">
              <Cpu className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-800 flex flex-col leading-none gap-1">
                <span>RAYAN <span className="text-brand-600">HAMAFZA</span></span>
              </h1>
              <p className="text-[10px] text-slate-500 font-medium tracking-wider uppercase opacity-80">Intelligent Documentation</p>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex items-center bg-slate-100/50 p-1.5 rounded-2xl border border-white/50">
            <button
              onClick={() => setMode(AppMode.DASHBOARD)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                mode === AppMode.DASHBOARD 
                  ? 'bg-white text-brand-700 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              داشبورد
            </button>
            <button
              onClick={() => setMode(AppMode.SETTINGS)}
              className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 ${
                mode === AppMode.SETTINGS 
                  ? 'bg-white text-brand-700 shadow-sm ring-1 ring-black/5' 
                  : 'text-slate-500 hover:text-slate-700 hover:bg-white/40'
              }`}
            >
              <Settings className="w-4 h-4" />
              تنظیمات
            </button>
          </nav>

          {/* User/Social */}
          <div className="flex items-center gap-3">
             <a href="https://github.com" target="_blank" rel="noreferrer" className="p-2.5 rounded-xl bg-white border border-slate-100 text-slate-500 hover:text-brand-600 hover:border-brand-200 transition-all shadow-sm group">
                <Github className="w-5 h-5 group-hover:scale-110 transition-transform" />
             </a>
             <div className="h-10 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-accent-pink shadow-md shadow-brand-500/20 flex items-center justify-center text-white font-bold text-sm">
                نسخه ۲.۰
             </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-6 py-6 overflow-hidden z-10">
        <div className="max-w-[1600px] mx-auto h-full">
          {mode === AppMode.DASHBOARD ? (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex-1 min-h-0">
                <BrowserGenerator config={config} />
              </div>
            </div>
          ) : (
             <div className="h-full overflow-y-auto animate-in fade-in slide-in-from-bottom-4 duration-700 flex flex-col items-center">
               <div className="mb-8 text-center relative w-full">
                 <div className="absolute left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-64 h-32 bg-brand-500/10 blur-[80px] rounded-full -z-10"></div>
                <h2 className="text-3xl font-extrabold text-slate-800 mb-2 tracking-tight flex items-center justify-center gap-3">
                  <Sliders className="w-8 h-8 text-brand-600" />
                  تنظیمات برنامه
                </h2>
                <p className="text-slate-500 max-w-xl mx-auto text-sm leading-relaxed">
                  پیکربندی اتصال به هوش مصنوعی و مدل‌های پردازش
                </p>
              </div>
               <SettingsView config={config} setConfig={setConfig} />
             </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;