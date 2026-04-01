import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

import { templateInstaller } from '../core/template-installer.js';
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
      validate: (input) => {
        if (!input.trim()) return 'Project name cannot be empty';
        if (existsSync(path.resolve(process.cwd(), input.trim()))) {
          return 'Directory already exists';
        }
        return true;
      },
    },
  ]);

  const { useTs } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'useTs',
      message: 'Use TypeScript?',
      default: true,
    },
  ]);

  const { installDeps } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'installDeps',
      message: 'Install dependencies after creation?',
      default: false,
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
      ts: useTs,
      install: installDeps,
      git: initializeGit,
    },
  };
}

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Create a new project from a template')
    .argument('[template]', 'Template to use (react, next, node, vue)')
    .argument('[project-name]', 'Project directory name')
    .option('--ts', 'Use TypeScript (default)')
    .option('--no-ts', 'Use JavaScript')
    .option('--install', 'Run package install after creation')
    .option('--no-install', 'Skip package installation')
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
  $ slyxup init                     ${chalk.gray('# Interactive mode')}
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

          if (!template && !projectName) {
            const result = await interactiveMode(options?.verbose);
            template = result.framework;
            projectName = result.projectName;
            Object.assign(options || {}, result.options);
          }

          const resolvedTemplate = TEMPLATE_ALIASES[template!] || template!;
          const finalProjectName = projectName || resolvedTemplate;

          if (options?.verbose) {
            console.log(chalk.gray('\nVerbose mode enabled\n'));
          }

          const validPMs = ['npm', 'yarn', 'pnpm', 'bun'];
          if (options?.pm && !validPMs.includes(options.pm)) {
            console.error(chalk.red(`Invalid package manager: ${options.pm}`));
            console.error(chalk.gray(`Valid options: ${validPMs.join(', ')}`));
            process.exit(1);
          }

          const targetDir = path.resolve(process.cwd(), finalProjectName);

          if (existsSync(targetDir)) {
            console.error(chalk.red(`\n✗ Directory already exists: ${finalProjectName}`));
            console.error(chalk.gray('  Use a different project name or remove the existing directory.'));
            process.exit(1);
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

          if (templateData.status === 'coming-soon') {
            console.error(chalk.yellow(`\n⚠ Template '${template}' is not yet available.`));
            console.log(chalk.gray('  Check back soon or try another template.'));
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
          console.log(chalk.cyan('  Project:   ') + chalk.white(finalProjectName));
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
            projectName: finalProjectName,
            version: options?.version,
            verbose: options?.verbose,
          });

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

          if (options?.install) {
            const pm = options.pm || 'npm';
            console.log();
            console.log(
              chalk.cyan(`Installing dependencies with ${pm}...`)
            );
            try {
              const installCmd = pm === 'yarn' ? 'yarn' : `${pm} install`;
              execSync(installCmd, { cwd: targetDir, stdio: 'inherit' });
              console.log(chalk.green('✓ Dependencies installed'));
            } catch {
              console.log(
                chalk.yellow(
                  `⚠ Failed to install dependencies. Run manually: cd ${finalProjectName} && ${pm} install`
                )
              );
            }
          }

          console.log();
          console.log(chalk.bold.green('✓ ') + chalk.bold(`Created ${finalProjectName}`));
          console.log();
          console.log('Next steps:');
          console.log(chalk.gray(`  cd ${finalProjectName}`));
          if (!options?.install) {
            console.log(chalk.gray(`  ${options?.pm || 'npm'} install`));
          }
          console.log(chalk.gray(`  ${options?.pm || 'npm'} run dev`));
          console.log();
          console.log(chalk.gray('Add features with:'));
          console.log(chalk.cyan('  slyxup add tailwind'));

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
