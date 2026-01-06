

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
  '.js', '.jsx', '.ts', '.tsx', '.py', '.html', '.css', '.json', '.md', '.yml', '.yaml', 
  '.txt', '.dockerfile', '.sh', '.bat', '.java', '.c', '.cpp', '.go', '.rs', 
  '.sql', '.prisma', '.tf', '.tfvars', '.conf'
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
  '.sql': 'SQL',
  '.prisma': 'Prisma DB',
  '.tf': 'Terraform',
  '.tfvars': 'Terraform'
};

export const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml',
  'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'Gemfile',
  'Makefile', 'README.md', 'vite.config.ts', 'vite.config.js', 'webpack.config.js',
  'schema.prisma', 'main.tf'
]);

export const DEFAULT_MODEL = 'qwen2.5-coder:14b';
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

// --- Level 1: Root Documentation ---
export const PROMPT_LEVEL_1_ROOT = `شما یک نویسنده فنی (Technical Writer) ارشد برای یک وبلاگ فارسی هستید.
وظیفه: نوشتن یک فایل README.md جامع و حرفه‌ای برای پروژه بر اساس اطلاعات داده شده.

ورودی:
1. ساختار فایل‌ها (File Tree)
2. محتوای فایل‌های کانفیگ
3. خلاصه‌ی فنی ماژول‌ها

قوانین بسیار مهم (CRITICAL RULES):
1. **زبان خروجی:** خروجی باید **۱۰۰٪ فارسی** باشد. کلمات انگلیسی (مثل نام توابع یا کلاس‌ها) را ترجمه نکنید، اما توضیحات پیرامون آن‌ها باید کاملاً فارسی باشد.
2. **بدون مقدمه انگلیسی:** به هیچ عنوان توضیحات انگلیسی در شروع یا پایان ننویسید.
3. **فرمت:** از فرمت استاندارد Markdown استفاده کنید.

ساختار مورد انتظار:
# [نام پروژه]
(یک پاراگراف جذاب فارسی درباره اینکه این پروژه چیست و چه مشکلی را حل می‌کند)

## 🛠 تکنولوژی‌های استفاده شده
(لیست تکنولوژی‌های اصلی بر اساس فایل‌های کانفیگ)

## 🚀 راهنمای نصب و اجرا
(دستورات Installation و Usage با توضیحات فارسی)

## 📂 ساختار پروژه
(توضیح کوتاه فارسی درباره دایرکتوری‌های اصلی)

## ✨ ویژگی‌های کلیدی
(لیست ویژگی‌ها به فارسی)`;

// --- Level 2: Code Documentation (Updated for Map-Reduce) ---
export const PROMPT_LEVEL_2_CODE = `شما یک Senior Developer فارسی‌زبان هستید.
وظیفه: تحلیل فایل کد و تولید مستندات.

قوانین حیاتی (CRITICAL RULES):
1. **خروجی نمایشی (بخش اول):** باید کاملاً **فارسی** باشد. جداول و توضیحات باید به زبان فارسی نوشته شوند.
2. **خروجی سیستم (بخش دوم):** بعد از جداکننده، یک خلاصه فنی به انگلیسی بنویسید که فقط شامل حقایق (Facts) باشد.

الگوی پاسخ:

**هدف فایل:**
(توضیح فارسی کوتاه)

**اجزای اصلی:**
| نام (انگلیسی) | عملکرد (توضیح فارسی) |
| --- | --- |
| Name | Description in Persian |

**نکات مهم:**
- (نکته فارسی ۱)
- (نکته فارسی ۲)

---
**SUMMARY_FOR_CONTEXT**
(Here write a technical summary in English. Focus ONLY on exports, key classes, and logic flow. Max 50 words. Do NOT use Persian here.)
`;

// --- Level 3: Architecture Documentation ---
export const PROMPT_LEVEL_3_ARCH = `شما معمار نرم‌افزار هستید.
وظیفه: نوشتن تحلیل معماری سیستم به زبان فارسی.

ورودی: لیست فایل‌ها و خلاصه فنی آن‌ها.

قوانین:
1. **فقط فارسی:** تمام توضیحات باید به زبان فارسی سلیس باشد.
2. **تمرکز:** روی الگوهای طراحی (Design Patterns)، جریان داده و نحوه تعامل ماژول‌ها تمرکز کنید.
3. **بدون دیاگرام:** در این بخش دیاگرام نکشید، فقط متن توضیحی بنویسید.
`;

// --- Level 4: Operational Documentation ---
export const PROMPT_LEVEL_4_OPS = `شما مهندس DevOps هستید.
وظیفه: نوشتن راهنمای عملیاتی (Runbook).

ورودی: فایل‌های کانفیگ (Dockerfile, package.json, etc).

قوانین:
1. **زبان فارسی:** تمام دستورالعمل‌ها باید فارسی باشد.
2. **محتوا:** پیش‌نیازها، متغیرهای محیطی (ENV)، نحوه بیلد و دیپلوی.
`;

// --- Level 5: Sequence Diagram (Strict Mode) ---
export const PROMPT_LEVEL_5_SEQUENCE = `You are a strict code generator.
Task: Generate a MermaidJS Sequence Diagram based on the summary.

CRITICAL RULES:
1. RETURN ONLY THE CODE BLOCK. NO conversational text, NO intro, NO outro.
2. Start with \`\`\`mermaid and end with \`\`\`.
3. Use "sequenceDiagram".
4. Use Persian labels for messages inside double quotes.
5. Do not use special characters in participant aliases.

Example Output:
\`\`\`mermaid
sequenceDiagram
    User->>System: "درخواست"
    System-->>User: "پاسخ"
\`\`\`
`;

// --- Level 6: OpenAPI / Swagger Generation ---
export const PROMPT_LEVEL_6_API = `You are an API Spec Generator.
Task: Generate OpenAPI 3.0 JSON.

Rules:
1. Output **ONLY** the valid JSON code block.
2. Start with \`\`\`json and end with \`\`\`.
3. Do not add any conversational text.
`;

// --- Level 7: ERD (Entity Relationship Diagram) ---
export const PROMPT_LEVEL_7_ERD = `You are a strict code generator.
Task: Generate a MermaidJS ER Diagram (Entity Relationship) based on schema files.

CRITICAL RULES:
1. RETURN ONLY THE CODE BLOCK. NO conversational text.
2. Start with \`\`\`mermaid and end with \`\`\`.
3. Use \`erDiagram\`.
4. Define entities and relationships clearly.

Example Output:
\`\`\`mermaid
erDiagram
    USER ||--o{ POST : writes
\`\`\`
`;

// --- Level 8: Class Diagram ---
export const PROMPT_LEVEL_8_CLASS = `You are a strict code generator.
Task: Generate a MermaidJS Class Diagram based on the classes/interfaces found.

CRITICAL RULES:
1. RETURN ONLY THE CODE BLOCK. NO conversational text.
2. Start with \`\`\`mermaid and end with \`\`\`.
3. Use \`classDiagram\`.
4. Show relationships (inheritance, composition).
5. Use simple alphanumeric names for classes.

Example Output:
\`\`\`mermaid
classDiagram
    class Animal
    class Dog
    Animal <|-- Dog
\`\`\`
`;

// --- Level 9: Infrastructure Diagram ---
export const PROMPT_LEVEL_9_INFRA = `You are a strict code generator.
Task: Generate a MermaidJS Flowchart showing infrastructure (Docker, Database, Cloud).

CRITICAL RULES:
1. RETURN ONLY THE CODE BLOCK. NO conversational text.
2. Start with \`\`\`mermaid and end with \`\`\`.
3. Use \`flowchart TD\`.
4. Use box shapes for components.
5. WRAP ALL NODE LABELS IN QUOTES.

Example Output:
\`\`\`mermaid
flowchart TD
    Client["Client"] --> API["API Server"]
    API --> DB[("Database")]
\`\`\`
`;
