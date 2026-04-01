import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';

import { MetadataManager } from '../core/metadata.js';
import { logger } from '../utils/logger.js';

interface InspectOptions {
  json?: boolean;
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

export function createInspectCommand(): Command {
  const command = new Command('inspect');

  command
    .description('Show information about the current project')
    .option('--json', 'Output as JSON')
    .action(async (options?: InspectOptions) => {
      try {
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          console.error(chalk.red('Not in a SlyxUp project.'));
          console.error(
            chalk.gray('Run this command from a project created with `slyxup init`')
          );
          process.exit(1);
        }

        const spinner = ora('Inspecting project...').start();

        const metadataManager = new MetadataManager(projectRoot);

        let metadata;
        try {
          metadata = await metadataManager.load();
        } catch {
          spinner.fail(chalk.red('Could not load project metadata.'));
          process.exit(1);
        }

        const pkgPath = path.join(projectRoot, 'package.json');
        let pkg: Record<string, unknown> = {};
        try {
          const content = await fs.readFile(pkgPath, 'utf-8');
          pkg = JSON.parse(content);
        } catch {
          // No package.json
        }

        const metadataPath = path.join(projectRoot, '.slyxup', 'project.json');
        const stats = await fs.stat(metadataPath);

        spinner.stop();

        const info = {
          name: (metadata as { name?: string }).name || (pkg.name as string) || path.basename(projectRoot),
          template: (metadata as { template?: string }).template,
          version: metadata.templateVersion,
          path: projectRoot,
          features: metadata.features || [],
          created: metadata.createdAt,
          modified: stats.mtime.toISOString(),
          packageManager: (metadata as { packageManager?: string }).packageManager || 'npm',
        };

        if (options?.json) {
          console.log(JSON.stringify(info, null, 2));
          return;
        }

        console.log();
        console.log(chalk.bold.cyan(info.name));
        console.log(chalk.gray('─'.repeat(40)));
        console.log();

        console.log(chalk.yellow('Stack:'), info.template || 'unknown');
        if (info.version) {
          console.log(chalk.yellow('Version:'), info.version);
        }
        console.log(chalk.yellow('Path:'), chalk.gray(info.path));
        console.log(chalk.yellow('Package Manager:'), info.packageManager);
        console.log();

        if (info.features.length > 0) {
          console.log(chalk.yellow('Features:'));
          info.features.forEach((f: string) =>
            console.log(chalk.green(`  ✓ ${f}`))
          );
        } else {
          console.log(chalk.gray('No features installed'));
          console.log(chalk.gray('Add features with: slyxup add <feature>'));
        }

        console.log();

        if (info.created) {
          console.log(
            chalk.gray(`Created: ${new Date(info.created).toLocaleDateString()}`)
          );
        }
        console.log(
          chalk.gray(`Modified: ${new Date(info.modified).toLocaleDateString()}`)
        );

        logger.info('Inspect completed', info);
      } catch (error) {
        logger.error('Inspect failed', error);
        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}`));
        }
        process.exit(1);
      }
    });

  return command;
}
