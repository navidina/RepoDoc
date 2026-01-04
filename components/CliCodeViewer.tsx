import React, { useState } from 'react';
import { Copy, Check } from 'lucide-react';

const CliCodeViewer: React.FC = () => {
  const [copiedIndex, setCopiedIndex] = useState(false);
  const [copiedPackage, setCopiedPackage] = useState(false);

  const packageJsonContent = `{
  "name": "repodocs-cli",
  "version": "1.0.0",
  "description": "Auto-generate documentation using local Ollama (Persian)",
  "main": "index.js",
  "type": "module",
  "bin": {
    "repodocs": "./index.js"
  },
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "ollama": "^0.5.0"
  },
  "engines": {
    "node": ">=18.0.0"
  }
}`;

  const indexJsContent = `#!/usr/bin/env node

import fs from 'fs/promises';
import path from 'path';
import ollama from 'ollama';

// --- Configuration ---
const CONFIG = {
  model: 'qwen2.5-coder:14b', // پیش‌فرض: بهترین مدل برای کد
  ignoredDirs: new Set(['node_modules', '.git', '.vscode', 'dist', 'build', 'coverage', '.next', 'target']),
  ignoredExts: new Set(['.png', '.jpg', '.jpeg', '.lock', '.exe', '.bin', '.gz', '.zip', '.pdf']),
  configFiles: new Set([
    'package.json', 'tsconfig.json', 'Dockerfile', 'requirements.txt', 
    'Cargo.toml', 'go.mod', 'README.md', 'Makefile'
  ]),
  maxFileSize: 20000 // characters
};

// --- System Prompts (Table-Based Structure) ---
const PROMPTS = {
  global: \`شما یک معمار نرم‌افزار ارشد هستید.
وظیفه: تحلیل جامع پروژه.
قوانین: اصطلاحات فنی انگلیسی بمانند. خروجی مارک‌داون باشد.

ساختار خروجی:
1. **مقدمه جامع (Executive Summary):** توضیحات کامل درباره هدف پروژه.
2. **جدول استک فنی (Tech Stack Table):**
   | دسته | تکنولوژی | توضیحات |
   | --- | --- | --- |
3. **تحلیل ساختار:** بررسی معماری پوشه‌ها.\`,

  code: \`شما یک Senior Developer هستید.
وظیفه: مستندسازی فایل کد.
قوانین: نام‌های خاص انگلیسی بمانند.

ساختار خروجی:
1. **هدف:** پاراگراف توضیحی.
2. **جدول اجزا (Components Table):**
   | نام (انگلیسی) | عملکرد (فارسی) | نوع/ورودی (انگلیسی) |
   | --- | --- | --- |
3. **تحلیل منطق:** توضیحات تکمیلی.\`
};

// --- Helper: Scan Directory ---
async function scanDirectory(dir, rootDir = dir) {
  let fileTree = '';
  let sourceFiles = [];
  let configContents = [];

  const entries = await fs.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relativePath = path.relative(rootDir, fullPath);

    if (entry.isDirectory()) {
      if (CONFIG.ignoredDirs.has(entry.name)) continue;
      fileTree += \`DIR: \${relativePath}\\n\`;
      const result = await scanDirectory(fullPath, rootDir);
      fileTree += result.fileTree;
      sourceFiles.push(...result.sourceFiles);
      configContents.push(...result.configContents);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (CONFIG.ignoredExts.has(ext)) continue;

      fileTree += \`FILE: \${relativePath}\\n\`;

      if (CONFIG.configFiles.has(entry.name)) {
        try {
          const content = await fs.readFile(fullPath, 'utf-8');
          configContents.push(\`--- \${relativePath} ---\\n\${content}\\n\`);
        } catch (e) { console.warn(\`Skipped reading config \${relativePath}: \${e.message}\`); }
      } else {
        sourceFiles.push(fullPath);
      }
    }
  }

  return { fileTree, sourceFiles, configContents };
}

// --- Helper: LLM Interaction ---
async function queryLLM(prompt, system) {
  try {
    const response = await ollama.chat({
      model: CONFIG.model,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt }
      ],
    });
    return response.message.content;
  } catch (error) {
    console.error(\`❌ LLM Error: \${error.message}\`);
    return "> **خطا در تولید مستندات برای این بخش.**";
  }
}

// --- Main Execution ---
async function main() {
  const repoPath = process.argv[2] || process.cwd();
  const absPath = path.resolve(repoPath);

  console.log(\`🚀 شروع ریپوداکس روی مسیر: \${absPath}\`);
  console.log(\`🤖 استفاده از مدل: \${CONFIG.model}\`);

  try {
    // Phase 0: Scan
    console.log('\\n📂 در حال اسکن فایل‌های پروژه...');
    const { fileTree, sourceFiles, configContents } = await scanDirectory(absPath);
    console.log(\`✅ تعداد \${sourceFiles.length} فایل کد و \${configContents.length} فایل کانفیگ پیدا شد.\`);

    let finalDoc = \`# مستندات جامع پروژه\\n\\nتولید شده برای مسیر: \${absPath}\\n\\n\`;

    // Phase 1: Architecture
    console.log('\\n🧠 فاز ۱: تحلیل معماری و تکنولوژی‌ها...');
    const globalPrompt = \`File Tree:\\n\${fileTree}\\n\\nConfig Files:\\n\${configContents.join('')}\`;
    const archDoc = await queryLLM(globalPrompt, PROMPTS.global);
    finalDoc += \`## نمای کلی معماری\\n\\n\${archDoc}\\n\\n---\\n\\n## تحلیل فایل‌ها\\n\\n\`;
    console.log('✅ تحلیل معماری انجام شد.');

    // Phase 2: File Analysis
    console.log(\`\\n📝 فاز ۲: پردازش \${sourceFiles.length} فایل...\`);
    
    for (const filePath of sourceFiles) {
      const relPath = path.relative(absPath, filePath);
      process.stdout.write(\`   در حال پردازش: \${relPath} ... \`);

      try {
        const stats = await fs.stat(filePath);
        if (stats.size > CONFIG.maxFileSize) {
          console.log('⚠️ رد شد (حجم زیاد)');
          finalDoc += \`### \${relPath}\\n\\n*Skipped: File too large (>20KB)*\\n\\n\`;
          continue;
        }

        const content = await fs.readFile(filePath, 'utf-8');
        const filePrompt = \`File: \${relPath}\\n\\nCode:\\n\`\`\`\\n\${content}\\n\`\`\`\`;
        const analysis = await queryLLM(filePrompt, PROMPTS.code);
        
        finalDoc += \`### \${relPath}\\n\\n\${analysis}\\n\\n\`;
        console.log('✅');
      } catch (err) {
        console.log('❌ خطا');
      }
    }

    // Phase 3: Save
    const outputPath = path.join(process.cwd(), 'DOCUMENTATION.md');
    await fs.writeFile(outputPath, finalDoc);
    console.log(\`\\n🎉 مستندات با موفقیت ذخیره شد در: \${outputPath}\`);

  } catch (error) {
    console.error('🔥 خطای بحرانی:', error);
    process.exit(1);
  }
}

main();
`;

  const copyToClipboard = (text: string, setFn: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    setFn(true);
    setTimeout(() => setFn(false), 2000);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white text-left dir-ltr">1. package.json</h3>
          <button 
            onClick={() => copyToClipboard(packageJsonContent, setCopiedPackage)}
            className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            {copiedPackage ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copiedPackage ? 'کپی شد!' : 'کپی'}
          </button>
        </div>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm font-mono text-green-300 text-left dir-ltr">
          {packageJsonContent}
        </pre>
      </div>

      <div className="bg-gray-800 p-6 rounded-xl border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-white text-left dir-ltr">2. index.js (Main Logic)</h3>
          <button 
            onClick={() => copyToClipboard(indexJsContent, setCopiedIndex)}
            className="flex items-center gap-2 px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm transition-colors"
          >
            {copiedIndex ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
            {copiedIndex ? 'کپی شد!' : 'کپی'}
          </button>
        </div>
        <pre className="bg-gray-900 p-4 rounded-lg overflow-x-auto text-sm font-mono text-blue-300 h-96 text-left dir-ltr">
          {indexJsContent}
        </pre>
      </div>

      <div className="bg-blue-900/30 border border-blue-800 p-4 rounded-lg">
        <h4 className="font-bold text-blue-400 mb-2">راهنمای اجرا:</h4>
        <ul className="list-disc list-inside text-sm text-gray-300 space-y-1">
          <li>یک پوشه جدید ایجاد کنید.</li>
          <li>فایل‌های بالا را در آن ذخیره کنید.</li>
          <li className="dir-ltr text-right">دستور <code>npm install</code> را اجرا کنید.</li>
          <li className="dir-ltr text-right">مطمئن شوید Ollama در حال اجراست: <code>ollama serve</code></li>
          <li className="dir-ltr text-right">مدل را دریافت کنید: <code>ollama pull qwen2.5-coder:14b</code></li>
          <li className="dir-ltr text-right">برنامه را اجرا کنید: <code>node index.js /path/to/your/repo</code></li>
        </ul>
      </div>
    </div>
  );
};

export default CliCodeViewer;