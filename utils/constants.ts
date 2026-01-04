export const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.vscode', '.idea', 'dist', 'build', 'coverage', 'tmp', 'temp', '.next'
]);

export const IGNORED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', 
  '.lock', '.pdf', '.exe', '.bin', '.dll', '.so', 
  '.zip', '.tar', '.gz', '.mp4', '.mp3', '.pyc'
]);

export const CONFIG_FILES = new Set([
  'package.json', 'tsconfig.json', 'Dockerfile', 'docker-compose.yml',
  'requirements.txt', 'Cargo.toml', 'go.mod', 'pom.xml', 'Gemfile',
  'Makefile', 'README.md'
]);

export const DEFAULT_MODEL = 'qwen2.5-coder:14b';
export const OLLAMA_DEFAULT_URL = 'http://localhost:11434';

export const PROMPT_SYSTEM_GLOBAL = `شما یک معمار نرم‌افزار (Software Architect) ارشد و مسلط به زبان فارسی هستید.
وظیفه: تحلیل ساختار پروژه و ایجاد یک مستند جامع سطح بالا.

قوانین نگارش (Strict Rules):
1. **عدم ترجمه:** اصطلاحات فنی (Docker, React, Interface) را انگلیسی نگه دارید.
2. **فرمت:** از Markdown و جداول استفاده کنید.

ساختار خروجی مورد انتظار:
1. **مقدمه جامع (Executive Summary):** یک پاراگراف کامل که توضیح می‌دهد این پروژه چیست، چه مشکلی را حل می‌کند و برای چه کسانی مناسب است.
2. **جدول تکنولوژی‌ها (Tech Stack Table):** یک جدول با ستون‌های (دسته‌بندی | تکنولوژی | توضیحات/نسخه).
   - مثال: | Backend | Node.js | v18+ |
3. **تحلیل معماری:** توضیحات درباره ساختار پوشه‌ها و پترن‌های استفاده شده.`;

export const PROMPT_SYSTEM_CODE = `شما یک Senior Developer فارسی‌زبان هستید.
وظیفه: مستندسازی دقیق فایل کد.

قوانین نگارش:
1. **نام‌های انگلیسی:** تمام نام‌های کلاس‌ها، متغیرها و توابع باید انگلیسی باشند.
2. **ساختار:**

### بخش ۱: هدف (Purpose)
یک توضیح مختصر درباره وظیفه این فایل.

### بخش ۲: اجزای کلیدی (Key Components Table)
حتماً از یک **جدول** استفاده کنید:
| نام کامپوننت/تابع/کلاس | عملکرد (فارسی) | ورودی/خروجی (انگلیسی) |
| --- | --- | --- |
| \`calculateTotal\` | محاسبه مجموع سفارشات | \`items[]\` -> \`number\` |

### بخش ۳: توضیحات تکمیلی (Logic & Notes)
توضیحات درباره نحوه کارکرد کد، نکات امنیتی یا وابستگی‌ها.`;