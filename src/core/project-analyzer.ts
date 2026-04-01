/**
 * Advanced Project Analyzer
 * 
 * Intelligently detects and analyzes any type of project structure:
 * - Frontend: React, Next.js, Vue, Nuxt, Angular, Svelte, SvelteKit, Astro, Solid, Remix, Gatsby
 * - Backend: Express, Fastify, NestJS, Koa, Hono, Elysia
 * - Full-stack: T3, Blitz, RedwoodJS
 * - Mobile: React Native, Expo, Ionic
 * - Desktop: Electron, Tauri
 * - Monorepo: Turborepo, Nx, Lerna, pnpm workspaces
 */

import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export type FrameworkType = 
  // Frontend Frameworks
  | 'react' | 'next' | 'vue' | 'nuxt' | 'angular' | 'svelte' | 'sveltekit'
  | 'astro' | 'solid' | 'remix' | 'gatsby' | 'preact' | 'qwik'
  // Backend Frameworks
  | 'express' | 'fastify' | 'nestjs' | 'koa' | 'hono' | 'elysia' | 'hapi'
  // Full-stack
  | 't3' | 'blitz' | 'redwood'
  // Mobile
  | 'react-native' | 'expo' | 'ionic' | 'capacitor'
  // Desktop
  | 'electron' | 'tauri'
  // Other
  | 'node' | 'unknown';

export type BuildTool = 'vite' | 'webpack' | 'parcel' | 'rollup' | 'esbuild' | 'turbopack' | 'rspack' | 'swc' | 'tsc' | 'unknown';

export type PackageManager = 'npm' | 'yarn' | 'pnpm' | 'bun';

export type MonorepoType = 'turborepo' | 'nx' | 'lerna' | 'pnpm-workspaces' | 'yarn-workspaces' | 'npm-workspaces' | 'none';

export type ProjectLanguage = 'typescript' | 'javascript' | 'mixed';

export type StyleSolution = 'css' | 'scss' | 'sass' | 'less' | 'stylus' | 'tailwind' | 'styled-components' | 'emotion' | 'css-modules' | 'vanilla-extract' | 'panda' | 'unocss';

export type TestingFramework = 'vitest' | 'jest' | 'mocha' | 'ava' | 'tape' | 'none';

export type E2EFramework = 'playwright' | 'cypress' | 'puppeteer' | 'none';

export interface ProjectStructure {
  // Core paths
  sourceDir: string;          // e.g., 'src', 'app', 'lib'
  componentsDir: string;      // e.g., 'src/components', 'components'
  pagesDir: string;           // e.g., 'src/pages', 'pages', 'app'
  libDir: string;             // e.g., 'src/lib', 'lib', 'utils'
  stylesDir: string;          // e.g., 'src/styles', 'styles', 'css'
  publicDir: string;          // e.g., 'public', 'static'
  assetsDir: string;          // e.g., 'src/assets', 'assets'
  configDir: string;          // e.g., 'config', root
  
  // File extensions
  componentExtension: string; // e.g., '.tsx', '.jsx', '.vue', '.svelte'
  styleExtension: string;     // e.g., '.css', '.scss', '.module.css'
  
  // Entry files
  mainEntry: string;          // e.g., 'src/main.tsx', 'src/index.tsx'
  mainStyle: string;          // e.g., 'src/index.css', 'src/styles/globals.css'
  appComponent: string;       // e.g., 'src/App.tsx', 'app/layout.tsx'
  
  // Config files
  configFile: string;         // e.g., 'vite.config.ts', 'next.config.js'
  tsConfig: string;           // e.g., 'tsconfig.json'
}

export interface AnalyzedProject {
  // Basic info
  name: string;
  root: string;
  
  // Framework detection
  framework: FrameworkType;
  frameworkVersion: string;
  secondaryFrameworks: FrameworkType[];
  
  // Build and tooling
  buildTool: BuildTool;
  packageManager: PackageManager;
  language: ProjectLanguage;
  
  // Structure
  structure: ProjectStructure;
  
  // Monorepo
  isMonorepo: boolean;
  monorepoType: MonorepoType;
  workspaces: string[];
  currentWorkspace: string | null;
  
  // Features
  hasTypescript: boolean;
  styleSolutions: StyleSolution[];
  testingFramework: TestingFramework;
  e2eFramework: E2EFramework;
  
  // Installed features
  installedFeatures: string[];
  
  // SlyxUp specific
  isSlyxUp: boolean;
  slyxupVersion: string | null;
  
  // Package info
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  scripts: Record<string, string>;
  
  // Files
  rootFiles: string[];
  hasGit: boolean;
}

// ============================================================================
// Framework Signatures
// ============================================================================

interface FrameworkSignature {
  framework: FrameworkType;
  priority: number; // Higher = more specific
  check: (deps: string[], devDeps: string[], files: string[], pkg: PackageJson, rootFiles: string[]) => boolean;
  version?: (deps: Record<string, string>, devDeps: Record<string, string>) => string;
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  scripts?: Record<string, string>;
  workspaces?: string[] | { packages: string[] };
  type?: string;
}

const FRAMEWORK_SIGNATURES: FrameworkSignature[] = [
  // Full-stack frameworks (highest priority)
  {
    framework: 't3',
    priority: 100,
    check: (deps) => deps.includes('create-t3-app') || (deps.includes('next') && deps.includes('@trpc/server') && deps.includes('prisma')),
  },
  {
    framework: 'blitz',
    priority: 100,
    check: (deps) => deps.includes('blitz'),
    version: (deps) => deps['blitz'] || 'unknown',
  },
  {
    framework: 'redwood',
    priority: 100,
    check: (_deps, devDeps) => devDeps.includes('@redwoodjs/core'),
    version: (_, devDeps) => devDeps['@redwoodjs/core'] || 'unknown',
  },
  
  // Meta-frameworks (high priority)
  {
    framework: 'next',
    priority: 90,
    check: (deps) => deps.includes('next'),
    version: (deps) => deps['next'] || 'unknown',
  },
  {
    framework: 'nuxt',
    priority: 90,
    check: (deps, devDeps) => deps.includes('nuxt') || devDeps.includes('nuxt'),
    version: (deps, devDeps) => deps['nuxt'] || devDeps['nuxt'] || 'unknown',
  },
  {
    framework: 'sveltekit',
    priority: 90,
    check: (_, devDeps) => devDeps.includes('@sveltejs/kit'),
    version: (_, devDeps) => devDeps['@sveltejs/kit'] || 'unknown',
  },
  {
    framework: 'remix',
    priority: 90,
    check: (deps) => deps.includes('@remix-run/react'),
    version: (deps) => deps['@remix-run/react'] || 'unknown',
  },
  {
    framework: 'gatsby',
    priority: 90,
    check: (deps) => deps.includes('gatsby'),
    version: (deps) => deps['gatsby'] || 'unknown',
  },
  {
    framework: 'astro',
    priority: 85,
    check: (deps, devDeps) => deps.includes('astro') || devDeps.includes('astro'),
    version: (deps, devDeps) => deps['astro'] || devDeps['astro'] || 'unknown',
  },
  
  // Desktop
  {
    framework: 'electron',
    priority: 85,
    check: (deps, devDeps) => deps.includes('electron') || devDeps.includes('electron'),
    version: (deps, devDeps) => deps['electron'] || devDeps['electron'] || 'unknown',
  },
  {
    framework: 'tauri',
    priority: 85,
    check: (_, devDeps, files) => devDeps.includes('@tauri-apps/api') || files.includes('tauri.conf.json'),
    version: (_, devDeps) => devDeps['@tauri-apps/api'] || 'unknown',
  },
  
  // Mobile
  {
    framework: 'expo',
    priority: 85,
    check: (deps) => deps.includes('expo'),
    version: (deps) => deps['expo'] || 'unknown',
  },
  {
    framework: 'react-native',
    priority: 80,
    check: (deps) => deps.includes('react-native') && !deps.includes('expo'),
    version: (deps) => deps['react-native'] || 'unknown',
  },
  {
    framework: 'ionic',
    priority: 80,
    check: (deps) => deps.includes('@ionic/core') || deps.includes('@ionic/react') || deps.includes('@ionic/vue') || deps.includes('@ionic/angular'),
    version: (deps) => deps['@ionic/core'] || deps['@ionic/react'] || deps['@ionic/vue'] || deps['@ionic/angular'] || 'unknown',
  },
  {
    framework: 'capacitor',
    priority: 75,
    check: (deps) => deps.includes('@capacitor/core'),
    version: (deps) => deps['@capacitor/core'] || 'unknown',
  },
  
  // Backend frameworks
  {
    framework: 'nestjs',
    priority: 80,
    check: (deps) => deps.includes('@nestjs/core'),
    version: (deps) => deps['@nestjs/core'] || 'unknown',
  },
  {
    framework: 'hono',
    priority: 75,
    check: (deps) => deps.includes('hono'),
    version: (deps) => deps['hono'] || 'unknown',
  },
  {
    framework: 'elysia',
    priority: 75,
    check: (deps) => deps.includes('elysia'),
    version: (deps) => deps['elysia'] || 'unknown',
  },
  {
    framework: 'fastify',
    priority: 70,
    check: (deps) => deps.includes('fastify'),
    version: (deps) => deps['fastify'] || 'unknown',
  },
  {
    framework: 'koa',
    priority: 70,
    check: (deps) => deps.includes('koa'),
    version: (deps) => deps['koa'] || 'unknown',
  },
  {
    framework: 'hapi',
    priority: 70,
    check: (deps) => deps.includes('@hapi/hapi'),
    version: (deps) => deps['@hapi/hapi'] || 'unknown',
  },
  {
    framework: 'express',
    priority: 65,
    check: (deps) => deps.includes('express'),
    version: (deps) => deps['express'] || 'unknown',
  },
  
  // Frontend frameworks
  {
    framework: 'qwik',
    priority: 75,
    check: (deps) => deps.includes('@builder.io/qwik'),
    version: (deps) => deps['@builder.io/qwik'] || 'unknown',
  },
  {
    framework: 'solid',
    priority: 70,
    check: (deps) => deps.includes('solid-js'),
    version: (deps) => deps['solid-js'] || 'unknown',
  },
  {
    framework: 'preact',
    priority: 70,
    check: (deps) => deps.includes('preact'),
    version: (deps) => deps['preact'] || 'unknown',
  },
  {
    framework: 'svelte',
    priority: 60,
    check: (deps, devDeps) => (deps.includes('svelte') || devDeps.includes('svelte')) && !devDeps.includes('@sveltejs/kit'),
    version: (deps, devDeps) => deps['svelte'] || devDeps['svelte'] || 'unknown',
  },
  {
    framework: 'angular',
    priority: 60,
    check: (deps) => deps.includes('@angular/core'),
    version: (deps) => deps['@angular/core'] || 'unknown',
  },
  {
    framework: 'vue',
    priority: 55,
    check: (deps) => deps.includes('vue') && !deps.includes('nuxt'),
    version: (deps) => deps['vue'] || 'unknown',
  },
  {
    framework: 'react',
    priority: 50,
    check: (deps) => deps.includes('react') && !deps.includes('next') && !deps.includes('gatsby') && !deps.includes('@remix-run/react') && !deps.includes('react-native'),
    version: (deps) => deps['react'] || 'unknown',
  },
  
  // Generic node
  {
    framework: 'node',
    priority: 10,
    check: (_, __, files) => files.includes('server.js') || files.includes('server.ts') || files.includes('index.js') || files.includes('app.js'),
  },
];

// ============================================================================
// Feature Detection Signatures
// ============================================================================

interface FeatureSignature {
  name: string;
  check: (deps: string[], devDeps: string[], files: string[]) => boolean;
}

const FEATURE_SIGNATURES: FeatureSignature[] = [
  // Styling
  { name: 'tailwind', check: (_, dd, f) => dd.includes('tailwindcss') || f.some(f => f.includes('tailwind.config')) },
  { name: 'styled-components', check: (d) => d.includes('styled-components') },
  { name: 'emotion', check: (d) => d.includes('@emotion/react') || d.includes('@emotion/styled') },
  { name: 'panda', check: (d, dd) => d.includes('@pandacss/dev') || dd.includes('@pandacss/dev') },
  { name: 'unocss', check: (_, dd) => dd.includes('unocss') },
  { name: 'vanilla-extract', check: (_, dd) => dd.includes('@vanilla-extract/css') },
  { name: 'sass', check: (_, dd) => dd.includes('sass') || dd.includes('node-sass') },
  
  // UI Libraries
  { name: 'shadcn', check: (_, __, f) => f.includes('components.json') },
  { name: 'radix', check: (d) => d.some(dep => dep.startsWith('@radix-ui/')) },
  { name: 'chakra', check: (d) => d.includes('@chakra-ui/react') },
  { name: 'mantine', check: (d) => d.includes('@mantine/core') },
  { name: 'antd', check: (d) => d.includes('antd') },
  { name: 'mui', check: (d) => d.includes('@mui/material') },
  { name: 'daisyui', check: (_, dd) => dd.includes('daisyui') },
  { name: 'headlessui', check: (d) => d.includes('@headlessui/react') || d.includes('@headlessui/vue') },
  
  // State Management
  { name: 'zustand', check: (d) => d.includes('zustand') },
  { name: 'redux', check: (d) => d.includes('redux') || d.includes('@reduxjs/toolkit') },
  { name: 'jotai', check: (d) => d.includes('jotai') },
  { name: 'recoil', check: (d) => d.includes('recoil') },
  { name: 'pinia', check: (d) => d.includes('pinia') },
  { name: 'vuex', check: (d) => d.includes('vuex') },
  { name: 'mobx', check: (d) => d.includes('mobx') },
  { name: 'xstate', check: (d) => d.includes('xstate') },
  
  // Data Fetching
  { name: 'react-query', check: (d) => d.includes('@tanstack/react-query') || d.includes('react-query') },
  { name: 'swr', check: (d) => d.includes('swr') },
  { name: 'axios', check: (d) => d.includes('axios') },
  { name: 'trpc', check: (d) => d.includes('@trpc/client') || d.includes('@trpc/server') },
  { name: 'graphql', check: (d) => d.includes('graphql') },
  { name: 'apollo', check: (d) => d.includes('@apollo/client') },
  { name: 'urql', check: (d) => d.includes('urql') },
  
  // Database & ORM
  { name: 'prisma', check: (_, dd) => dd.includes('prisma') },
  { name: 'drizzle', check: (d) => d.includes('drizzle-orm') },
  { name: 'typeorm', check: (d) => d.includes('typeorm') },
  { name: 'mongoose', check: (d) => d.includes('mongoose') },
  { name: 'sequelize', check: (d) => d.includes('sequelize') },
  { name: 'kysely', check: (d) => d.includes('kysely') },
  
  // Auth
  { name: 'next-auth', check: (d) => d.includes('next-auth') || d.includes('@auth/core') },
  { name: 'lucia', check: (d) => d.includes('lucia') },
  { name: 'clerk', check: (d) => d.includes('@clerk/nextjs') || d.includes('@clerk/clerk-react') },
  { name: 'supabase', check: (d) => d.includes('@supabase/supabase-js') },
  { name: 'firebase', check: (d) => d.includes('firebase') },
  
  // Testing
  { name: 'vitest', check: (_, dd) => dd.includes('vitest') },
  { name: 'jest', check: (_, dd) => dd.includes('jest') },
  { name: 'playwright', check: (_, dd) => dd.includes('@playwright/test') || dd.includes('playwright') },
  { name: 'cypress', check: (_, dd) => dd.includes('cypress') },
  { name: 'testing-library', check: (_, dd) => dd.some(d => d.includes('@testing-library/')) },
  
  // Code Quality
  { name: 'eslint', check: (_, dd) => dd.includes('eslint') },
  { name: 'prettier', check: (_, dd) => dd.includes('prettier') },
  { name: 'biome', check: (_, dd) => dd.includes('@biomejs/biome') },
  { name: 'husky', check: (_, dd) => dd.includes('husky') },
  { name: 'lint-staged', check: (_, dd) => dd.includes('lint-staged') },
  { name: 'commitlint', check: (_, dd) => dd.includes('@commitlint/cli') },
  
  // Validation
  { name: 'zod', check: (d) => d.includes('zod') },
  { name: 'yup', check: (d) => d.includes('yup') },
  { name: 'valibot', check: (d) => d.includes('valibot') },
  { name: 'joi', check: (d) => d.includes('joi') },
  
  // Forms
  { name: 'react-hook-form', check: (d) => d.includes('react-hook-form') },
  { name: 'formik', check: (d) => d.includes('formik') },
  
  // Internationalization
  { name: 'i18n', check: (d) => d.includes('i18next') || d.includes('react-i18next') || d.includes('vue-i18n') },
  
  // Animation
  { name: 'framer-motion', check: (d) => d.includes('framer-motion') },
  { name: 'gsap', check: (d) => d.includes('gsap') },
  
  // DevOps
  { name: 'docker', check: (_, __, f) => f.includes('Dockerfile') || f.includes('docker-compose.yml') || f.includes('docker-compose.yaml') },
  { name: 'github-actions', check: (_, __, f) => f.includes('.github') },
  
  // PWA
  { name: 'pwa', check: (d, dd) => d.includes('vite-plugin-pwa') || dd.includes('vite-plugin-pwa') || d.includes('next-pwa') },
  
  // Monitoring
  { name: 'sentry', check: (d) => d.includes('@sentry/react') || d.includes('@sentry/nextjs') || d.includes('@sentry/node') },
  
  // Documentation
  { name: 'storybook', check: (_, dd) => dd.includes('@storybook/react') || dd.includes('@storybook/vue3') },
  { name: 'swagger', check: (d) => d.includes('swagger-jsdoc') || d.includes('swagger-ui-express') },
];

// ============================================================================
// Build Tool Detection
// ============================================================================

function detectBuildTool(devDeps: string[], files: string[]): BuildTool {
  if (devDeps.includes('vite') || files.some(f => f.includes('vite.config'))) return 'vite';
  if (files.includes('next.config.js') || files.includes('next.config.mjs') || files.includes('next.config.ts')) return 'turbopack';
  if (devDeps.includes('webpack') || files.includes('webpack.config.js')) return 'webpack';
  if (devDeps.includes('@rspack/core')) return 'rspack';
  if (devDeps.includes('parcel')) return 'parcel';
  if (devDeps.includes('rollup')) return 'rollup';
  if (devDeps.includes('esbuild')) return 'esbuild';
  if (devDeps.includes('@swc/core')) return 'swc';
  if (files.includes('tsconfig.json')) return 'tsc';
  return 'unknown';
}

// ============================================================================
// Monorepo Detection
// ============================================================================

interface MonorepoInfo {
  type: MonorepoType;
  workspaces: string[];
}

async function detectMonorepo(projectRoot: string, pkg: PackageJson, files: string[]): Promise<MonorepoInfo> {
  // Turborepo
  if (files.includes('turbo.json')) {
    const workspaces = await getWorkspaces(projectRoot, pkg);
    return { type: 'turborepo', workspaces };
  }
  
  // Nx
  if (files.includes('nx.json')) {
    const workspaces = await getWorkspaces(projectRoot, pkg);
    return { type: 'nx', workspaces };
  }
  
  // Lerna
  if (files.includes('lerna.json')) {
    const workspaces = await getWorkspaces(projectRoot, pkg);
    return { type: 'lerna', workspaces };
  }
  
  // pnpm workspaces
  if (files.includes('pnpm-workspace.yaml')) {
    const workspaces = await getPnpmWorkspaces(projectRoot);
    return { type: 'pnpm-workspaces', workspaces };
  }
  
  // npm/yarn workspaces (in package.json)
  if (pkg.workspaces) {
    const workspaces = await getWorkspaces(projectRoot, pkg);
    if (files.includes('yarn.lock')) {
      return { type: 'yarn-workspaces', workspaces };
    }
    return { type: 'npm-workspaces', workspaces };
  }
  
  return { type: 'none', workspaces: [] };
}

async function getWorkspaces(_projectRoot: string, pkg: PackageJson): Promise<string[]> {
  const workspacePatterns = Array.isArray(pkg.workspaces) 
    ? pkg.workspaces 
    : pkg.workspaces?.packages || [];
  
  // For now, return patterns; could expand to actual paths
  return workspacePatterns;
}

async function getPnpmWorkspaces(projectRoot: string): Promise<string[]> {
  try {
    const yamlPath = path.join(projectRoot, 'pnpm-workspace.yaml');
    const content = await fs.readFile(yamlPath, 'utf-8');
    // Simple YAML parsing for packages field
    const match = content.match(/packages:\s*\n((?:\s+-\s+['"]?[^\n]+['"]?\n?)+)/);
    if (match) {
      return match[1]
        .split('\n')
        .filter(line => line.trim().startsWith('-'))
        .map(line => line.replace(/^\s*-\s*['"]?/, '').replace(/['"]?\s*$/, ''));
    }
  } catch {
    // Ignore errors
  }
  return [];
}

// ============================================================================
// Project Structure Detection
// ============================================================================

async function detectProjectStructure(
  projectRoot: string,
  framework: FrameworkType,
  files: string[],
  hasTypescript: boolean
): Promise<ProjectStructure> {
  const ext = hasTypescript ? '.tsx' : '.jsx';
  const styleExt = files.some(f => f.includes('.scss')) ? '.scss' : 
                   files.some(f => f.includes('.module.css')) ? '.module.css' : '.css';
  
  // Framework-specific structures
  const structures: Partial<Record<FrameworkType, Partial<ProjectStructure>>> = {
    next: {
      sourceDir: await dirExists(projectRoot, 'src') ? 'src' : '',
      componentsDir: await dirExists(projectRoot, 'src/components') ? 'src/components' : 
                     await dirExists(projectRoot, 'components') ? 'components' : 'src/components',
      pagesDir: await dirExists(projectRoot, 'app') ? 'app' : 
                await dirExists(projectRoot, 'src/app') ? 'src/app' : 
                await dirExists(projectRoot, 'pages') ? 'pages' : 'src/pages',
      libDir: await dirExists(projectRoot, 'src/lib') ? 'src/lib' : 'lib',
      stylesDir: await dirExists(projectRoot, 'src/styles') ? 'src/styles' : 'styles',
      publicDir: 'public',
      assetsDir: await dirExists(projectRoot, 'src/assets') ? 'src/assets' : 'public',
      configDir: '',
      componentExtension: ext,
      styleExtension: styleExt,
      mainEntry: await fileExists(projectRoot, 'src/app/layout.tsx') ? 'src/app/layout.tsx' :
                 await fileExists(projectRoot, 'app/layout.tsx') ? 'app/layout.tsx' :
                 await fileExists(projectRoot, 'pages/_app.tsx') ? 'pages/_app.tsx' : 'src/pages/_app.tsx',
      mainStyle: await fileExists(projectRoot, 'src/app/globals.css') ? 'src/app/globals.css' :
                 await fileExists(projectRoot, 'app/globals.css') ? 'app/globals.css' :
                 await fileExists(projectRoot, 'styles/globals.css') ? 'styles/globals.css' : 'src/styles/globals.css',
      appComponent: await fileExists(projectRoot, 'src/app/layout.tsx') ? 'src/app/layout.tsx' :
                    await fileExists(projectRoot, 'app/layout.tsx') ? 'app/layout.tsx' : 'pages/_app.tsx',
      configFile: files.find(f => f.includes('next.config')) || 'next.config.mjs',
      tsConfig: 'tsconfig.json',
    },
    nuxt: {
      sourceDir: '',
      componentsDir: 'components',
      pagesDir: 'pages',
      libDir: 'utils',
      stylesDir: 'assets/css',
      publicDir: 'public',
      assetsDir: 'assets',
      configDir: '',
      componentExtension: '.vue',
      styleExtension: styleExt,
      mainEntry: 'app.vue',
      mainStyle: 'assets/css/main.css',
      appComponent: 'app.vue',
      configFile: 'nuxt.config.ts',
      tsConfig: 'tsconfig.json',
    },
    vue: {
      sourceDir: 'src',
      componentsDir: 'src/components',
      pagesDir: await dirExists(projectRoot, 'src/views') ? 'src/views' : 'src/pages',
      libDir: 'src/lib',
      stylesDir: 'src/styles',
      publicDir: 'public',
      assetsDir: 'src/assets',
      configDir: '',
      componentExtension: '.vue',
      styleExtension: styleExt,
      mainEntry: 'src/main.ts',
      mainStyle: 'src/assets/main.css',
      appComponent: 'src/App.vue',
      configFile: files.find(f => f.includes('vite.config')) || 'vite.config.ts',
      tsConfig: 'tsconfig.json',
    },
    svelte: {
      sourceDir: 'src',
      componentsDir: 'src/lib/components',
      pagesDir: 'src/routes',
      libDir: 'src/lib',
      stylesDir: 'src/styles',
      publicDir: 'static',
      assetsDir: 'src/assets',
      configDir: '',
      componentExtension: '.svelte',
      styleExtension: styleExt,
      mainEntry: 'src/main.ts',
      mainStyle: 'src/app.css',
      appComponent: 'src/App.svelte',
      configFile: files.find(f => f.includes('vite.config')) || 'vite.config.ts',
      tsConfig: 'tsconfig.json',
    },
    sveltekit: {
      sourceDir: 'src',
      componentsDir: 'src/lib/components',
      pagesDir: 'src/routes',
      libDir: 'src/lib',
      stylesDir: 'src/styles',
      publicDir: 'static',
      assetsDir: 'src/assets',
      configDir: '',
      componentExtension: '.svelte',
      styleExtension: styleExt,
      mainEntry: 'src/app.html',
      mainStyle: 'src/app.css',
      appComponent: 'src/routes/+layout.svelte',
      configFile: 'svelte.config.js',
      tsConfig: 'tsconfig.json',
    },
    angular: {
      sourceDir: 'src',
      componentsDir: 'src/app/components',
      pagesDir: 'src/app/pages',
      libDir: 'src/app/services',
      stylesDir: 'src/styles',
      publicDir: 'src/assets',
      assetsDir: 'src/assets',
      configDir: '',
      componentExtension: '.component.ts',
      styleExtension: styleExt,
      mainEntry: 'src/main.ts',
      mainStyle: 'src/styles.css',
      appComponent: 'src/app/app.component.ts',
      configFile: 'angular.json',
      tsConfig: 'tsconfig.json',
    },
    astro: {
      sourceDir: 'src',
      componentsDir: 'src/components',
      pagesDir: 'src/pages',
      libDir: 'src/lib',
      stylesDir: 'src/styles',
      publicDir: 'public',
      assetsDir: 'src/assets',
      configDir: '',
      componentExtension: '.astro',
      styleExtension: styleExt,
      mainEntry: 'src/pages/index.astro',
      mainStyle: 'src/styles/global.css',
      appComponent: 'src/layouts/Layout.astro',
      configFile: 'astro.config.mjs',
      tsConfig: 'tsconfig.json',
    },
    solid: {
      sourceDir: 'src',
      componentsDir: 'src/components',
      pagesDir: 'src/pages',
      libDir: 'src/lib',
      stylesDir: 'src/styles',
      publicDir: 'public',
      assetsDir: 'src/assets',
      configDir: '',
      componentExtension: '.tsx',
      styleExtension: styleExt,
      mainEntry: 'src/index.tsx',
      mainStyle: 'src/index.css',
      appComponent: 'src/App.tsx',
      configFile: files.find(f => f.includes('vite.config')) || 'vite.config.ts',
      tsConfig: 'tsconfig.json',
    },
    express: {
      sourceDir: 'src',
      componentsDir: 'src/controllers',
      pagesDir: 'src/routes',
      libDir: 'src/lib',
      stylesDir: '',
      publicDir: 'public',
      assetsDir: 'public',
      configDir: 'src/config',
      componentExtension: '.ts',
      styleExtension: '',
      mainEntry: 'src/index.ts',
      mainStyle: '',
      appComponent: 'src/app.ts',
      configFile: 'tsconfig.json',
      tsConfig: 'tsconfig.json',
    },
    nestjs: {
      sourceDir: 'src',
      componentsDir: 'src/modules',
      pagesDir: 'src/modules',
      libDir: 'src/common',
      stylesDir: '',
      publicDir: 'public',
      assetsDir: 'public',
      configDir: 'src/config',
      componentExtension: '.ts',
      styleExtension: '',
      mainEntry: 'src/main.ts',
      mainStyle: '',
      appComponent: 'src/app.module.ts',
      configFile: 'nest-cli.json',
      tsConfig: 'tsconfig.json',
    },
  };
  
  // Default React structure (also used for remix, gatsby, etc.)
  const defaultStructure: ProjectStructure = {
    sourceDir: 'src',
    componentsDir: 'src/components',
    pagesDir: 'src/pages',
    libDir: 'src/lib',
    stylesDir: 'src/styles',
    publicDir: 'public',
    assetsDir: 'src/assets',
    configDir: '',
    componentExtension: ext,
    styleExtension: styleExt,
    mainEntry: await fileExists(projectRoot, 'src/main.tsx') ? 'src/main.tsx' : 
               await fileExists(projectRoot, 'src/index.tsx') ? 'src/index.tsx' : 'src/main.tsx',
    mainStyle: await fileExists(projectRoot, 'src/index.css') ? 'src/index.css' : 'src/styles/globals.css',
    appComponent: 'src/App.tsx',
    configFile: files.find(f => f.includes('vite.config')) || 'vite.config.ts',
    tsConfig: 'tsconfig.json',
  };
  
  const frameworkStructure = structures[framework] || {};
  
  return {
    ...defaultStructure,
    ...frameworkStructure,
  } as ProjectStructure;
}

async function dirExists(root: string, dir: string): Promise<boolean> {
  try {
    const stat = await fs.stat(path.join(root, dir));
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function fileExists(root: string, file: string): Promise<boolean> {
  try {
    await fs.access(path.join(root, file));
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// Style Solution Detection
// ============================================================================

function detectStyleSolutions(deps: string[], devDeps: string[], files: string[]): StyleSolution[] {
  const solutions: StyleSolution[] = [];
  
  if (devDeps.includes('tailwindcss')) solutions.push('tailwind');
  if (deps.includes('styled-components')) solutions.push('styled-components');
  if (deps.includes('@emotion/react') || deps.includes('@emotion/styled')) solutions.push('emotion');
  if (deps.includes('@vanilla-extract/css') || devDeps.includes('@vanilla-extract/css')) solutions.push('vanilla-extract');
  if (deps.includes('@pandacss/dev') || devDeps.includes('@pandacss/dev')) solutions.push('panda');
  if (devDeps.includes('unocss')) solutions.push('unocss');
  if (devDeps.includes('sass') || devDeps.includes('node-sass')) solutions.push('scss');
  if (devDeps.includes('less')) solutions.push('less');
  if (files.some(f => f.includes('.module.css') || f.includes('.module.scss'))) solutions.push('css-modules');
  
  // Default to CSS if nothing else detected
  if (solutions.length === 0) solutions.push('css');
  
  return solutions;
}

// ============================================================================
// Package Manager Detection
// ============================================================================

async function detectPackageManager(projectRoot: string): Promise<PackageManager> {
  const lockFiles: Array<{ file: string; pm: PackageManager }> = [
    { file: 'bun.lockb', pm: 'bun' },
    { file: 'pnpm-lock.yaml', pm: 'pnpm' },
    { file: 'yarn.lock', pm: 'yarn' },
    { file: 'package-lock.json', pm: 'npm' },
  ];
  
  for (const { file, pm } of lockFiles) {
    if (await fileExists(projectRoot, file)) {
      return pm;
    }
  }
  
  return 'npm';
}

// ============================================================================
// SlyxUp Detection
// ============================================================================

interface SlyxUpInfo {
  isSlyxUp: boolean;
  version: string | null;
  features: string[];
}

async function detectSlyxUp(projectRoot: string): Promise<SlyxUpInfo> {
  try {
    const metadataPath = path.join(projectRoot, '.slyxup', 'project.json');
    const content = await fs.readFile(metadataPath, 'utf-8');
    const metadata = JSON.parse(content);
    
    return {
      isSlyxUp: true,
      version: metadata.cliVersion || null,
      features: metadata.features || [],
    };
  } catch {
    return {
      isSlyxUp: false,
      version: null,
      features: [],
    };
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

export async function analyzeProject(startDir: string = process.cwd()): Promise<AnalyzedProject | null> {
  // Find project root
  const projectRoot = await findProjectRoot(startDir);
  
  if (!projectRoot) {
    logger.debug('No package.json found');
    return null;
  }
  
  // Read package.json
  let pkg: PackageJson = {};
  try {
    const content = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
    pkg = JSON.parse(content);
  } catch (error) {
    logger.error('Failed to read package.json', error);
    return null;
  }
  
  // Get dependencies
  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  
  // Get root files
  const rootFiles = await getRootFiles(projectRoot);
  
  // Detect framework
  let framework: FrameworkType = 'unknown';
  let frameworkVersion = 'unknown';
  const secondaryFrameworks: FrameworkType[] = [];
  
  // Sort by priority (descending) and find first match
  const sortedSignatures = [...FRAMEWORK_SIGNATURES].sort((a, b) => b.priority - a.priority);
  
  for (const sig of sortedSignatures) {
    if (sig.check(deps, devDeps, rootFiles, pkg, rootFiles)) {
      if (framework === 'unknown') {
        framework = sig.framework;
        if (sig.version) {
          frameworkVersion = sig.version(pkg.dependencies || {}, pkg.devDependencies || {});
        }
      } else if (!secondaryFrameworks.includes(sig.framework)) {
        secondaryFrameworks.push(sig.framework);
      }
    }
  }
  
  // Detect features
  const installedFeatures: string[] = [];
  for (const sig of FEATURE_SIGNATURES) {
    if (sig.check(deps, devDeps, rootFiles)) {
      installedFeatures.push(sig.name);
    }
  }
  
  // Detect other attributes
  const hasTypescript = devDeps.includes('typescript') || rootFiles.includes('tsconfig.json');
  const buildTool = detectBuildTool(devDeps, rootFiles);
  const packageManager = await detectPackageManager(projectRoot);
  const monorepo = await detectMonorepo(projectRoot, pkg, rootFiles);
  const styleSolutions = detectStyleSolutions(deps, devDeps, rootFiles);
  const slyxup = await detectSlyxUp(projectRoot);
  const structure = await detectProjectStructure(projectRoot, framework, rootFiles, hasTypescript);
  
  // Detect testing frameworks
  let testingFramework: TestingFramework = 'none';
  if (devDeps.includes('vitest')) testingFramework = 'vitest';
  else if (devDeps.includes('jest')) testingFramework = 'jest';
  else if (devDeps.includes('mocha')) testingFramework = 'mocha';
  else if (devDeps.includes('ava')) testingFramework = 'ava';
  
  let e2eFramework: E2EFramework = 'none';
  if (devDeps.includes('@playwright/test') || devDeps.includes('playwright')) e2eFramework = 'playwright';
  else if (devDeps.includes('cypress')) e2eFramework = 'cypress';
  else if (devDeps.includes('puppeteer')) e2eFramework = 'puppeteer';
  
  // Detect current workspace in monorepo
  let currentWorkspace: string | null = null;
  if (monorepo.type !== 'none' && startDir !== projectRoot) {
    const relativePath = path.relative(projectRoot, startDir);
    for (const ws of monorepo.workspaces) {
      if (relativePath.startsWith(ws.replace('/*', '').replace('/**', ''))) {
        currentWorkspace = relativePath;
        break;
      }
    }
  }
  
  // Merge SlyxUp features with detected features
  const allFeatures = [...new Set([...installedFeatures, ...slyxup.features])];
  
  // Determine language
  const language: ProjectLanguage = hasTypescript 
    ? (deps.some(d => d.endsWith('.js')) ? 'mixed' : 'typescript')
    : 'javascript';
  
  const analyzedProject: AnalyzedProject = {
    name: pkg.name || path.basename(projectRoot),
    root: projectRoot,
    
    framework,
    frameworkVersion,
    secondaryFrameworks,
    
    buildTool,
    packageManager,
    language,
    
    structure,
    
    isMonorepo: monorepo.type !== 'none',
    monorepoType: monorepo.type,
    workspaces: monorepo.workspaces,
    currentWorkspace,
    
    hasTypescript,
    styleSolutions,
    testingFramework,
    e2eFramework,
    
    installedFeatures: allFeatures,
    
    isSlyxUp: slyxup.isSlyxUp,
    slyxupVersion: slyxup.version,
    
    dependencies: pkg.dependencies || {},
    devDependencies: pkg.devDependencies || {},
    scripts: pkg.scripts || {},
    
    rootFiles,
    hasGit: rootFiles.includes('.git'),
  };
  
  logger.info('Project analyzed', {
    name: analyzedProject.name,
    framework: analyzedProject.framework,
    isMonorepo: analyzedProject.isMonorepo,
    features: analyzedProject.installedFeatures.length,
  });
  
  return analyzedProject;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function findProjectRoot(startDir: string): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;
  
  while (currentDir !== root) {
    const packageJsonPath = path.join(currentDir, 'package.json');
    try {
      await fs.access(packageJsonPath);
      return currentDir;
    } catch {
      currentDir = path.dirname(currentDir);
    }
  }
  
  return null;
}

async function getRootFiles(projectRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(projectRoot);
    return entries;
  } catch {
    return [];
  }
}

// ============================================================================
// Export for backward compatibility
// ============================================================================

export { findProjectRoot };
