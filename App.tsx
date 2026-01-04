import React, { useState } from 'react';
import { Terminal, Globe, Github } from 'lucide-react';
import BrowserGenerator from './components/BrowserGenerator';
import CliCodeViewer from './components/CliCodeViewer';
import { AppMode } from './types';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.BROWSER);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Github className="w-6 h-6 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              ریپوداکس <span className="text-blue-400">هوشمند</span>
            </h1>
          </div>
          
          <nav className="flex items-center bg-gray-900 rounded-lg p-1 border border-gray-700">
            <button
              onClick={() => setMode(AppMode.BROWSER)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === AppMode.BROWSER 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Globe className="w-4 h-4" />
              نسخه وب
            </button>
            <button
              onClick={() => setMode(AppMode.CLI_CODE)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                mode === AppMode.CLI_CODE 
                  ? 'bg-blue-600 text-white shadow' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Terminal className="w-4 h-4" />
              دریافت نسخه CLI
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto h-[calc(100vh-8rem)]">
          {mode === AppMode.BROWSER ? (
            <div className="h-full flex flex-col">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">تولید مستندات تحت وب</h2>
                <p className="text-gray-400">
                  یک پوشه محلی را انتخاب کنید تا با استفاده از مدل Ollama مستندات آن تولید شود.
                  <br />
                  <span className="text-xs text-yellow-500 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-800">
                     نکته: نیاز است که `OLLAMA_ORIGINS="*"` در متغیرهای محیطی Ollama تنظیم شده باشد.
                  </span>
                </p>
              </div>
              <div className="flex-1 min-h-0">
                <BrowserGenerator />
              </div>
            </div>
          ) : (
             <div className="h-full overflow-y-auto">
               <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">کد منبع نسخه Node.js CLI</h2>
                <p className="text-gray-400">
                  شما درخواست ابزار خط فرمان داشتید. فایل‌های زیر را کپی کنید تا این ابزار را در ترمینال خود اجرا کنید.
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