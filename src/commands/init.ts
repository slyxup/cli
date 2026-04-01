import { Command } from 'commander';
import chalk from 'chalk';
import { templateInstaller } from '../core/template-installer.js';
import { logger } from '../utils/logger.js';

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize a new project from a template')
    .argument('<project-name>', 'Name of the project')
    .option('-t, --template <template>', 'Template to use (e.g., react, vue, nextjs)', 'react')
    .option('-v, --version <version>', 'Specific template version')
    .action(async (projectName: string, options: { template?: string; version?: string }) => {
      try {
        await templateInstaller.install({
          framework: options.template || 'react',
          projectName,
          version: options.version,
        });
      } catch (error) {
        logger.error('Init command failed', error);

        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}`));
        } else {
          console.error(chalk.red('\nAn unexpected error occurred'));
        }

        process.exit(1);
      }
    });

  return command;
}
