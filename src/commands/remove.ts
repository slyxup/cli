import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';

import { MetadataManager } from '../core/metadata.js';
import { logger } from '../utils/logger.js';
import { safeReadJSON, safeWriteJSON } from '../utils/file.js';

interface RemoveOptions {
  yes?: boolean;
  dryRun?: boolean;
}

interface RemovalPlan {
  dependencies: string[];
  devDependencies: string[];
  files: string[];
}

async function findProjectRoot(): Promise<string | null> {
  let current = process.cwd();

  while (current !== path.dirname(current)) {
    const metadataPath = path.join(current, '.slyxup', 'project.json');
    try {
      await fs.access(metadataPath);
      return current;
    } catch {
      current = path.dirname(current);
    }
  }

  return null;
}

async function buildRemovalPlan(
  projectRoot: string,
  feature: string
): Promise<RemovalPlan> {
  const plan: RemovalPlan = {
    dependencies: [],
    devDependencies: [],
    files: [],
  };

  switch (feature) {
    case 'tailwind':
      plan.devDependencies = ['tailwindcss', 'postcss', 'autoprefixer'];
      plan.files = [
        'tailwind.config.js',
        'tailwind.config.ts',
        'postcss.config.js',
        'postcss.config.mjs',
      ];
      break;

    case 'prettier':
      plan.devDependencies = ['prettier'];
      plan.files = [
        '.prettierrc',
        '.prettierrc.json',
        '.prettierrc.js',
        'prettier.config.js',
        '.prettierignore',
      ];
      break;

    case 'eslint':
      plan.devDependencies = ['eslint', '@eslint/js'];
      plan.files = [
        '.eslintrc',
        '.eslintrc.json',
        '.eslintrc.js',
        'eslint.config.js',
        'eslint.config.mjs',
        '.eslintignore',
      ];
      break;

    case 'typescript':
      plan.devDependencies = ['typescript', '@types/node'];
      break;

    case 'shadcn':
      plan.dependencies = ['class-variance-authority', 'clsx', 'tailwind-merge'];
      plan.files = ['components.json'];
      break;

    case 'lucide':
      plan.dependencies = ['lucide-react'];
      break;

    default:
      break;
  }

  const existingFiles: string[] = [];
  for (const file of plan.files) {
    try {
      await fs.access(path.join(projectRoot, file));
      existingFiles.push(file);
    } catch {
      // File doesn't exist
    }
  }
  plan.files = existingFiles;

  return plan;
}

export function createRemoveCommand(): Command {
  const command = new Command('remove');

  command
    .description('Safely remove a feature from the project')
    .argument('<feature>', 'Feature to remove (e.g., tailwind, prettier)')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--dry-run', 'Show what would be removed without making changes')
    .addHelpText(
      'after',
      `
Examples:
  $ slyxup remove tailwind
  $ slyxup remove prettier --yes
  $ slyxup remove eslint --dry-run
    `
    )
    .action(async (feature: string, options?: RemoveOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          console.error(chalk.red('Not in a SlyxUp project.'));
          console.error(
            chalk.gray('Run this command from a project created with `slyxup init`')
          );
          process.exit(1);
        }

        const metadataManager = new MetadataManager(projectRoot);

        let metadata;
        try {
          metadata = await metadataManager.load();
        } catch {
          console.error(chalk.red('Could not load project metadata.'));
          process.exit(1);
        }

        if (!metadata.features?.includes(feature)) {
          console.error(
            chalk.red(`Feature "${feature}" is not installed in this project.`)
          );
          console.log(
            chalk.gray('Installed features:'),
            metadata.features?.join(', ') || 'none'
          );
          process.exit(1);
        }

        const plan = await buildRemovalPlan(projectRoot, feature);

        console.log();
        console.log(
          chalk.bold(`Removal plan for ${chalk.red(feature)}:`)
        );
        console.log();

        if (plan.dependencies.length > 0) {
          console.log(chalk.yellow('Dependencies to remove:'));
          plan.dependencies.forEach((dep) =>
            console.log(chalk.gray(`  - ${dep}`))
          );
        }

        if (plan.devDependencies.length > 0) {
          console.log(chalk.yellow('Dev dependencies to remove:'));
          plan.devDependencies.forEach((dep) =>
            console.log(chalk.gray(`  - ${dep}`))
          );
        }

        if (plan.files.length > 0) {
          console.log(chalk.yellow('Files to delete:'));
          plan.files.forEach((file) =>
            console.log(chalk.gray(`  - ${file}`))
          );
        }

        if (
          plan.dependencies.length === 0 &&
          plan.devDependencies.length === 0 &&
          plan.files.length === 0
        ) {
          console.log(
            chalk.yellow('  No files or dependencies to remove for this feature.')
          );
        }

        console.log();

        if (options?.dryRun) {
          console.log(chalk.cyan('Dry run complete. No changes made.'));
          return;
        }

        if (!options?.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Remove ${feature}?`,
              default: false,
            },
          ]);

          if (!confirm) {
            console.log(chalk.yellow('Aborted.'));
            return;
          }
        }

        const spinner = ora(`Removing ${feature}...`).start();

        const pkgPath = path.join(projectRoot, 'package.json');
        try {
          const pkg = await safeReadJSON<Record<string, unknown>>(pkgPath);

          if (plan.dependencies.length > 0) {
            const deps = pkg.dependencies as Record<string, string> | undefined;
            if (deps) {
              for (const dep of plan.dependencies) {
                delete deps[dep];
              }
            }
          }

          if (plan.devDependencies.length > 0) {
            const devDeps = pkg.devDependencies as Record<string, string> | undefined;
            if (devDeps) {
              for (const dep of plan.devDependencies) {
                delete devDeps[dep];
              }
            }
          }

          await safeWriteJSON(pkgPath, pkg);
          spinner.text = 'Updated package.json';
        } catch (error) {
          logger.warn('Could not update package.json', error);
        }

        for (const file of plan.files) {
          const filePath = path.join(projectRoot, file);
          try {
            await fs.unlink(filePath);
          } catch {
            // File might not exist, continue
          }
        }
        spinner.text = 'Removed config files';

        await metadataManager.removeFeature(feature);
        spinner.text = 'Updated project metadata';

        spinner.succeed(chalk.green(`Removed ${feature}`));

        console.log();
        console.log(
          chalk.gray('Run `npm install` to update your lockfile.')
        );

        logger.info('Remove completed', { feature });
      } catch (error) {
        logger.error('Remove failed', error);
        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}`));
        }
        process.exit(1);
      }
    });

  return command;
}
