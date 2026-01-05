

export const IGNORED_DIRS = new Set([
  // JavaScript / Web
  'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'coverage', 'tmp', 'temp', '.next', 'public',
  
  // Assets & Media
  'icon', 'icons', 'images', 'img', 'assets',

  // Python Virtual Environments (Common Names)
  'venv', '.venv', 'env', '.env', 'virtualenv', 'envs',
  
  // Python Internal & Libs
  '__pycache__', 'Lib', 'lib', 'Scripts', 'bin', 'site-packages', 'Include', 'share', 'etc', 'man',
  
  // Model Weights & Heavy Assets (Whisper specific)
  'models', 'weights', 'downloads'
]);

export const ALLOWED_EXTENSIONS = new Set([
  '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.yml', '.yaml', '.txt', '.dockerfile', '.sh', '.bat', '.java', '.c', '.cpp', '.go', '.rs'
]);

export const LANGUAGE_MAP: Record<string, string> = {
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.py': 'Python',
  '.html': 'HTML',
  '.css': 'CSS',
  '.json': 'JSON',
  '.md': 'Markdown',
  '.yml': 'YAML',
  '.yaml': 'YAML',
  '.dockerfile': 'Docker',
  '.sh': 'Shell',
  '.bat': 'Batch',
  '.java': 'Java',
  '.c': 'C',
  '.cpp': 'C++',
  '.go': 'Go',
  '.rs': 'Rust',
  '.sql': 'SQL'
};

export const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml',
  'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'Gemfile',
  'Makefile', 'README.md', 'vite.config.ts', 'vite.config.js', 'webpack.config.js'
]);

export const DEFAULT_MODEL = 'qwen2.5-coder:14b';
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

// --- Level 1: Root Documentation ---
export const PROMPT_LEVEL_1_ROOT = `شما یک Technical Writer ارشد فارسی‌زبان هستید.
وظیفه: تولید فایل README.md سطح ریشه برای مخزن کد.

قانون حیاتی (CRITICAL RULE):
تمام توضیحات، متن‌ها و راهنماها باید **حتماً و اکیداً به زبان فارسی** نوشته شوند.
اگر متنی را به انگلیسی بنویسی، امتیاز منفی می‌گیری.
فقط نام متغیرها، کدها و اصطلاحات تخصصی (مثل Docker, API, Node.js) به انگلیسی باقی بمانند.

ورودی: خلاصه‌ای از ماژول‌ها، فایل‌های تنظیمات و لیست فایل‌ها.

خروجی باید فرمت Markdown استاندارد باشد و شامل:
1. **عنوان و نشان‌ها:** نام پروژه.
2. **معرفی پروژه:** یک پاراگراف جذاب و کامل به فارسی که هدف پروژه را توضیح دهد.
3. **تحلیل تکنولوژی‌ها:** با توجه به آمار زبان‌های ارائه شده در کانتکست، توضیح دهید تمرکز اصلی پروژه روی چه زبانی است.
4. **ویژگی‌های کلیدی:** لیست بولت‌وار قابلیت‌ها با توضیحات فارسی.
5. **راهنمای نصب و اجرا:** دستورات Installation و Usage همراه با توضیحات قدم‌به‌قدم فارسی.
6. **ساختار پروژه:** توضیح کوتاه فارسی درباره ساختار دایرکتوری‌ها.

یادت باشد: مخاطب شما توسعه‌دهندگان ایرانی هستند، پس فارسی سلیس و روان بنویس.`;

// --- Level 2: Code Documentation (Updated for Map-Reduce) ---
export const PROMPT_LEVEL_2_CODE = `شما یک Senior Developer فارسی‌زبان هستید.
وظیفه: مستندسازی فایل کد ارائه شده و ارائه خلاصه فنی.

قوانین حیاتی (CRITICAL RULES):
1. **زبان:** خروجی باید **۱۰۰٪ فارسی** باشد (مگر نام‌های فنی).
2. **حقایق (Facts):** لیستی از کلاس‌ها و توابع استخراج شده (Metadata) به شما داده شده است. فقط در مورد چیزهایی که واقعا وجود دارند صحبت کن.
3. **ساختار خروجی:** دقیقا از فرمت زیر پیروی کن. بخش آخر (SUMMARY_FOR_CONTEXT) بسیار مهم است و نباید توضیحات فارسی داشته باشد، فقط فکت‌های فنی به انگلیسی.

**هدف:**
(یک پاراگراف کوتاه فارسی درباره اینکه این فایل چه می‌کند)

**اجزای کلیدی:**
(جدول مارک‌داون)
| نام کامپوننت/تابع | عملکرد (به فارسی) | ورودی/خروجی |
| --- | --- | --- |
| نام | توضیح فارسی | ورودی/خروجی |

**نکات فنی:**
(لیست بولت‌وار از نکات مهم، هوک‌ها یا وابستگی‌ها به فارسی)

---
**SUMMARY_FOR_CONTEXT**
(Here, write a very concise technical summary in English approx 50 words. Mention key exported classes, functions, and the responsibility of this file. This will be used by the system architect for high-level diagrams. Do NOT use Persian here.)
`;

// --- Level 3: Architecture Documentation ---
export const PROMPT_LEVEL_3_ARCH = `شما یک Software Architect هستید.
وظیفه: تحلیل معماری سیستم و رسم نمودار.

ورودی: لیستی از فایل‌ها و خلاصه‌ی فنی (Technical Summary) هر فایل. نیازی به خواندن خط به خط کد نیست.

قوانین حیاتی (CRITICAL RULES) برای رسم دیاگرام:
1. **زبان (LANGUAGE):** تمام متن‌های داخل گره‌ها، لیبل‌ها و توضیحات باید **فقط فارسی یا انگلیسی** باشند.
2. **سینتکس:** حتماً از \`flowchart TD\` استفاده کنید.
3. **کوت کردن اجباری (MANDATORY QUOTING):**
   - هر متنی داخل \`[]\` یا \`()\` باید حتماً داخل دابل کوتیشن \`""\` باشد.
   - صحیح: A["func()"] --> B["class"]

خروجی باید شامل:
1. **دیاگرام:** فقط کد Mermaid معتبر داخل بلوک \`\`\`mermaid.
2. **توضیحات:** توضیحات متنی فارسی درباره معماری کلی سیستم.
`;

// --- Level 4: Operational Documentation ---
export const PROMPT_LEVEL_4_OPS = `شما یک مهندس DevOps و SRE هستید.
وظیفه: تولید مستندات عملیاتی (Runbook).

با توجه به فایل‌های کانفیگ (مثل Dockerfile, package.json):
1. **پیش‌نیازهای محیطی:** چه ابزارهایی (Node, Python, Docker) نیاز است؟
2. **متغیرهای محیطی (ENV):** لیستی از متغیرهای احتمالی مورد نیاز.
3. **بیلد و دیپلوی:** دستورات برای بیلد گرفتن و اجرا در پروداکشن.
4. **عیب‌یابی (Troubleshooting):** مشکلات رایج احتمالی.

نکته: توضیحات کاملا فارسی باشد.`;

// --- Level 5: Sequence Diagram (Strict Mode) ---
export const PROMPT_LEVEL_5_SEQUENCE = `شما متخصص رسم نمودار Sequence Diagram هستید.
هدف: ترسیم سناریوی اصلی برنامه به زبان فارسی.

ورودی: خلاصه‌ی عملکرد فایل‌ها (Map-Reduce Summaries).

قوانین بسیار مهم (VERY IMPORTANT):
1. **زبان (LANGUAGE):** فارسی یا انگلیسی.
2. **فقط** از سینتکس \`sequenceDiagram\` استفاده کنید.
3. **کوت کردن (Quoting):** تمام نام‌ها و پیام‌ها داخل \`""\`.

الگوی صحیح:
\`\`\`mermaid
sequenceDiagram
    participant U as "کاربر"
    participant S as "سیستم"
    U->>S: "ارسال درخواست ورود"
    S-->>U: "تایید اعتبار"
\`\`\`
`;

// --- Level 6: OpenAPI / Swagger Generation (Gap 3 Solution) ---
export const PROMPT_LEVEL_6_API = `You are a Senior Backend Developer specialized in API Documentation.
Task: Generate an OpenAPI 3.0 (Swagger) specification in JSON format.

Input: A list of files that contain API endpoints (Controllers, Routes) along with extracted metadata about methods (GET, POST, etc).

Rules:
1. Output MUST be valid JSON inside a \`\`\`json\`\`\` block.
2. Guess the parameters and request/response bodies based on the function names and descriptions provided.
3. Include a "info" section with Title: "Generated API Docs" and Version: "1.0.0".
4. If no clear API is found, return an empty paths object.
`;
