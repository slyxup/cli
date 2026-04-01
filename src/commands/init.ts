import { Command } from 'commander';
import chalk from 'chalk';
import { templateInstaller } from '../core/template-installer.js';
import { logger } from '../utils/logger.js';

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize a new project from a template')
    .argument('<framework>', 'Framework to use (e.g., react, vue, nextjs)')
    .argument('<project-name>', 'Name of the project')
    .option('-v, --version <version>', 'Specific template version')
    .action(async (framework: string, projectName: string, options: { version?: string }) => {
      try {
        await templateInstaller.install({
          framework,
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
