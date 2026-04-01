import { Command } from 'commander';
import chalk from 'chalk';
import { registryLoader } from '../core/registry.js';
import { logger } from '../utils/logger.js';

export function createListCommand(): Command {
  const command = new Command('list');

  command.description('List available templates and features');

  command
    .command('templates')
    .description('List available templates')
    .action(async () => {
      try {
        await registryLoader.load();
        const templates = registryLoader.listTemplates();

        console.log(chalk.cyan('Available templates:'));
        templates.forEach((template) => {
          console.log(chalk.gray(`  • ${template}`));
        });
      } catch (error) {
        logger.error('List templates failed', error);
        console.error(chalk.red('Failed to list templates'));
        process.exit(1);
      }
    });

  command
    .command('features')
    .description('List available features')
    .action(async () => {
      try {
        await registryLoader.load();
        const features = registryLoader.listFeatures();

        console.log(chalk.cyan('Available features:'));
        features.forEach((feature) => {
          console.log(chalk.gray(`  • ${feature}`));
        });
      } catch (error) {
        logger.error('List features failed', error);
        console.error(chalk.red('Failed to list features'));
        process.exit(1);
      }
    });

  return command;
}
