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
  command.description('Discover and explore available tech stacks');

  command
    .command('list')
    .description('List all available tech stacks')
    .option('--json', 'Output as JSON')
    .action(async (options?: StackListOptions) => {
      try {
        const spinner = ora('Loading stacks...').start();

        await registryLoader.load();
        const stacks = registryLoader.listStacks();

        spinner.stop();

        if (options?.json) {
          console.log(JSON.stringify(stacks, null, 2));
          return;
        }

        console.log();
        console.log(chalk.bold('Available Tech Stacks:'));
        console.log();

        if (stacks.length === 0) {
          console.log(chalk.yellow('  No stacks available'));
          return;
        }

        for (const stack of stacks) {
          const statusColor = stack.status === 'beta' ? chalk.yellow : 
                             stack.status === 'coming-soon' ? chalk.gray : chalk.green;
          const statusLabel = stack.status === 'beta' ? 'Beta' : 
                             stack.status === 'coming-soon' ? 'Coming soon' : 'Stable';
          
          console.log(chalk.green(`  ${stack.name}`));
          console.log(chalk.gray(`    ${stack.description}`));
          console.log(chalk.gray(`    Framework: ${stack.framework}`));
          console.log(chalk.gray(`    Features: ${stack.features.join(', ')}`));
          console.log(statusColor(`    [${statusLabel}]`));
          console.log();
        }

        console.log(
          chalk.gray('Use `slyxup stack info <name>` for details')
        );
        console.log(
          chalk.gray('Use `slyxup init <stack> <project>` to create a project with full stack')
        );

        logger.info('Stack list completed');
      } catch (error) {
        logger.error('Stack list failed', error);
        console.error(chalk.red('Failed to load stacks'));
        process.exit(1);
      }
    });

  command
    .command('info <name>')
    .description('Show detailed information about a tech stack')
    .action(async (name: string) => {
      try {
        const spinner = ora('Loading stack info...').start();

        await registryLoader.load();
        const stack = registryLoader.getStack(name);

        spinner.stop();

        if (!stack) {
          console.error(chalk.red(`Stack not found: ${name}`));
          console.log(chalk.gray('Run `slyxup stack list` to see available stacks'));
          process.exit(1);
        }

        const statusColor = stack.status === 'beta' ? chalk.yellow : 
                           stack.status === 'coming-soon' ? chalk.gray : chalk.green;
        const statusLabel = stack.status === 'beta' ? 'Beta' : 
                           stack.status === 'coming-soon' ? 'Coming soon' : 'Stable';

        console.log();
        console.log(chalk.bold.green(stack.name));
        console.log(chalk.gray('─'.repeat(40)));
        console.log();

        console.log(chalk.yellow('Description:'));
        console.log(`  ${stack.description}`);
        console.log();

        console.log(chalk.yellow('Framework:'), stack.framework);
        console.log(chalk.yellow('Version:'), stack.version);
        console.log(chalk.yellow('Status:'), statusColor(statusLabel));

        if (stack.features?.length) {
          console.log();
          console.log(chalk.yellow('Included Features:'));
          stack.features.forEach((f: string) =>
            console.log(chalk.green(`  ✓ ${f}`))
          );
        }

        if (stack.tags?.length) {
          console.log();
          console.log(chalk.yellow('Tags:'), stack.tags.join(', '));
        }

        console.log();
        console.log(chalk.gray('Create project with this stack:'));
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