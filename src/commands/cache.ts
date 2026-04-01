import { Command } from 'commander';
import chalk from 'chalk';
import { registryLoader } from '../core/registry.js';
import { downloader } from '../core/downloader.js';
import { extractor } from '../core/extractor.js';
import { logger } from '../utils/logger.js';

export function createCacheCommand(): Command {
  const command = new Command('cache');

  command.description('Manage local cache');

  command
    .command('clear')
    .description('Clear all cached files')
    .action(async () => {
      try {
        console.log(chalk.cyan('Clearing cache...'));

        await registryLoader.clearCache();
        await downloader.clearCache();
        await extractor.cleanupAll();

        console.log(chalk.green('✓ Cache cleared successfully'));
      } catch (error) {
        logger.error('Cache clear failed', error);
        console.error(chalk.red('Failed to clear cache'));
        process.exit(1);
      }
    });

  command
    .command('info')
    .description('Show cache information')
    .action(async () => {
      try {
        const cacheSize = await downloader.getCacheSize();
        const cacheSizeMB = (cacheSize / 1024 / 1024).toFixed(2);

        console.log(chalk.cyan('Cache Information:'));
        console.log(chalk.gray(`  Download cache size: ${cacheSizeMB} MB`));
        console.log(chalk.gray(`  Location: ~/.slyxup/cache`));
      } catch (error) {
        logger.error('Cache info failed', error);
        console.error(chalk.red('Failed to get cache info'));
        process.exit(1);
      }
    });

  return command;
}
