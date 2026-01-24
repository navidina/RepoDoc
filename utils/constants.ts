
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
  'schema.prisma', 'main.tf', '.env.example', 'tailwind.config.js', 'next.config.js'
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

// --- Level 2: Code Documentation (Updated for Developer Guide) ---
export const PROMPT_LEVEL_2_CODE = `ROLE: Senior Lead Developer onboarding a Junior Dev.
TASK: Explain the internals of this file so a new developer can MODIFY or EXTEND it safely.

INPUT:
1. File Path & Metadata
2. Source Code
3. Symbol Context (What uses this file?)

CRITICAL INSTRUCTION: Output MUST be in **Persian (Farsi)**.

OUTPUT STRUCTURE (Markdown):

# تحلیل ماژول: [نام فایل]

## 🔍 مکانیزم داخلی (Internal Mechanics)
(توضیح دهید کد *چگونه* کار می‌کند، نه فقط چه کاری انجام می‌دهد. اگر الگوریتم خاصی دارد، آن را باز کنید.)

## 🛠 راهنمای توسعه و تغییر (Modification Guide)
- **اگر بخواهم [عملکرد مهم فایل] را تغییر دهم:** توضیح دهید کدام توابع باید ویرایش شوند.
- **نقاط اتصال (Extension Points):** آیا اینتررفیس یا کلاسی برای ارث‌بری وجود دارد؟

## 🔗 تحلیل وابستگی (Dependency Impact)
- **این فایل وابسته است به:** (لیست ماژول‌های ایمپورت شده مهم)
- **تغییر در این فایل روی موارد زیر اثر می‌گذارد:** (توضیح بر اساس ورودی Context که چه فایل‌هایی از این استفاده می‌کنند)

## ⚠️ نکات کلیدی و تست
(نکات امنیتی، پرفورمنس، یا نحوه تست کردن این ماژول به صورت ایزوله)

---
**SUMMARY_FOR_CONTEXT**
(Technical summary in English strictly for RAG context. Focus on exports and logic. Max 50 words.)
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

// --- Level 4: Cookbook (New) ---
export const PROMPT_COOKBOOK = `ROLE: Technical Lead / Mentor.
TASK: Create a "Developer Cookbook" with 3-5 practical scenarios based on the project structure.
LANGUAGE: Persian (Farsi).

INPUT:
1. File Tree
2. Package.json / Config files

OUTPUT FORMAT:
# 🍲 کتاب آشپزی توسعه (Developer Cookbook)

این بخش شامل سناریوهای رایج برای توسعه این پروژه است.

## سناریو ۱: [عنوان سناریو، مثلا: نحوه اضافه کردن یک API جدید]
**گام ۱:** فایل [مسیر فایل] را باز کنید.
**گام ۲:** کلاس/تابع [نام] را اکستند کنید.
**گام ۳:** [توضیح گام بعدی...]

## سناریو ۲: [عنوان سناریو، مثلا: نحوه ساخت کامپوننت جدید]
...

(Create scenarios relevant to the detected tech stack e.g., React, Express, Python)`;

// --- Level 5: Sequence Diagram ---
export const PROMPT_LEVEL_5_SEQUENCE = `ROLE: Senior Software Architect.
TASK: Create a DETAILED MermaidJS Sequence Diagram for the main logic flow.

CRITICAL RULES:
1. **OUTPUT ONLY CODE:** Start with \`\`\`mermaid.
2. **Features:** Use \`autonumber\`, \`box\`, \`alt\`, \`opt\`.
3. **Participants:** Define participants explicitly at the top with clear names.
4. **Labels:** ALL messages MUST be in Persian (Farsi) and wrapped in double quotes.
5. **Activation:** You MUST pair every \`activate Participant\` with a corresponding \`deactivate Participant\`.

Example Output:
\`\`\`mermaid
sequenceDiagram
    autonumber
    participant U as "User"
    participant S as "Server"
    U->>S: "Login"
    activate S
    S-->>U: "Token"
    deactivate S
\`\`\`
`;

// --- Level 7: ERD (Entity Relationship Diagram) ---
export const PROMPT_LEVEL_7_ERD = `STRICT MODE: ACTIVATED.
ROLE: Text-to-MermaidJS Converter.
TASK: Create an 'erDiagram' based on SQL/Prisma schemas provided.

CRITICAL RULES:
1. OUTPUT ONLY THE CODE BLOCK. Start immediately with \`\`\`mermaid.
2. NO summaries. NO explanations.
3. Syntax: "erDiagram", Quote labels.

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
2. NO summaries.
3. Syntax: "classDiagram", No spaces in class names.
`;

// --- Level 9: Infrastructure Diagram ---
export const PROMPT_LEVEL_9_INFRA = `ROLE: Cloud Architect.
TASK: Create a MermaidJS Architecture Diagram including Config Files & Env Setup.

CRITICAL RULES:
1. **OUTPUT ONLY CODE:** Start with \`\`\`mermaid.
2. **Grouping:** Use \`subgraph\`.
3. **Styling:** Use \`classDef\`.

Example Output:
\`\`\`mermaid
flowchart TB
    classDef config fill:#fff3e0,stroke:#ef6c00;
    Config["config.json"]:::config
    App["Application"]
    Config --> App
\`\`\`
`;

// --- New Data Flow Diagram ---
export const PROMPT_DATA_FLOW = `ROLE: System Architect.
TASK: Create a MermaidJS Flowchart showing key DATA FLOWS in the system.

Focus on:
1. User Input -> Handler -> State Update -> UI Re-render
2. API Call -> Service -> Data Processing -> Store

CRITICAL: Output ONLY the mermaid code block. Use 'flowchart LR' or 'TB'. All labels in Persian.

Example:
\`\`\`mermaid
flowchart LR
    UserInput("ورودی کاربر") --> Handler[هندلر]
    Handler --> DB[("دیتابیس")]
\`\`\`
`;

// --- Level 10: Use Case Diagram ---
export const PROMPT_USE_CASE = `ROLE: Product Manager & System Architect.
TASK: Create a Use Case Diagram using MermaidJS 'flowchart LR'.

CRITICAL RULES:
1. **Actors:** Define actors using double parentheses: \`Admin((Admin))\`.
2. **Use Cases:** Define use cases using rounded brackets: \`Login(ورود به سیستم)\`.
3. **Relationships:** Connect actors to use cases with arrows: \`Admin --> Login\`.
4. **Subsystems:** Group related use cases inside \`subgraph\`.
5. **Language:** Actor names in English, Use Case descriptions in Persian.

Example Output:
\`\`\`mermaid
flowchart LR
    User((کاربر عادی))
    Admin((مدیر سیستم))

    subgraph "پنل کاربری"
        Login(ورود به حساب)
        ViewDash(مشاهده داشبورد)
        EditProfile(ویرایش پروفایل)
    end

    subgraph "مدیریت"
        ManageUsers(مدیریت کاربران)
        Reports(گزارش‌گیری)
    end

    User --> Login
    User --> ViewDash
    User --> EditProfile
    Admin --> Login
    Admin --> ManageUsers
    Admin --> Reports
\`\`\`
`;
