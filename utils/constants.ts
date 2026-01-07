

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

مثال خروجی (Example Output):
# نام پروژه
این پروژه یک سیستم مدیریت محتوا است که با React و Node.js توسعه یافته است.

## 🛠 تکنولوژی‌های استفاده شده
- زبان: TypeScript
- فریم‌ورک: Next.js

## 🚀 راهنمای نصب
\`\`\`bash
npm install
npm run dev
\`\`\`

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

// --- Level 2: Code Documentation (Updated for Deep Analysis) ---
export const PROMPT_LEVEL_2_CODE = `ROLE: Senior Software Architect & Technical Writer.
TASK: Perform a DEEP CODE ANALYSIS of the provided source file.
TARGET AUDIENCE: Senior Developers who need to understand, debug, or refactor this code.

CRITICAL INSTRUCTIONS:
1. **Language:** The visible documentation MUST be in **Persian (Farsi)**.
2. **Detail Level:** Do NOT just summarize. Explain *HOW* the code works, not just *WHAT* it does.
3. **Structure:** Follow the output format strictly.

OUTPUT FORMAT:

# تحلیل فایل: [نام فایل]

## 🎯 هدف و مسئولیت (Purpose)
(یک پاراگراف فنی و دقیق درباره اینکه این فایل چه کاری انجام می‌دهد و چرا وجود دارد)

## ⚙️ تحلیل توابع و کلاس‌ها (Deep Dive)
(برای هر کلاس یا تابع اصلی، این ساختار را تکرار کن:)

### 🔹 \`[نام کلاس/تابع]\`
- **نوع:** (مثلاً: React Component, API Handler, Helper Function)
- **ورودی‌ها (Inputs):**
  - \`نام پارامتر\`: (نوع دیتا) - توضیح دقیق نقش این پارامتر
- **خروجی (Return):**
  - (نوع خروجی) - توضیح آنچه برمی‌گرداند.
- **منطق عملکرد (Logic Flow):**
  1. (توضیح مرحله ۱ لاجیک)
  2. (توضیح مرحله ۲...)
  3. (توضیح نحوه مدیریت خطا یا انشعاب شرطی)
- **مثال استفاده (Usage):**
\`\`\`typescript
// کد کوتاه نمونه نحوه فراخوانی
\`\`\`

## 🧩 مدیریت وضعیت و هوک‌ها (State & Hooks)
(اگر فایل React است: توضیح stateها و useEffectها. اگر Backend است: دیتابیس یا سرویس‌های خارجی)

## ⚠️ نکات مهم و لبه‌ای (Edge Cases)
- (نکات امنیتی، پرفورمنس، یا باگ‌های احتمالی)

---
**SUMMARY_FOR_CONTEXT**
(Technical summary in English strictly for RAG context. Focus on exports and dependencies. Max 50 words.)
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

// --- Level 5: Sequence Diagram (Updated: Professional) ---
export const PROMPT_LEVEL_5_SEQUENCE = `ROLE: Senior Software Architect.
TASK: Create a DETAILED MermaidJS Sequence Diagram for the main logic flow.

CRITICAL RULES:
1. **OUTPUT ONLY CODE:** Start with \`\`\`mermaid.
2. **Features:** Use \`autonumber\`, \`box\`, \`alt\`, \`opt\`.
3. **Participants:** Define participants explicitly at the top with clear names.
4. **Labels:** ALL messages MUST be in Persian (Farsi) and wrapped in double quotes: \`A->>B: "پیام فارسی"\`.

Example Output:
\`\`\`mermaid
sequenceDiagram
    autonumber
    box "Client Side" #f9f9f9
        participant U as "User"
        participant C as "Client"
    end
    box "Server Side" #ececff
        participant S as "Server"
        participant D as "Database"
    end
    
    U->>C: "Click Button"
    activate C
    C->>S: "API Request"
    activate S
    S->>D: "Query"
    D-->>S: "Result"
    S-->>C: "Response"
    deactivate S
    C-->>U: "Show Data"
    deactivate C
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
export const PROMPT_LEVEL_7_ERD = `STRICT MODE: ACTIVATED.
ROLE: Text-to-MermaidJS Converter.

TASK: Create an 'erDiagram'.

CRITICAL RULES:
1. OUTPUT ONLY THE CODE BLOCK. Start immediately with \`\`\`mermaid.
2. NO summaries. NO explanations.
3. Syntax:
   - Use "erDiagram"
   - Quote ALL labels: USER ||--o{ POST : "writes"
   - PascalCase for entities (User, not user).

Example Output:
\`\`\`mermaid
erDiagram
    USER ||--o{ POST : "writes"
\`\`\`
`;

// --- Level 8: Class Diagram ---
export const PROMPT_LEVEL_8_CLASS = `STRICT MODE: ACTIVATED.
ROLE: Text-to-MermaidJS Converter.

TASK: Create a 'classDiagram'.

CRITICAL RULES:
1. OUTPUT ONLY THE CODE BLOCK. Start immediately with \`\`\`mermaid.
2. NO summaries. NO explanations.
3. Syntax:
   - Use "classDiagram"
   - No spaces in class names.

Example Output:
\`\`\`mermaid
classDiagram
    class User {
      +String name
    }
    class Admin
    User <|-- Admin
\`\`\`
`;

// --- Level 9: Infrastructure Diagram (Updated: Professional) ---
export const PROMPT_LEVEL_9_INFRA = `ROLE: Cloud Architect.
TASK: Create a COMPREHENSIVE MermaidJS Architecture Diagram.

CRITICAL RULES:
1. **OUTPUT ONLY CODE:** Start with \`\`\`mermaid.
2. **Grouping:** Use \`subgraph "Name"\` ... \`end\` (Ensure \`end\` is on a new line).
3. **Styling:** Use \`classDef\` to color-code.
4. **Shapes:**
   - Use \`[("Label")]\` for Databases/Storage.
   - Use \`["Label"]\` for standard components.
   - Use \`(("Label"))\` for Start/End points or small markers.
5. **Syntax:**
   - Avoid special characters in Node IDs (use \`Node1\`, \`DB_Main\`).
   - Quote ALL labels explicitly: \`id["Label Text"]\`.

Example Output:
\`\`\`mermaid
flowchart TB
    classDef client fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef service fill:#e8f5e9,stroke:#2e7d32,stroke-width:2px;
    classDef db fill:#fff3e0,stroke:#ef6c00,stroke-width:2px;

    subgraph "Client Layer"
        Browser["React App"]:::client
        Mobile["Mobile App"]:::client
    end

    subgraph "Backend Cluster"
        API["API Gateway"]:::service
        Auth["Auth Service"]:::service
    end

    subgraph "Data Persistence"
        Redis[("Redis Cache")]:::db
        PG[("PostgreSQL")]:::db
    end

    Browser --> API
    API --> Auth
    Auth --> PG
\`\`\`
`;