
import React, { useState, useEffect } from 'react';
import { OllamaConfig } from '../types';
import { Server, Cpu, Database, CheckCircle2, XCircle, RotateCcw, Zap } from 'lucide-react';
import { checkOllamaConnection } from '../services/ollamaService';

interface SettingsViewProps {
  config: OllamaConfig;
  setConfig: (config: OllamaConfig) => void;
}

const SettingsView: React.FC<SettingsViewProps> = ({ config, setConfig }) => {
  const [status, setStatus] = useState<'idle' | 'checking' | 'connected' | 'error'>('idle');

  const handleCheckConnection = async () => {
    setStatus('checking');
    const isConnected = await checkOllamaConnection(config);
    if (isConnected) {
      setStatus('connected');
      setTimeout(() => setStatus('idle'), 3000);
    } else {
      setStatus('error');
    }
  };

  const handleReset = () => {
    setConfig({
      baseUrl: 'http://localhost:11434',
      model: 'qwen2.5-coder:14b',
      embeddingModel: 'nomic-embed-text'
    });
    setStatus('idle');
  };

  return (
    <div className="w-full max-w-3xl space-y-6">
      
      {/* Connection Card */}
      <div className="bg-white rounded-[2rem] p-8 shadow-soft border border-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-50 rounded-bl-[4rem] -z-0"></div>
        
        <div className="flex items-center gap-4 mb-8 relative z-10">
          <div className="bg-brand-100 p-3 rounded-2xl text-brand-600">
            <Server className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">اتصال به Ollama</h3>
            <p className="text-sm text-slate-400">تنظیمات سرور محلی هوش مصنوعی</p>
          </div>
        </div>

        <div className="space-y-6 relative z-10">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-2 mr-1">آدرس سرور (Base URL)</label>
            <div className="relative group">
              <input 
                type="text" 
                value={config.baseUrl} 
                onChange={(e) => setConfig({...config, baseUrl: e.target.value})}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-600 font-mono text-left dir-ltr focus:ring-2 focus:ring-brand-200 focus:border-brand-300 transition-all outline-none"
              />
              <div className="absolute right-3 top-3 bg-white px-2 py-1 rounded-lg border border-slate-100 shadow-sm text-[10px] font-bold text-slate-400">Required</div>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 mr-2">
              مطمئن شوید که Ollama با دستور <code className="bg-slate-100 px-1 py-0.5 rounded text-slate-600 font-mono">ollama serve</code> در حال اجراست.
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button 
              onClick={handleCheckConnection}
              disabled={status === 'checking'}
              className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${
                status === 'connected' ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' :
                status === 'error' ? 'bg-red-500 text-white shadow-lg shadow-red-500/30' :
                'bg-brand-600 text-white shadow-glow hover:shadow-lg hover:bg-brand-700'
              }`}
            >
              {status === 'checking' && <RotateCcw className="w-4 h-4 animate-spin" />}
              {status === 'connected' && <CheckCircle2 className="w-4 h-4" />}
              {status === 'error' && <XCircle className="w-4 h-4" />}
              
              {status === 'checking' ? 'بررسی اتصال...' : 
               status === 'connected' ? 'اتصال برقرار است' : 
               status === 'error' ? 'خطا در اتصال' : 'تست اتصال'}
            </button>
            
            <button 
              onClick={handleReset}
              className="px-6 py-3 rounded-xl font-bold text-sm bg-slate-100 text-slate-500 hover:bg-slate-200 transition-colors"
            >
              بازنشانی پیش‌فرض
            </button>
          </div>
        </div>
      </div>

      {/* Models Card */}
      <div className="bg-white rounded-[2rem] p-8 shadow-soft border border-white">
        <div className="flex items-center gap-4 mb-8">
          <div className="bg-accent-pink/10 p-3 rounded-2xl text-accent-pink">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-800">انتخاب مدل‌ها</h3>
            <p className="text-sm text-slate-400">تعیین مدل‌های پردازش متن و وکتور</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Main Model */}
          <div className="space-y-3">
             <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Zap className="w-4 h-4 text-brand-500" />
                مدل اصلی (Main Model)
             </label>
             <input 
                type="text" 
                value={config.model} 
                onChange={(e) => setConfig({...config, model: e.target.value})}
                placeholder="e.g. qwen2.5-coder:14b"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-600 font-mono text-left dir-ltr focus:ring-2 focus:ring-brand-200 outline-none transition-all"
              />
              <div className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                پیشنهاد ما: <span className="font-mono text-brand-600">qwen2.5-coder:14b</span> یا <span className="font-mono text-brand-600">deepseek-coder:6.7b</span> برای بهترین نتیجه.
              </div>
          </div>

          {/* Embedding Model */}
          <div className="space-y-3">
             <label className="flex items-center gap-2 text-sm font-bold text-slate-700">
                <Database className="w-4 h-4 text-accent-blue" />
                مدل امبدینگ (Embedding Model)
             </label>
             <input 
                type="text" 
                value={config.embeddingModel} 
                onChange={(e) => setConfig({...config, embeddingModel: e.target.value})}
                placeholder="e.g. nomic-embed-text"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-slate-600 font-mono text-left dir-ltr focus:ring-2 focus:ring-brand-200 outline-none transition-all"
              />
              <div className="text-[10px] text-slate-400 bg-slate-50 p-2 rounded-lg border border-slate-100 leading-relaxed">
                برای سیستم RAG (چت با داکیومنت)، مدل <span className="font-mono text-accent-blue">nomic-embed-text</span> سریع و دقیق است.
              </div>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SettingsView;
