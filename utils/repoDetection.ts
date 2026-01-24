import { ProcessedFile, RepoSummary, RepoType } from '../types';

const FRONTEND_EXTENSIONS = new Set([
  '.tsx',
  '.jsx',
  '.vue',
  '.svelte',
  '.html',
  '.css',
  '.scss',
  '.sass',
  '.less'
]);

const BACKEND_EXTENSIONS = new Set([
  '.go',
  '.py',
  '.rb',
  '.php',
  '.java',
  '.kt',
  '.cs'
]);

const FRONTEND_CONFIG_FILES = [
  'vite.config',
  'next.config',
  'nuxt.config',
  'svelte.config',
  'astro.config',
  'angular.json'
];

const BACKEND_CONFIG_FILES = [
  'nest-cli.json',
  'pom.xml',
  'build.gradle',
  'composer.json',
  'rails',
  'manage.py'
];

const FRONTEND_DEPENDENCIES = new Set([
  'react',
  'react-dom',
  'next',
  'vue',
  '@vue/runtime-core',
  'nuxt',
  'svelte',
  '@angular/core',
  'solid-js',
  'astro',
  'vite',
  'tailwindcss'
]);

const BACKEND_DEPENDENCIES = new Set([
  'express',
  'fastify',
  'koa',
  '@nestjs/core',
  'hapi',
  'django',
  'flask',
  'fastapi',
  'laravel',
  'rails',
  'spring-boot',
  'gin',
  'fiber'
]);

const parsePackageJsonDeps = (content?: string) => {
  if (!content) return [];
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

const scoreFilePatterns = (paths: string[]) => {
  let frontendScore = 0;
  let backendScore = 0;

  paths.forEach((path) => {
    const lowerPath = path.toLowerCase();
    const extension = `.${lowerPath.split('.').pop() || ''}`;

    if (FRONTEND_EXTENSIONS.has(extension)) frontendScore += 1;
    if (BACKEND_EXTENSIONS.has(extension)) backendScore += 1;

    if (lowerPath.includes('/components/') || lowerPath.includes('/pages/')) {
      frontendScore += 2;
    }

    if (
      lowerPath.includes('/controllers/') ||
      lowerPath.includes('/routes/') ||
      lowerPath.includes('/services/') ||
      lowerPath.includes('/models/') ||
      lowerPath.includes('/api/') ||
      lowerPath.includes('/migrations/')
    ) {
      backendScore += 2;
    }
  });

  return { frontendScore, backendScore };
};

export const detectRepoSummary = (
  files: ProcessedFile[],
  configFiles: Record<string, string>,
  repoName: string
): RepoSummary => {
  const paths = files.map((file) => file.path);
  let { frontendScore, backendScore } = scoreFilePatterns(paths);

  Object.keys(configFiles).forEach((name) => {
    const normalized = name.toLowerCase();
    if (FRONTEND_CONFIG_FILES.some((fileName) => normalized.startsWith(fileName))) {
      frontendScore += 4;
    }
    if (BACKEND_CONFIG_FILES.some((fileName) => normalized.startsWith(fileName))) {
      backendScore += 4;
    }
  });

  const packageDependencies = parsePackageJsonDeps(configFiles['package.json']);
  packageDependencies.forEach((dependency) => {
    if (FRONTEND_DEPENDENCIES.has(dependency)) frontendScore += 3;
    if (BACKEND_DEPENDENCIES.has(dependency)) backendScore += 3;
  });

  let type: RepoType = 'unknown';
  if (frontendScore > 0 && backendScore > 0) {
    const maxScore = Math.max(frontendScore, backendScore);
    const scoreGap = Math.abs(frontendScore - backendScore);
    type = scoreGap <= maxScore * 0.4 ? 'fullstack' : frontendScore > backendScore ? 'frontend' : 'backend';
  } else if (frontendScore > 0) {
    type = 'frontend';
  } else if (backendScore > 0) {
    type = 'backend';
  }

  return {
    name: repoName || 'ناشناس',
    type,
    frontendScore,
    backendScore
  };
};
