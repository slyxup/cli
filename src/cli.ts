#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createInitCommand } from './commands/init.js';
import { createAddCommand } from './commands/add.js';
import { createCacheCommand } from './commands/cache.js';
import { createListCommand } from './commands/list.js';
import { logger } from './utils/logger.js';

const program = new Command();

program
  .name('slyxup')
  .description('Production-grade CLI for secure project scaffolding')
  .version('1.0.0');

// Add commands
program.addCommand(createInitCommand());
program.addCommand(createAddCommand());
program.addCommand(createCacheCommand());
program.addCommand(createListCommand());

// Global error handling
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection', { reason, promise });
  console.error(chalk.red('\nAn unexpected error occurred'));
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  console.error(chalk.red('\nAn unexpected error occurred'));
  process.exit(1);
});

// Parse arguments
program.parse(process.argv);

// Show help if no arguments
if (!process.argv.slice(2).length) {
  program.outputHelp();
}

// Cleanup logs periodically
logger.cleanup(7).catch(() => {});
