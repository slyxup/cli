import { Command } from 'commander';
import chalk from 'chalk';
import { featureInstaller } from '../core/feature-installer.js';
import { logger } from '../utils/logger.js';

export function createAddCommand(): Command {
  const command = new Command('add');

  command
    .description('Add a feature to the current project')
    .argument('<feature>', 'Feature to add (e.g., tailwind, shadcn, lucide)')
    .option('-v, --version <version>', 'Specific feature version')
    .option('--skip-install', 'Skip running npm install after adding dependencies')
    .action(async (feature: string, options: { version?: string; skipInstall?: boolean }) => {
      try {
        await featureInstaller.install({
          featureName: feature,
          version: options.version,
          skipNpmInstall: options.skipInstall,
        });
      } catch (error) {
        logger.error('Add command failed', error);

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
