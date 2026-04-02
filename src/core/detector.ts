import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';

export type Framework = 'react' | 'next' | 'vue' | 'nuxt' | 'svelte' | 'node' | 'express' | 'fastify' | 'nestjs' | 'graphql' | 'hono' | 'bun' | 'discord' | 'astro' | 'solid' | 'unknown';

export interface ProjectInfo {
  framework: Framework;
  root: string;
  isSlyxUp: boolean;
  name: string;
  typescript: boolean;
  features: string[];
  packageManager: 'npm' | 'yarn' | 'pnpm' | 'bun';
}

interface PackageJson {
  name?: string;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

const FRAMEWORK_SIGNATURES: Array<{
  framework: Framework;
  check: (deps: string[], devDeps: string[], files: string[]) => boolean;
}> = [
  {
    framework: 'next',
    check: (deps) => deps.includes('next'),
  },
  {
    framework: 'nuxt',
    check: (deps, devDeps) => deps.includes('nuxt') || devDeps.includes('nuxt'),
  },
  {
    framework: 'astro',
    check: (deps, devDeps) => deps.includes('astro') || devDeps.includes('astro'),
  },
  {
    framework: 'solid',
    check: (deps) => deps.includes('solid-js'),
  },
  {
    framework: 'svelte',
    check: (deps, devDeps) =>
      deps.includes('svelte') || devDeps.includes('svelte') || devDeps.includes('@sveltejs/kit'),
  },
  {
    framework: 'vue',
    check: (deps) => deps.includes('vue'),
  },
  {
    framework: 'react',
    check: (deps) => deps.includes('react'),
  },
  {
    framework: 'discord',
    check: (deps) => deps.includes('discord.js'),
  },
  {
    framework: 'nestjs',
    check: (deps) => deps.includes('@nestjs/core'),
  },
  {
    framework: 'fastify',
    check: (deps) => deps.includes('fastify'),
  },
  {
    framework: 'graphql',
    check: (deps) => deps.includes('@apollo/server') || deps.includes('apollo-server'),
  },
  {
    framework: 'hono',
    check: (deps) => deps.includes('hono'),
  },
  {
    framework: 'bun',
    check: (_, devDeps, files) => 
      devDeps.includes('bun-types') || files.includes('bunfig.toml'),
  },
  {
    framework: 'express',
    check: (deps) => deps.includes('express'),
  },
  {
    framework: 'node',
    check: (deps, _, files) =>
      deps.includes('koa') ||
      files.includes('server.js') ||
      files.includes('server.ts') ||
      files.includes('index.js'),
  },
];

const FEATURE_SIGNATURES: Array<{
  name: string;
  check: (deps: string[], devDeps: string[], files: string[]) => boolean;
}> = [
  {
    name: 'typescript',
    check: (_, devDeps, files) =>
      devDeps.includes('typescript') || files.includes('tsconfig.json'),
  },
  {
    name: 'tailwind',
    check: (_, devDeps, files) =>
      devDeps.includes('tailwindcss') ||
      files.includes('tailwind.config.js') ||
      files.includes('tailwind.config.ts'),
  },
  {
    name: 'eslint',
    check: (_, devDeps, files) =>
      devDeps.includes('eslint') ||
      files.some((f) => f.startsWith('.eslintrc') || f.startsWith('eslint.config')),
  },
  {
    name: 'prettier',
    check: (_, devDeps, files) =>
      devDeps.includes('prettier') ||
      files.some((f) => f.startsWith('.prettierrc') || f === 'prettier.config.js'),
  },
  {
    name: 'shadcn',
    check: (_, __, files) =>
      files.includes('components.json') ||
      files.includes('components/ui'),
  },
  {
    name: 'lucide',
    check: (deps) => deps.includes('lucide-react'),
  },
];

async function detectPackageManager(projectRoot: string): Promise<'npm' | 'yarn' | 'pnpm' | 'bun'> {
  const lockFiles = [
    { file: 'bun.lockb', pm: 'bun' as const },
    { file: 'pnpm-lock.yaml', pm: 'pnpm' as const },
    { file: 'yarn.lock', pm: 'yarn' as const },
    { file: 'package-lock.json', pm: 'npm' as const },
  ];

  for (const { file, pm } of lockFiles) {
    try {
      await fs.access(path.join(projectRoot, file));
      return pm;
    } catch {
      // Continue checking
    }
  }

  return 'npm';
}

export async function findProjectRoot(startDir: string = process.cwd()): Promise<string | null> {
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

async function isSlyxUpProject(projectRoot: string): Promise<boolean> {
  try {
    await fs.access(path.join(projectRoot, '.slyxup', 'project.json'));
    return true;
  } catch {
    return false;
  }
}

async function getRootFiles(projectRoot: string): Promise<string[]> {
  try {
    const entries = await fs.readdir(projectRoot);
    return entries;
  } catch {
    return [];
  }
}

export async function detectProject(startDir: string = process.cwd()): Promise<ProjectInfo | null> {
  const projectRoot = await findProjectRoot(startDir);

  if (!projectRoot) {
    logger.debug('No package.json found');
    return null;
  }

  let pkg: PackageJson = {};
  try {
    const content = await fs.readFile(path.join(projectRoot, 'package.json'), 'utf-8');
    pkg = JSON.parse(content);
  } catch (error) {
    logger.error('Failed to read package.json', error);
    return null;
  }

  const deps = Object.keys(pkg.dependencies || {});
  const devDeps = Object.keys(pkg.devDependencies || {});
  const rootFiles = await getRootFiles(projectRoot);

  let framework: Framework = 'unknown';
  for (const sig of FRAMEWORK_SIGNATURES) {
    if (sig.check(deps, devDeps, rootFiles)) {
      framework = sig.framework;
      break;
    }
  }

  const isSlyxUp = await isSlyxUpProject(projectRoot);

  const detectedFeatures: string[] = [];
  for (const sig of FEATURE_SIGNATURES) {
    if (sig.check(deps, devDeps, rootFiles)) {
      detectedFeatures.push(sig.name);
    }
  }

  let features = detectedFeatures;
  if (isSlyxUp) {
    try {
      const metadataPath = path.join(projectRoot, '.slyxup', 'project.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'));
      features = [...new Set([...detectedFeatures, ...(metadata.features || [])])];
    } catch {
      // Use detected features only
    }
  }

  const packageManager = await detectPackageManager(projectRoot);
  const typescript = detectedFeatures.includes('typescript');

  const projectInfo: ProjectInfo = {
    framework,
    root: projectRoot,
    isSlyxUp,
    name: pkg.name || path.basename(projectRoot),
    typescript,
    features,
    packageManager,
  };

  logger.info('Project detected', projectInfo);
  return projectInfo;
}

export async function initializeSlyxUpMetadata(projectInfo: ProjectInfo): Promise<void> {
  const metadataDir = path.join(projectInfo.root, '.slyxup');
  const metadataFile = path.join(metadataDir, 'project.json');

  await fs.mkdir(metadataDir, { recursive: true });

  const metadata = {
    framework: projectInfo.framework,
    features: projectInfo.features,
    templateVersion: 'external',
    cliVersion: '2.0.0',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    packageManager: projectInfo.packageManager,
    initialized: 'auto-detected',
  };

  await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
  logger.info('SlyxUp metadata initialized', { path: metadataFile });
}
