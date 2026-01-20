import { RepoSummary } from '../types';

const formatTypeLabel = (type: RepoSummary['type']) => {
  switch (type) {
    case 'frontend':
      return 'فرانت‌اند';
    case 'backend':
      return 'بک‌اند';
    case 'fullstack':
      return 'فول‌استک';
    default:
      return 'نامشخص';
  }
};

const selectByType = <T,>(type: RepoSummary['type'], options: Record<RepoSummary['type'], T>): T => {
  return options[type];
};

const buildAdaptiveToc = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'Design System و الگوی طراحی',
      'Components Library و ترکیب کامپوننت‌ها',
      'Routing و مسیرهای اصلی',
      'State Management و چرخه داده',
      'Accessibility و تجربه کاربر'
    ],
    backend: [
      'API Contracts و استانداردهای پاسخ',
      'دیتابیس، مدل داده و مهاجرت‌ها (Migrations)',
      'Authentication و مدیریت دسترسی',
      'Rate Limiting و محافظت از سرویس',
      'Monitoring و Observability'
    ],
    fullstack: [
      'بخش فرانت‌اند: Design System، Components، Routing',
      'بخش بک‌اند: API Contracts، دیتابیس، Authentication',
      'بخش همگرا: Contractهای مشترک و مدل‌های داده',
      'End-to-End Flow از UI تا API و DB',
      'استراتژی‌های استقرار هماهنگ'
    ],
    unknown: [
      'ساختار کلی پروژه',
      'فایل‌ها و مسیرهای مهم',
      'قراردادها و وابستگی‌های کلیدی',
      'راهنمای اجرا و دیپلوی',
      'نقاط حساس و ریسک‌ها'
    ]
  });
};

const buildDiagramPriorities = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'نمودار جریان UI/UX برای سناریوهای اصلی',
      'معماری کامپوننت‌ها و ارتباط بین آن‌ها',
      'نمودار حالت‌ها (State Transitions)'
    ],
    backend: [
      'ERD برای مدل داده و روابط',
      'نمودار توالی درخواست/پاسخ',
      'معماری سرویس‌ها و وابستگی‌های داخلی'
    ],
    fullstack: [
      'نمودار End-to-End مسیر داده از UI تا DB',
      'نمودار توالی برای تعامل‌های اصلی',
      'مرزبندی دامنه و سرویس‌ها'
    ],
    unknown: [
      'نمودار اجزای اصلی سیستم',
      'نمودار جریان داده بین بخش‌ها',
      'نمودار زیرساخت و استقرار'
    ]
  });
};

const buildRunDeployNotes = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'اشاره به build pipeline و خروجی استاتیک',
      'Static hosting و پیکربندی CDN',
      'متغیرهای محیطی مرتبط با APIها',
      'پیکربندی CI برای lint/test/build'
    ],
    backend: [
      'تعریف env vars و مدیریت secrets',
      'اجرای migrations و نسخه‌بندی دیتابیس',
      'راه‌اندازی workerها و queueها',
      'استقرار روی VM یا container (Docker)'
    ],
    fullstack: [
      'راهنمای اجرای هم‌زمان client/server',
      'تنظیم چند کانفیگ محیطی برای هر لایه',
      'راهکارهای استقرار یکپارچه یا جداگانه',
      'پایش و مانیتورینگ سرتاسری'
    ],
    unknown: [
      'پیش‌نیازهای اجرا و وابستگی‌ها',
      'الگوی استقرار پیشنهادی',
      'راهنمای تنظیم متغیرهای محیطی'
    ]
  });
};

const buildExampleFocus = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'مثال‌های Component composition و ساخت کامپوننت‌های قابل‌استفاده مجدد',
      'مثال‌های استفاده از props و الگوهای data flow',
      'مثال‌های hooks برای مدیریت state و side effects'
    ],
    backend: [
      'مثال‌های طراحی endpoint و استانداردسازی پاسخ‌ها',
      'مثال‌های query flows از API تا دیتابیس',
      'مثال‌های service layers و جداسازی لایه بیزینس'
    ],
    fullstack: [
      'مثال جریان ثبت‌نام از UI تا DB',
      'مثال همگام‌سازی مدل داده مشترک',
      'مثال end-to-end test برای یک سناریو'
    ],
    unknown: [
      'نمونه ساخت یک ماژول جدید',
      'نمونه افزودن قابلیت جدید به هسته پروژه'
    ]
  });
};

const buildTestingGuide = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'UI tests با Playwright/Cypress',
      'Snapshot tests برای کامپوننت‌ها',
      'تست دسترسی‌پذیری (a11y)'
    ],
    backend: [
      'Integration tests برای APIها',
      'Contract tests برای هماهنگی سرویس‌ها',
      'Load tests برای پایداری در فشار'
    ],
    fullstack: [
      'تست end-to-end با داده واقعی',
      'تست‌های یکپارچه بین لایه‌ها',
      'تست مهاجرت دیتابیس و rollback'
    ],
    unknown: [
      'تست‌های پایه برای مسیرهای بحرانی',
      'پایش رگرسیون با سناریوهای اصلی'
    ]
  });
};

const buildOnboardingPath = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'شروع از Design/Components و Design System',
      'مرور صفحات کلیدی و الگوی روتینگ',
      'آشنایی با state و data fetching'
    ],
    backend: [
      'شروع از API و Data Models',
      'شناخت سرویس‌ها و لایه‌های بیزینس',
      'درک روند احراز هویت و امنیت'
    ],
    fullstack: [
      'مسیر مرحله‌ای UI → API → DB',
      'مطالعه قراردادهای مشترک',
      'شناخت استقرار و پیکربندی‌ها'
    ],
    unknown: [
      'مرور ساختار پوشه‌ها و نقاط ورود',
      'بررسی وابستگی‌های مهم و پیکربندی‌ها'
    ]
  });
};

const buildGlossary = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: ['Component', 'Props', 'State', 'Routing', 'Accessibility'],
    backend: ['Endpoint', 'Schema', 'Migration', 'Middleware', 'Rate Limiting'],
    fullstack: ['Contract', 'API', 'DTO', 'Session', 'Pipeline'],
    unknown: ['Module', 'Service', 'Config', 'Pipeline', 'Dependency']
  });
};

const buildRisks = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'Performance bottlenecks در render',
      'افزایش bundle size و تاثیر بر زمان بارگذاری',
      'ناهماهنگی بین کامپوننت‌ها و UX'
    ],
    backend: [
      'افزایش latency در مسیرهای پرمصرف',
      'ریسک‌های امنیتی و کنترل دسترسی',
      'چالش‌های consistency و تراکنش‌ها'
    ],
    fullstack: [
      'ناهماهنگی قراردادهای مشترک',
      'ریسک‌های همزمانی و همگام‌سازی داده',
      'وابستگی‌های دوطرفه در استقرار'
    ],
    unknown: [
      'ریسک‌های ناشی از نبود تست کافی',
      'پراکندگی مسئولیت‌ها و پیچیدگی معماری'
    ]
  });
};

const buildFaq = (type: RepoSummary['type']) => {
  return selectByType(type, {
    frontend: [
      'چطور theme را تغییر دهیم؟',
      'چطور یک صفحه جدید اضافه کنیم؟',
      'چطور داده‌ها را cache کنیم؟'
    ],
    backend: [
      'چطور endpoint جدید اضافه کنیم؟',
      'چطور migration بنویسیم؟',
      'چطور rate limiting را تنظیم کنیم؟'
    ],
    fullstack: [
      'چطور قراردادهای مشترک را همگام نگه داریم؟',
      'چطور یک سناریوی end-to-end اضافه کنیم؟',
      'چطور استقرار جداگانه را مدیریت کنیم؟'
    ],
    unknown: [
      'از کجا باید شروع کنیم؟',
      'کدام بخش‌ها حیاتی‌تر هستند؟'
    ]
  });
};

export const buildRepoInsights = (summary: RepoSummary | null, topLanguage?: string) => {
  if (!summary) return { readerSummary: '', insightsMarkdown: '' };

  const typeLabel = formatTypeLabel(summary.type);
  const tocItems = buildAdaptiveToc(summary.type);
  const diagramItems = buildDiagramPriorities(summary.type);
  const runDeployItems = buildRunDeployNotes(summary.type);
  const exampleItems = buildExampleFocus(summary.type);
  const testingItems = buildTestingGuide(summary.type);
  const onboardingItems = buildOnboardingPath(summary.type);
  const glossaryItems = buildGlossary(summary.type);
  const riskItems = buildRisks(summary.type);
  const faqItems = buildFaq(summary.type);

  const readerSummary = `این پروژه **${typeLabel}** است و تمرکز اصلی مستندات روی بخش‌های کلیدی مرتبط با آن خواهد بود${topLanguage ? ` (زبان غالب: ${topLanguage})` : ''}.`;

  const insightsMarkdown = [
    '## 🧭 بینش‌های هوشمند مبتنی بر نوع پروژه',
    '',
    '### 1) ساختار پیشنهادی مستندات (Adaptive TOC)',
    tocItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 2) اولویت‌بندی نمودارها و دیاگرام‌ها',
    diagramItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 3) پیش‌نویس راهنمای اجرا و دیپلوی',
    runDeployItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 4) خلاصه خواننده‌محور',
    `- ${readerSummary}`,
    '',
    '### 5) مثال‌های آموزشی پیشنهادی',
    exampleItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 6) راهنمای تست اختصاصی',
    testingItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 7) مسیر Onboarding سریع',
    onboardingItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 8) واژگان کلیدی (Glossary)',
    glossaryItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 9) ریسک‌ها و نقاط حساس',
    riskItems.map(item => `- ${item}`).join('\n'),
    '',
    '### 10) پرسش‌های پرتکرار (FAQ)',
    faqItems.map(item => `- ${item}`).join('\n')
  ].join('\n');

  return { readerSummary, insightsMarkdown };
};
