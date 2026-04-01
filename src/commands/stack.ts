import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';

import { registryLoader } from '../core/registry.js';
import { logger } from '../utils/logger.js';

interface StackListOptions {
  json?: boolean;
}

export function createStackCommand(): Command {
  const command = new Command('stack');
  command.description('Discover and explore available stacks');

  command
    .command('list')
    .description('List all available stacks')
    .option('--json', 'Output as JSON')
    .action(async (options?: StackListOptions) => {
      try {
        const spinner = ora('Loading stacks...').start();

        await registryLoader.load();
        const registry = registryLoader.getRegistry();

        spinner.stop();

        if (options?.json) {
          console.log(JSON.stringify(registry.templates, null, 2));
          return;
        }

        console.log();
        console.log(chalk.bold('Available Stacks:'));
        console.log();

        const templateEntries = Object.entries(registry.templates);
        if (templateEntries.length === 0) {
          console.log(chalk.yellow('  No stacks available'));
          return;
        }

        for (const [name, templateArr] of templateEntries) {
          for (const template of templateArr) {
            console.log(chalk.cyan(`  ${name}`));
            console.log(
              chalk.gray(`    ${template.description || 'No description'}`)
            );
            if (template.features?.length) {
              console.log(
                chalk.gray(`    Features: ${template.features.join(', ')}`)
              );
            }
            console.log();
          }
        }

        console.log(
          chalk.gray('Use `slyxup stack info <name>` for details')
        );
        console.log(chalk.gray('Use `slyxup init <stack> <project>` to create a project'));

        logger.info('Stack list completed');
      } catch (error) {
        logger.error('Stack list failed', error);
        console.error(chalk.red('Failed to load stacks'));
        process.exit(1);
      }
    });

  command
    .command('info <name>')
    .description('Show detailed information about a stack')
    .action(async (name: string) => {
      try {
        const spinner = ora('Loading stack info...').start();

        await registryLoader.load();
        const registry = registryLoader.getRegistry();
        const templateArr = registry.templates[name];

        spinner.stop();

        if (!templateArr || templateArr.length === 0) {
          console.error(chalk.red(`Stack not found: ${name}`));
          console.log(chalk.gray('Run `slyxup stack list` to see available stacks'));
          process.exit(1);
        }

        const template = templateArr[0];

        console.log();
        console.log(chalk.bold.cyan(name));
        console.log(chalk.gray('─'.repeat(40)));
        console.log();

        console.log(chalk.yellow('Description:'));
        console.log(`  ${template.description || 'No description'}`);
        console.log();

        if (template.features?.length) {
          console.log(chalk.yellow('Included Features:'));
          template.features.forEach((f) =>
            console.log(chalk.green(`  ✓ ${f}`))
          );
          console.log();
        }

        if (template.version) {
          console.log(chalk.yellow('Version:'), template.version);
        }

        if (template.framework) {
          console.log(chalk.yellow('Framework:'), template.framework);
        }

        if (template.aliases?.length) {
          console.log(chalk.yellow('Aliases:'), template.aliases.join(', '));
        }

        console.log();
        console.log(chalk.gray('Create project:'));
        console.log(chalk.cyan(`  slyxup init ${name} my-app`));

        logger.info('Stack info completed', { name });
      } catch (error) {
        logger.error('Stack info failed', error);
        console.error(chalk.red('Failed to load stack info'));
        process.exit(1);
      }
    });

  return command;
}
