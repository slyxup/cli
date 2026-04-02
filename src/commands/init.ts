import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { readdir } from 'fs/promises';
import path from 'path';
import * as ts from 'typescript';

import { templateInstaller } from '../core/template-installer.js';
import { FeatureInstaller } from '../core/feature-installer.js';
import { registryLoader } from '../core/registry.js';
import { logger } from '../utils/logger.js';

interface InitOptions {
  ts?: boolean;
  install?: boolean;
  git?: boolean;
  pm?: 'npm' | 'yarn' | 'pnpm' | 'bun';
  yes?: boolean;
  version?: string;
  dryRun?: boolean;
  verbose?: boolean;
}

const TEMPLATE_ALIASES: Record<string, string> = {
  react: 'react',
  next: 'next',
  node: 'node',
  vue: 'vue',
};

/**
 * Remove TypeScript configuration and dependencies from a project
 * Converts all .ts/.tsx files to .js/.jsx
 */
async function removeTypeScriptFromProject(projectDir: string): Promise<void> {
  const packageJsonPath = path.join(projectDir, 'package.json');
  const tsconfigPath = path.join(projectDir, 'tsconfig.json');
  const tsconfigNodePath = path.join(projectDir, 'tsconfig.node.json');
  
  // Remove tsconfig files
  if (existsSync(tsconfigPath)) {
    unlinkSync(tsconfigPath);
  }
  if (existsSync(tsconfigNodePath)) {
    unlinkSync(tsconfigNodePath);
  }
  
  // Convert all TypeScript files to JavaScript
  await convertTsFilesToJs(projectDir);
  
  // Update package.json
  if (existsSync(packageJsonPath)) {
    const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Remove TypeScript dependencies
    const tsPackages = [
      'typescript',
      '@types/node',
      '@types/react',
      '@types/react-dom',
      '@types/express',
      '@types/cors',
      '@types/fastify',
      '@types/hono',
      'tsx',
      'ts-node'
    ];
    
    if (packageJson.devDependencies) {
      tsPackages.forEach(pkg => {
        delete packageJson.devDependencies[pkg];
      });
    }
    
    // Update build scripts to remove TypeScript compilation
    if (packageJson.scripts) {
      // Replace "tsc && vite build" with just "vite build"
      if (packageJson.scripts.build) {
        packageJson.scripts.build = packageJson.scripts.build
          .replace(/tsc\s*&&\s*/g, '')
          .replace(/tsc\s*;?\s*/g, '')
          .replace(/^tsc$/g, 'echo "No build step"');
      }
      
      // Replace tsx with node
      if (packageJson.scripts.dev) {
        packageJson.scripts.dev = packageJson.scripts.dev
          .replace(/tsx\s+watch\s+/g, 'node --watch ')
          .replace(/tsx\s+/g, 'node ')
          .replace(/\.ts\b/g, '.js');
      }
      
      if (packageJson.scripts.start) {
        packageJson.scripts.start = packageJson.scripts.start.replace(/\.ts\b/g, '.js');
      }
      
      // Remove type-check script
      delete packageJson.scripts['type-check'];
    }
    
    writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');
  }
  
  // Update vite.config to use .js instead of .ts
  const viteConfigTs = path.join(projectDir, 'vite.config.ts');
  if (existsSync(viteConfigTs)) {
    const viteConfigJs = path.join(projectDir, 'vite.config.js');
    let content = readFileSync(viteConfigTs, 'utf-8');
    try {
      const result = ts.transpileModule(content, {
        compilerOptions: {
          target: ts.ScriptTarget.Latest,
          module: ts.ModuleKind.ESNext,
        },
        fileName: viteConfigTs,
      });
      content = result.outputText;
    } catch (e) {
      content = removeTypeAnnotations(content);
    }
    writeFileSync(viteConfigJs, content);
    unlinkSync(viteConfigTs);
  }

  const indexHtmlPath = path.join(projectDir, 'index.html');
  if (existsSync(indexHtmlPath)) {
    let content = readFileSync(indexHtmlPath, 'utf-8');
    content = content.replace(/\.tsx/g, '.jsx').replace(/\.ts/g, '.js');
    writeFileSync(indexHtmlPath, content);
  }
}

/**
 * Recursively convert all .ts/.tsx files to .js/.jsx
 */
async function convertTsFilesToJs(dir: string): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    
    if (entry.isDirectory()) {
      // Skip node_modules, .git, etc.
      if (['node_modules', '.git', 'dist', 'build', '.next'].includes(entry.name)) {
        continue;
      }
      await convertTsFilesToJs(fullPath);
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.d.ts')) {
        // Delete type definitions completely
        unlinkSync(fullPath);
      } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
        const newExt = entry.name.endsWith('.tsx') ? '.jsx' : '.js';
        const newPath = fullPath.replace(/\.tsx?$/, newExt);
        
        // Read, convert, and write
        let content = readFileSync(fullPath, 'utf-8');
        try {
          const result = ts.transpileModule(content, {
            compilerOptions: {
              target: ts.ScriptTarget.Latest,
              module: ts.ModuleKind.ESNext,
              jsx: ts.JsxEmit.Preserve,
              removeComments: false,
            },
            fileName: fullPath,
          });
          content = result.outputText;
        } catch (e) {
          // Fallback
          content = removeTypeAnnotations(content);
        }
        
        // Fix any remaining .ts/.tsx extensions in imports or text
        content = content.replace(/\.tsx/g, '.jsx').replace(/\.ts/g, '.js');
        
        writeFileSync(newPath, content);
        unlinkSync(fullPath);
      }
    }
  }
}

/**
 * Remove TypeScript type annotations from code
 */
function removeTypeAnnotations(code: string): string {
  // Remove type imports
  code = code.replace(/import\s+type\s+\{[^}]+\}\s+from\s+['"][^'"]+['"]\s*;?\n?/g, '');
  
  // Remove interface declarations
  code = code.replace(/interface\s+\w+\s*\{[^}]*\}\s*/g, '');
  
  // Remove type aliases
  code = code.replace(/type\s+\w+\s*=\s*[^;]+;\s*/g, '');
  
  // Remove function parameter types: (param: Type) => (param)
  code = code.replace(/\(\s*(\w+)\s*:\s*[^),]+\s*\)/g, '($1)');
  
  // Remove function return types: ): Type => =>
  code = code.replace(/\)\s*:\s*[^{=>\n]+\s*=>/g, ') =>');
  code = code.replace(/\)\s*:\s*[^{=>\n]+\s*\{/g, ') {');
  
  // Remove variable type annotations: const x: Type = => const x =
  code = code.replace(/:\s*\w+(<[^>]+>)?(\[\])?(\s*=)/g, '$3');
  
  // Remove generic type parameters: <T, K> => <>
  code = code.replace(/<[A-Z][^>]*>/g, '');
  
  // Remove 'as' type assertions
  code = code.replace(/\s+as\s+\w+(<[^>]+>)?/g, '');
  
  // Remove JSX prop type annotations
  code = code.replace(/(\w+)\s*:\s*[^,}]+([,}])/g, '$1$2');
  
  return code;
}

const STATUS_COLORS: Record<string, typeof chalk.green> = {
  'stable': chalk.green,
  'beta': chalk.yellow,
  'coming-soon': chalk.gray,
};

const STATUS_LABELS: Record<string, string> = {
  'stable': 'Stable',
  'beta': 'Beta',
  'coming-soon': 'Coming soon',
};

async function interactiveMode(_verbose = false) {
  console.log(chalk.bold.cyan('\n🔧 SlyxUp Interactive Setup\n'));

  const { framework } = await inquirer.prompt([
    {
      type: 'list',
      name: 'framework',
      message: 'Which framework do you want to use?',
      choices: async () => {
        await registryLoader.load();
        const templates = registryLoader.listTemplates();
        return templates.map(t => ({
          name: `${t.name} ${chalk.gray(`(${t.frameworkVersion || t.version})`)}`,
          value: t.name,
        }));
      },
    },
  ]);

  const { projectName } = await inquirer.prompt([
    {
      type: 'input',
      name: 'projectName',
      message: 'What is your project name?',
      default: '.',
      validate: (input) => {
        if (!input.trim()) return 'Project name cannot be empty';
        const trimmed = input.trim();
        
        // Allow "." for current directory
        if (trimmed === '.') {
          const currentDir = process.cwd();
          const files = readdirSync(currentDir);
          // Allow if directory is empty or only has hidden files/common files
          const significantFiles = files.filter(f => 
            !f.startsWith('.') && 
            f !== 'node_modules' && 
            f !== 'package-lock.json' &&
            f !== 'yarn.lock' &&
            f !== 'pnpm-lock.yaml'
          );
          if (significantFiles.length > 0 && !files.includes('package.json')) {
            return 'Current directory is not empty. Use a different name or empty the directory.';
          }
          return true;
        }
        
        if (existsSync(path.resolve(process.cwd(), trimmed))) {
          return 'Directory already exists';
        }
        return true;
      },
    },
  ]);

  const { useTypeScript } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useTypeScript',
      message: 'Use TypeScript?',
      default: true,
    },
  ]);

  const { initializeGit } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'initializeGit',
      message: 'Initialize git repository?',
      default: true,
    },
  ]);

  return {
    framework,
    projectName,
    options: {
      git: initializeGit,
      ts: useTypeScript,
    },
  };
}

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Create a new project from a template')
    .argument('[template]', 'Template to use (react, next, vue, express, discord)')
    .argument('[project-name]', 'Project directory name')
    .option('--ts', 'Include TypeScript configuration (default)')
    .option('--no-ts', 'Skip TypeScript setup')
    .option('--git', 'Initialize git repository (default)')
    .option('--no-git', 'Skip git initialization')
    .option('--pm <manager>', 'Package manager (npm, yarn, pnpm, bun)', 'npm')
    .option('-v, --version <version>', 'Specific template version')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--dry-run', 'Preview what will be created without making changes')
    .option('--verbose', 'Show detailed information')
    .addHelpText(
      'after',
      `
Examples:
  $ slyxup init react my-app
  $ slyxup init react my-app --no-ts ${chalk.gray('# Without TypeScript')}
  $ slyxup init react .              ${chalk.gray('# Initialize in current directory')}
  $ slyxup init                      ${chalk.gray('# Interactive mode')}
  $ slyxup init next dashboard --pm pnpm
  $ slyxup init react my-app --dry-run
  $ slyxup init react my-app --verbose
    `
    )
    .action(
      async (
        template: string | undefined,
        projectName?: string,
        options?: InitOptions
      ) => {
        try {
          await registryLoader.load();
          
          // Ensure options object exists
          options = options || {};

          // Track if we came from interactive mode
          let fromInteractive = false;

          if (!template && !projectName) {
            const result = await interactiveMode(options.verbose);
            template = result.framework;
            projectName = result.projectName;
            Object.assign(options, result.options);
            fromInteractive = true;
          }

          const resolvedTemplate = TEMPLATE_ALIASES[template!] || template!;
          const finalProjectName = projectName || resolvedTemplate;
          const isCurrentDir = finalProjectName === '.';

          // If not from interactive mode and ts option not explicitly set, ask user
          if (!fromInteractive && options.ts === undefined && !options.yes) {
            const { useTypeScript } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'useTypeScript',
                message: 'Use TypeScript?',
                default: true,
              },
            ]);
            options.ts = useTypeScript;
          }

          if (options?.verbose) {
            console.log(chalk.gray('\nVerbose mode enabled\n'));
          }

          const validPMs = ['npm', 'yarn', 'pnpm', 'bun'];
          if (options?.pm && !validPMs.includes(options.pm)) {
            console.error(chalk.red(`Invalid package manager: ${options.pm}`));
            console.error(chalk.gray(`Valid options: ${validPMs.join(', ')}`));
            process.exit(1);
          }

          const targetDir = isCurrentDir 
            ? process.cwd() 
            : path.resolve(process.cwd(), finalProjectName);
          
          const displayName = isCurrentDir 
            ? path.basename(process.cwd()) 
            : finalProjectName;

          // Check if directory exists (skip for current directory)
          if (!isCurrentDir && existsSync(targetDir)) {
            console.error(chalk.red(`\n✗ Directory already exists: ${finalProjectName}`));
            console.error(chalk.gray('  Use a different project name or remove the existing directory.'));
            process.exit(1);
          }

          // For current directory, check if it's safe to initialize
          if (isCurrentDir) {
            const files = readdirSync(targetDir);
            const hasPackageJson = files.includes('package.json');
            
            if (hasPackageJson) {
              const { overwrite } = await inquirer.prompt([
                {
                  type: 'confirm',
                  name: 'overwrite',
                  message: chalk.yellow('package.json already exists. Overwrite with template?'),
                  default: false,
                },
              ]);
              
              if (!overwrite) {
                console.log(chalk.gray('\nAborted. Use `slyxup add` to add features to existing project.\n'));
                return;
              }
            }
          }

          const templates = registryLoader.listTemplates();
          const templateData = templates.find((t) => t.name === resolvedTemplate);

          if (!templateData) {
            console.error(chalk.red(`\n✗ Template not found: ${resolvedTemplate}`));
            console.log();
            console.log(chalk.bold('Available templates:'));
            console.log();
            templates.forEach((t) => {
              const statusColor = STATUS_COLORS[t.status || 'stable'];
              const statusLabel = STATUS_LABELS[t.status || 'stable'];
              const version = t.frameworkVersion || t.version;
              console.log(`  ${chalk.cyan(t.name)} ${chalk.gray(`(${version})`)} ${statusColor(`[${statusLabel}]`)}`);
              if (options?.verbose) {
                console.log(chalk.gray(`    ${t.description}`));
              }
            });
            console.log();
            console.log(chalk.gray('Tip: Run without arguments for interactive mode'));
            process.exit(1);
          }

          const version = templateData.frameworkVersion || templateData.version;

          if (options?.dryRun) {
            console.log(chalk.bold.cyan('\n🔍 Dry Run - Preview\n'));
            console.log(chalk.bold('Project to create:'));
            console.log(chalk.cyan(`  Name: ${finalProjectName}`));
            console.log(chalk.cyan(`  Template: ${resolvedTemplate} (${version})`));
            console.log(chalk.cyan(`  TypeScript: ${options?.ts !== false ? 'Yes' : 'No'}`));
            console.log(chalk.cyan(`  Git init: ${options?.git !== false ? 'Yes' : 'No'}`));
            console.log(chalk.cyan(`  Install deps: ${options?.install ? 'Yes' : 'No'}`));
            console.log();
            if (templateData.features?.length) {
              console.log(chalk.bold('Features to install:'));
              templateData.features.forEach(f => {
                console.log(chalk.gray(`  + ${f}`));
              });
              console.log();
            }
            console.log(chalk.green('✓ This is a preview. No files were created.'));
            console.log(chalk.gray('  Run without --dry-run to actually create the project.'));
            return;
          }

          console.log();
          console.log(chalk.bold.cyan('🚀 Creating Project'));
          console.log();
          console.log(chalk.cyan('  Project:   ') + chalk.white(displayName));
          console.log(chalk.cyan('  Directory: ') + chalk.white(isCurrentDir ? '.' : finalProjectName));
          console.log(chalk.cyan('  Template:  ') + chalk.white(`${resolvedTemplate} (${version})`));
          console.log(chalk.cyan('  TypeScript:') + chalk.white(options?.ts !== false ? 'Yes' : 'No'));
          console.log();

          if (!options?.yes) {
            const { confirm } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'confirm',
                message: 'Continue?',
                default: true,
              },
            ]);

            if (!confirm) {
              console.log(chalk.gray('\nAborted.\n'));
              return;
            }
          }

          await templateInstaller.install({
            framework: resolvedTemplate,
            projectName: displayName,
            targetDir: targetDir,
            version: options?.version,
            verbose: options?.verbose,
          });

          // Handle TypeScript setup
          if (options?.ts === false) {
            // User explicitly wants no TypeScript - remove TS from template
            console.log(chalk.gray('\nRemoving TypeScript configuration...'));
            try {
              await removeTypeScriptFromProject(targetDir);
              console.log(chalk.green('✓ TypeScript removed'));
            } catch (err) {
              console.log(chalk.yellow('⚠ Could not remove TypeScript completely'));
              if (options?.verbose && err instanceof Error) {
                console.log(chalk.gray(`  ${err.message}`));
              }
            }
          } else {
            // User wants TypeScript (default) - ensure it's configured
            console.log(chalk.gray('\nSetting up TypeScript...'));
            try {
              const featureInstaller = new FeatureInstaller();
              await featureInstaller.install({
                featureName: 'typescript',
                projectRoot: targetDir,
                skipNpmInstall: true, // We'll install all deps at once later
                verbose: options?.verbose,
              });
              console.log(chalk.green('✓ TypeScript configured'));
            } catch (tsError) {
              // TypeScript setup is optional, don't fail the whole init
              console.log(chalk.yellow('⚠ TypeScript setup skipped (may already be configured)'));
              if (options?.verbose && tsError instanceof Error) {
                console.log(chalk.gray(`  ${tsError.message}`));
              }
            }
          }

          if (options?.git !== false) {
            try {
              console.log(chalk.gray('Initializing git repository...'));
              execSync('git init', { cwd: targetDir, stdio: 'ignore' });
              execSync('git add -A', { cwd: targetDir, stdio: 'ignore' });
              execSync(
                'git commit -m "Initial commit from SlyxUp"',
                { cwd: targetDir, stdio: 'ignore' }
              );
              console.log(chalk.green('✓ Git repository initialized'));
            } catch {
              console.log(
                chalk.yellow('⚠ Git not available, skipping initialization')
              );
            }
          }

          console.log();
          console.log(chalk.bold.green('✓ ') + chalk.bold(`Created ${displayName}`));
          console.log();

          const pm = options?.pm || 'npm';
          let installNow = options?.yes ?? false;
          
          if (!options?.yes) {
            const { installChoice } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'installChoice',
                message: `Install dependencies now with ${pm}?`,
                default: true,
              },
            ]);
            installNow = installChoice;
          }

          if (installNow) {
            console.log(chalk.cyan(`\nInstalling dependencies with ${pm}...`));
            try {
              const installCmd = pm === 'yarn' ? 'yarn' : `${pm} install`;
              execSync(installCmd, { cwd: targetDir, stdio: 'inherit' });
              console.log(chalk.green('✓ Dependencies installed'));
            } catch {
              console.log(chalk.yellow(`⚠ Failed. Run manually: ${isCurrentDir ? '' : `cd ${finalProjectName} && `}${pm} install`));
            }
          }

          console.log();
          console.log('Next steps:');
          if (!isCurrentDir) {
            console.log(chalk.gray(`  cd ${finalProjectName}`));
          }
          if (!installNow) {
            console.log(chalk.gray(`  ${pm} install`));
          }
          console.log(chalk.gray(`  ${pm} run dev`));
          console.log();
          console.log(chalk.gray('Add features with:'));
          console.log(chalk.cyan('  slyxup add <feature>'));

          logger.info('Init completed', {
            template: resolvedTemplate,
            projectName: finalProjectName,
          });
        } catch (error) {
          logger.error('Init failed', error);
          if (error instanceof Error) {
            console.error(chalk.red(`\n✗ Error: ${error.message}`));
            if (options?.verbose) {
              console.error(chalk.gray(error.stack || ''));
            }
          }
          process.exit(1);
        }
      }
    );

  return command;
}
