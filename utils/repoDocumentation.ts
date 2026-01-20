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

const parsePackageJsonDeps = (content?: string) => {
  if (!content) return [] as string[];
  try {
    const parsed = JSON.parse(content);
    return [
      ...Object.keys(parsed.dependencies || {}),
      ...Object.keys(parsed.devDependencies || {})
    ];
  } catch (error) {
    return [];
  }
};

const detectRepoSignals = (filePaths: string[], dependencies: string[]) => {
  const lowerDeps = new Set(dependencies.map(dep => dep.toLowerCase()));
  const pathSet = filePaths.map(path => path.toLowerCase());

  const pickFirst = (labels: string[], candidates: string[]) => {
    for (const candidate of candidates) {
      if (lowerDeps.has(candidate)) return labels[candidates.indexOf(candidate)] ?? candidate;
    }
    return '';
  };

  const uiFramework = pickFirst(
    ['React', 'Next.js', 'Vue', 'Nuxt', 'Svelte', 'Angular', 'Solid', 'Astro'],
    ['react', 'next', 'vue', 'nuxt', 'svelte', '@angular/core', 'solid-js', 'astro']
  );

  const router = pickFirst(
    ['React Router', 'Next.js Router', 'Vue Router', 'TanStack Router', 'Angular Router'],
    ['react-router', 'next', 'vue-router', '@tanstack/router', '@angular/router']
  );

  const stateManagement = pickFirst(
    ['Redux', 'Zustand', 'MobX', 'Pinia', 'Vuex', 'Recoil', 'TanStack Query'],
    ['redux', 'zustand', 'mobx', 'pinia', 'vuex', 'recoil', '@tanstack/react-query']
  );

  const accessibility = lowerDeps.has('eslint-plugin-jsx-a11y') ? 'a11y linting' : '';

  const auth = pickFirst(
    ['JWT', 'Passport', 'Auth0', 'NextAuth', 'Supabase Auth'],
    ['jsonwebtoken', 'passport', 'auth0', 'next-auth', '@supabase/supabase-js']
  );

  const rateLimiting = pickFirst(
    ['express-rate-limit', 'rate-limiter-flexible'],
    ['express-rate-limit', 'rate-limiter-flexible']
  );

  const monitoring = pickFirst(
    ['Sentry', 'OpenTelemetry', 'Prometheus'],
    ['@sentry/node', '@sentry/react', '@opentelemetry/api', 'prom-client']
  );

  const database = pickFirst(
    ['Prisma', 'Mongoose', 'Sequelize', 'TypeORM', 'Drizzle', 'Supabase'],
    ['prisma', 'mongoose', 'sequelize', 'typeorm', 'drizzle-orm', '@supabase/supabase-js']
  );

  const queue = pickFirst(
    ['BullMQ', 'Bull', 'Bee-Queue', 'RabbitMQ'],
    ['bullmq', 'bull', 'bee-queue', 'amqplib']
  );

  const hasComponentsDir = pathSet.some(path => path.includes('/components/'));
  const hasPagesDir = pathSet.some(path => path.includes('/pages/'));
  const hasRoutesDir = pathSet.some(path => path.includes('/routes/') || path.includes('/api/'));
  const hasModelsDir = pathSet.some(path => path.includes('/models/') || path.includes('/schema'));
  const hasMigrations = pathSet.some(path => path.includes('/migrations/') || path.includes('migration'));

  return {
    uiFramework,
    router,
    stateManagement,
    accessibility,
    auth,
    rateLimiting,
    monitoring,
    database,
    queue,
    hasComponentsDir,
    hasPagesDir,
    hasRoutesDir,
    hasModelsDir,
    hasMigrations
  };
};

const buildAdaptiveToc = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  const frontendItems = [
    `Design System و الگوی طراحی${signals.uiFramework ? ` (${signals.uiFramework})` : ''}`,
    `Components Library و ترکیب کامپوننت‌ها${signals.hasComponentsDir ? ' (پوشه components موجود است)' : ''}`,
    `Routing و مسیرهای اصلی${signals.router ? ` (${signals.router})` : ''}`,
    `State Management و چرخه داده${signals.stateManagement ? ` (${signals.stateManagement})` : ''}`,
    `Accessibility و تجربه کاربر${signals.accessibility ? ` (${signals.accessibility})` : ''}`
  ];

  const backendItems = [
    `API Contracts و استانداردهای پاسخ${signals.hasRoutesDir ? ' (مسیرهای API شناسایی شد)' : ''}`,
    `دیتابیس، مدل داده و مهاجرت‌ها (Migrations)${signals.database ? ` (${signals.database})` : ''}`,
    `Authentication و مدیریت دسترسی${signals.auth ? ` (${signals.auth})` : ''}`,
    `Rate Limiting و محافظت از سرویس${signals.rateLimiting ? ` (${signals.rateLimiting})` : ''}`,
    `Monitoring و Observability${signals.monitoring ? ` (${signals.monitoring})` : ''}`
  ];

  return selectByType(type, {
    frontend: frontendItems,
    backend: backendItems,
    fullstack: [
      `بخش فرانت‌اند: ${frontendItems.slice(0, 3).join('، ')}`,
      `بخش بک‌اند: ${backendItems.slice(0, 3).join('، ')}`,
      `بخش همگرا: Contractهای مشترک و مدل‌های داده${signals.database ? ` (${signals.database})` : ''}`,
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

const buildDiagramPriorities = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      'نمودار جریان UI/UX برای سناریوهای اصلی',
      `معماری کامپوننت‌ها و ارتباط بین آن‌ها${signals.hasComponentsDir ? ' (کامپوننت‌های شناسایی‌شده)' : ''}`,
      'نمودار حالت‌ها (State Transitions)'
    ],
    backend: [
      `ERD برای مدل داده و روابط${signals.database ? ` (${signals.database})` : ''}`,
      'نمودار توالی درخواست/پاسخ',
      `معماری سرویس‌ها و وابستگی‌های داخلی${signals.hasRoutesDir ? ' (مسیرهای سرویس شناسایی شد)' : ''}`
    ],
    fullstack: [
      'نمودار End-to-End مسیر داده از UI تا DB',
      'نمودار توالی برای تعامل‌های اصلی',
      `مرزبندی دامنه و سرویس‌ها${signals.hasRoutesDir ? ' (مرز API شناسایی شد)' : ''}`
    ],
    unknown: [
      'نمودار اجزای اصلی سیستم',
      'نمودار جریان داده بین بخش‌ها',
      'نمودار زیرساخت و استقرار'
    ]
  });
};

const buildRunDeployNotes = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      `اشاره به build pipeline و خروجی استاتیک${signals.uiFramework ? ` (${signals.uiFramework})` : ''}`,
      'Static hosting و پیکربندی CDN',
      'متغیرهای محیطی مرتبط با APIها',
      'پیکربندی CI برای lint/test/build'
    ],
    backend: [
      'تعریف env vars و مدیریت secrets',
      `اجرای migrations و نسخه‌بندی دیتابیس${signals.hasMigrations ? ' (مهاجرت‌ها شناسایی شد)' : ''}`,
      `راه‌اندازی workerها و queueها${signals.queue ? ` (${signals.queue})` : ''}`,
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

const buildExampleFocus = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      'مثال‌های Component composition و ساخت کامپوننت‌های قابل‌استفاده مجدد',
      `مثال‌های استفاده از props و الگوهای data flow${signals.uiFramework ? ` (${signals.uiFramework})` : ''}`,
      `مثال‌های hooks برای مدیریت state و side effects${signals.stateManagement ? ` (${signals.stateManagement})` : ''}`
    ],
    backend: [
      'مثال‌های طراحی endpoint و استانداردسازی پاسخ‌ها',
      `مثال‌های query flows از API تا دیتابیس${signals.database ? ` (${signals.database})` : ''}`,
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

const buildTestingGuide = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      'UI tests با Playwright/Cypress',
      'Snapshot tests برای کامپوننت‌ها',
      `تست دسترسی‌پذیری (a11y)${signals.accessibility ? ' (بر اساس ابزار شناسایی‌شده)' : ''}`
    ],
    backend: [
      `Integration tests برای APIها${signals.hasRoutesDir ? ' (مسیرهای API شناسایی شد)' : ''}`,
      `Contract tests برای هماهنگی سرویس‌ها${signals.auth ? ` (${signals.auth})` : ''}`,
      `Load tests برای پایداری در فشار${signals.monitoring ? ` (${signals.monitoring})` : ''}`
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

const buildOnboardingPath = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      `شروع از Design/Components و Design System${signals.hasComponentsDir ? ' (components موجود است)' : ''}`,
      `مرور صفحات کلیدی و الگوی روتینگ${signals.router ? ` (${signals.router})` : ''}`,
      `آشنایی با state و data fetching${signals.stateManagement ? ` (${signals.stateManagement})` : ''}`
    ],
    backend: [
      `شروع از API و Data Models${signals.hasModelsDir ? ' (مدل‌ها شناسایی شد)' : ''}`,
      'شناخت سرویس‌ها و لایه‌های بیزینس',
      `درک روند احراز هویت و امنیت${signals.auth ? ` (${signals.auth})` : ''}`
    ],
    fullstack: [
      'مسیر مرحله‌ای UI → API → DB',
      `مطالعه قراردادهای مشترک${signals.database ? ` (${signals.database})` : ''}`,
      'شناخت استقرار و پیکربندی‌ها'
    ],
    unknown: [
      'مرور ساختار پوشه‌ها و نقاط ورود',
      'بررسی وابستگی‌های مهم و پیکربندی‌ها'
    ]
  });
};

const buildGlossary = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      'Component',
      'Props',
      'State',
      `Routing${signals.router ? ` (${signals.router})` : ''}`,
      'Accessibility'
    ],
    backend: [
      'Endpoint',
      `Schema${signals.database ? ` (${signals.database})` : ''}`,
      'Migration',
      'Middleware',
      'Rate Limiting'
    ],
    fullstack: ['Contract', 'API', 'DTO', 'Session', 'Pipeline'],
    unknown: ['Module', 'Service', 'Config', 'Pipeline', 'Dependency']
  });
};

const buildRisks = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      'Performance bottlenecks در render',
      `افزایش bundle size و تاثیر بر زمان بارگذاری${signals.uiFramework ? ` (${signals.uiFramework})` : ''}`,
      'ناهماهنگی بین کامپوننت‌ها و UX'
    ],
    backend: [
      'افزایش latency در مسیرهای پرمصرف',
      `ریسک‌های امنیتی و کنترل دسترسی${signals.auth ? ` (${signals.auth})` : ''}`,
      `چالش‌های consistency و تراکنش‌ها${signals.database ? ` (${signals.database})` : ''}`
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

const buildFaq = (type: RepoSummary['type'], signals: ReturnType<typeof detectRepoSignals>) => {
  return selectByType(type, {
    frontend: [
      'چطور theme را تغییر دهیم؟',
      `چطور یک صفحه جدید اضافه کنیم؟${signals.router ? ` (${signals.router})` : ''}`,
      `چطور داده‌ها را cache کنیم؟${signals.stateManagement ? ` (${signals.stateManagement})` : ''}`
    ],
    backend: [
      `چطور endpoint جدید اضافه کنیم؟${signals.hasRoutesDir ? ' (مسیرهای API شناسایی شد)' : ''}`,
      `چطور migration بنویسیم؟${signals.hasMigrations ? ' (مهاجرت‌ها موجود است)' : ''}`,
      `چطور rate limiting را تنظیم کنیم؟${signals.rateLimiting ? ` (${signals.rateLimiting})` : ''}`
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

export const buildRepoInsights = (
  summary: RepoSummary | null,
  options: {
    topLanguage?: string;
    filePaths?: string[];
    configContents?: Record<string, string>;
  } = {}
) => {
  if (!summary) return { readerSummary: '', insightsMarkdown: '' };

  const typeLabel = formatTypeLabel(summary.type);
  const dependencies = parsePackageJsonDeps(options.configContents?.['package.json']);
  const signals = detectRepoSignals(options.filePaths ?? [], dependencies);
  const tocItems = buildAdaptiveToc(summary.type, signals);
  const diagramItems = buildDiagramPriorities(summary.type, signals);
  const runDeployItems = buildRunDeployNotes(summary.type, signals);
  const exampleItems = buildExampleFocus(summary.type, signals);
  const testingItems = buildTestingGuide(summary.type, signals);
  const onboardingItems = buildOnboardingPath(summary.type, signals);
  const glossaryItems = buildGlossary(summary.type, signals);
  const riskItems = buildRisks(summary.type, signals);
  const faqItems = buildFaq(summary.type, signals);

  const readerSummary = `این پروژه **${typeLabel}** است و تمرکز اصلی مستندات روی بخش‌های کلیدی مرتبط با آن خواهد بود${options.topLanguage ? ` (زبان غالب: ${options.topLanguage})` : ''}.`;

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
