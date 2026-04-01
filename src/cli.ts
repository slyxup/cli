#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createInitCommand } from './commands/init.js';
import { createAddCommand } from './commands/add.js';
import { createCacheCommand } from './commands/cache.js';
import { createListCommand } from './commands/list.js';
import { logger } from './utils/logger.js';

const VERSION = '2.0.0';

const BANNER = `
${chalk.cyan.bold('   _____ _       _    _       ')}
${chalk.cyan.bold('  / ____| |     | |  | |      ')}
${chalk.cyan.bold(' | (___ | |_   _| |__| |_   _ _ __')}
${chalk.cyan.bold('  \\___ \\| | | | |  __  | | | | \'_ \\')}
${chalk.cyan.bold('  ____) | | |_| | |  | | |_| | |_) |')}
${chalk.cyan.bold(' |_____/|_|\\__, |_|  |_|\\__,_| .__/')}
${chalk.cyan.bold('            __/ |            | |')}
${chalk.cyan.bold('           |___/             |_|')}

${chalk.gray('  Fast, Secure Project Scaffolding')}
${chalk.gray(`  v${VERSION} | https://slyxup.online`)}
`;

const program = new Command();

program
  .name('slyxup')
  .description('Fast, secure CLI for modern project scaffolding')
  .version(VERSION)
  .configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name(),
  });

// Custom help
program.addHelpText('beforeAll', BANNER);

program.addHelpText('after', `
${chalk.cyan.bold('Examples:')}
  ${chalk.gray('$')} slyxup init my-app              ${chalk.gray('# Create React project')}
  ${chalk.gray('$')} slyxup init my-app -t vue       ${chalk.gray('# Create Vue project')}
  ${chalk.gray('$')} slyxup add tailwind             ${chalk.gray('# Add Tailwind CSS')}
  ${chalk.gray('$')} slyxup list templates           ${chalk.gray('# List available templates')}
  ${chalk.gray('$')} slyxup list features            ${chalk.gray('# List available features')}

${chalk.cyan.bold('Documentation:')}
  ${chalk.underline('https://slyxup.online/docs')}

${chalk.cyan.bold('Report Issues:')}
  ${chalk.underline('https://github.com/slyxup/cli/issues')}
`);

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createAddCommand());
program.addCommand(createCacheCommand());
program.addCommand(createListCommand());

// Global error handling
process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  console.error(chalk.red('\nUnexpected error. Please report this issue.'));
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  console.error(chalk.red('\nUnexpected error. Please report this issue.'));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  console.log(BANNER);
  program.outputHelp();
}

// Cleanup logs periodically
logger.cleanup(7).catch(() => {});
