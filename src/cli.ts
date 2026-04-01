#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { createInitCommand } from './commands/init.js';
import { createAddCommand } from './commands/add.js';
import { createRemoveCommand } from './commands/remove.js';
import { createListCommand } from './commands/list.js';
import { createStackCommand } from './commands/stack.js';
import { createInspectCommand } from './commands/inspect.js';
import { createDoctorCommand } from './commands/doctor.js';
import { createUpgradeCommand } from './commands/upgrade.js';
import { createCacheCommand } from './commands/cache.js';
import { logger } from './utils/logger.js';

const VERSION = '2.0.0';

// Responsive banner that adapts to terminal width
const getBanner = () => {
  const terminalWidth = process.stdout.columns || 80;
  
  // Full banner for wider terminals (>= 80 cols)
  const fullBanner = `
${chalk.cyan.bold('  ███████╗██╗  ██╗   ██╗██╗  ██╗██╗   ██╗██████╗ ')}
${chalk.cyan.bold('  ██╔════╝██║  ╚██╗ ██╔╝╚██╗██╔╝██║   ██║██╔══██╗')}
${chalk.cyan.bold('  ███████╗██║   ╚████╔╝  ╚███╔╝ ██║   ██║██████╔╝')}
${chalk.cyan.bold('  ╚════██║██║    ╚██╔╝   ██╔██╗ ██║   ██║██╔═══╝ ')}
${chalk.cyan.bold('  ███████║███████╗██║   ██╔╝ ██╗╚██████╔╝██║     ')}
${chalk.cyan.bold('  ╚══════╝╚══════╝╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝     ')}

${chalk.gray('  ⚡ Fast  •  🔒 Secure  •  🚀 Modern CLI')}
${chalk.gray(`  v${VERSION}  |  https://slyxup.online`)}
`;

  // Compact banner for smaller terminals (< 80 cols)
  const compactBanner = `
${chalk.cyan.bold('  ███████╗██╗  ██╗   ██╗██╗  ██╗██╗   ██╗██████╗')}
${chalk.cyan.bold('  ██╔════╝██║  ╚██╗ ██╔╝╚██╗██╔╝██║   ██║██╔══██╗')}
${chalk.cyan.bold('  ███████╗██║   ╚████╔╝  ╚███╔╝ ██║   ██║██████╔╝')}
${chalk.cyan.bold('  ╚════██║██║    ╚██╔╝   ██╔██╗ ██║   ██║██╔═══╝')}
${chalk.cyan.bold('  ███████║███████╗██║   ██╔╝ ██╗╚██████╔╝██║')}
${chalk.cyan.bold('  ╚══════╝╚══════╝╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═╝')}

${chalk.gray(`  ⚡ v${VERSION}  •  https://slyxup.online`)}
`;

  // Minimal banner for very small terminals (< 60 cols)
  const minimalBanner = `
${chalk.cyan.bold('  SLYXUP')}
${chalk.gray(`  v${VERSION}  •  Fast, Secure CLI`)}
`;

  if (terminalWidth >= 80) return fullBanner;
  if (terminalWidth >= 60) return compactBanner;
  return minimalBanner;
};

const BANNER = getBanner();

const EXAMPLES = `
${chalk.bold.cyan('  Quick Start:')}
  ${chalk.gray('$')} ${chalk.white('slyxup init')}              ${chalk.dim('# Interactive mode')}
  ${chalk.gray('$')} ${chalk.white('slyxup init react app')}   ${chalk.dim('# Create React project')}
  ${chalk.gray('$')} ${chalk.white('slyxup add tailwind')}     ${chalk.dim('# Add features')}
  ${chalk.gray('$')} ${chalk.white('slyxup list templates')}   ${chalk.dim('# Browse templates')}

${chalk.bold.cyan('  Resources:')}
  ${chalk.cyan('📖 Docs:')}   ${chalk.underline('https://slyxup.online/docs')}
  ${chalk.cyan('🐛 Issues:')} ${chalk.underline('https://github.com/slyxup/cli/issues')}
`;

const program = new Command();

program
  .name('slyxup')
  .description('⚡ Fast, secure CLI for modern project scaffolding')
  .version(VERSION)
  .configureHelp({
    sortSubcommands: true,
    subcommandTerm: (cmd) => cmd.name(),
    visibleOptions: (cmd) => {
      const opts = cmd.options.filter(opt => !opt.hidden);
      return opts;
    },
  });

program.addHelpText('beforeAll', BANNER);
program.addHelpText('after', EXAMPLES);

program.addCommand(createInitCommand());
program.addCommand(createAddCommand());
program.addCommand(createRemoveCommand());
program.addCommand(createListCommand());
program.addCommand(createStackCommand());
program.addCommand(createInspectCommand());
program.addCommand(createDoctorCommand());
program.addCommand(createUpgradeCommand());
program.addCommand(createCacheCommand());

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection', { reason });
  console.error(chalk.red('\n  ✗ Unexpected error occurred'));
  console.error(chalk.gray('  Please report this at: https://github.com/slyxup/cli/issues\n'));
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', error);
  console.error(chalk.red('\n  ✗ Unexpected error occurred'));
  console.error(chalk.gray('  Please report this at: https://github.com/slyxup/cli/issues\n'));
  process.exit(1);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  console.log(BANNER);
  program.outputHelp();
}

logger.cleanup(7).catch(() => {});
