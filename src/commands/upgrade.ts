import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import path from 'path';
import fs from 'fs/promises';

import { registryLoader } from '../core/registry.js';
import { logger } from '../utils/logger.js';

interface UpgradeOptions {
  apply?: boolean;
  check?: boolean;
}

async function findProjectRoot(): Promise<string | null> {
  let current = process.cwd();

  while (current !== path.dirname(current)) {
    const metadataPath = path.join(current, '.slyxup', 'project.json');
    try {
      await fs.access(metadataPath);
      return current;
    } catch {
      current = path.dirname(current);
    }
  }

  return null;
}

export function createUpgradeCommand(): Command {
  const command = new Command('upgrade');

  command
    .description('Check for and apply updates to your project')
    .option('--apply', 'Apply available updates')
    .option('--check', 'Only check for updates (default)')
    .action(async (options?: UpgradeOptions) => {
      try {
        const projectRoot = await findProjectRoot();

        if (!projectRoot) {
          console.log(chalk.cyan('Checking for SlyxUp CLI updates...'));
          console.log();
          console.log(chalk.gray('To update the CLI, run:'));
          console.log(chalk.cyan('  npm update -g @slyxup/cli'));
          return;
        }

        const spinner = ora('Checking for updates...').start();

        const metadataPath = path.join(projectRoot, '.slyxup', 'project.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf-8');
        const metadata = JSON.parse(metadataContent);

        await registryLoader.load(true);
        const registry = registryLoader.getRegistry();

        spinner.stop();

        console.log();
        console.log(chalk.bold('Update Check'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log();

        let updatesAvailable = false;

        if (metadata.template && metadata.templateVersion) {
          const templateArr = registry.templates[metadata.template];
          if (templateArr && templateArr.length > 0) {
            const template = templateArr[0];
            if (template.version !== metadata.templateVersion) {
              updatesAvailable = true;
              console.log(
                chalk.yellow(`Template ${metadata.template}:`)
              );
              console.log(
                chalk.gray(`  Current: ${metadata.templateVersion}`)
              );
              console.log(chalk.green(`  Latest:  ${template.version}`));
              console.log();
            }
          }
        }

        if (metadata.features?.length) {
          console.log(chalk.yellow('Features:'));
          for (const featureName of metadata.features) {
            const featureArr = registry.features[featureName];
            const installedVersion = metadata.featureVersions?.[featureName];

            if (featureArr && featureArr.length > 0) {
              const feature = featureArr[0];
              if (
                installedVersion &&
                feature.version !== installedVersion
              ) {
                updatesAvailable = true;
                console.log(
                  chalk.gray(
                    `  ${featureName}: ${installedVersion} → ${chalk.green(feature.version)}`
                  )
                );
              } else {
                console.log(
                  chalk.gray(`  ${featureName}: ${chalk.green('up to date')}`)
                );
              }
            } else {
              console.log(
                chalk.gray(`  ${featureName}: ${chalk.gray('unknown')}`)
              );
            }
          }
        } else {
          console.log(chalk.gray('  No features to check'));
        }

        console.log();

        if (!updatesAvailable) {
          console.log(chalk.green('✓ Everything is up to date!'));
          return;
        }

        if (options?.apply) {
          console.log(
            chalk.yellow('Upgrade functionality coming in v1.1')
          );
          console.log(
            chalk.gray(
              'For now, use `slyxup remove <feature>` and `slyxup add <feature>` to update'
            )
          );
        } else {
          console.log(
            chalk.gray('Run `slyxup upgrade --apply` to apply updates')
          );
        }

        logger.info('Upgrade check completed', { updatesAvailable });
      } catch (error) {
        logger.error('Upgrade failed', error);
        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}`));
        }
        process.exit(1);
      }
    });

  return command;
}
