import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { featureInstaller } from '../core/feature-installer.js';
import { registryLoader } from '../core/registry.js';
import { MetadataManager, findProjectRoot } from '../core/metadata.js';
import { logger } from '../utils/logger.js';

export function createAddCommand(): Command {
  const command = new Command('add');

  command
    .description('Add a feature to your project')
    .argument('[feature]', 'Feature to add (e.g., tailwind, shadcn)')
    .option('-v, --version <version>', 'Specific feature version')
    .option('--skip-install', 'Skip npm install after adding feature')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (featureName?: string, options?: { version?: string; skipInstall?: boolean; yes?: boolean }) => {
      try {
        // Check if in a project
        const projectRoot = await findProjectRoot();
        if (!projectRoot) {
          console.error(chalk.red('\nNot in a SlyxUp project directory.'));
          console.log(chalk.gray('Run this command from within a project created with "slyxup init".'));
          process.exit(1);
        }

        // Load project metadata
        const metadataManager = new MetadataManager(projectRoot);
        const metadata = await metadataManager.load();

        // Load registry
        await registryLoader.load();

        // Interactive mode if no feature specified
        let finalFeature = featureName;

        if (!finalFeature) {
          const features = registryLoader.listFeatures();
          const compatibleFeatures = features.filter((f) =>
            f.frameworks.includes(metadata.framework)
          );

          if (compatibleFeatures.length === 0) {
            console.log(chalk.yellow('\nNo compatible features found for your project.'));
            return;
          }

          const { selectedFeature } = await inquirer.prompt([
            {
              type: 'list',
              name: 'selectedFeature',
              message: `Select a feature to add (${metadata.framework} project):`,
              choices: compatibleFeatures.map((f) => ({
                name: `${chalk.cyan(f.name)} - ${f.description}`,
                value: f.name,
              })),
            },
          ]);

          finalFeature = selectedFeature;
        }

        // Check compatibility before installing
        const feature = registryLoader.getFeature(finalFeature!);
        if (!feature.frameworks.includes(metadata.framework)) {
          console.error(chalk.red(`\nFeature "${finalFeature}" is not compatible with ${metadata.framework}.`));
          console.log(chalk.gray(`Supported frameworks: ${feature.frameworks.join(', ')}`));
          process.exit(1);
        }

        // Confirm installation
        if (!options?.yes) {
          console.log();
          console.log(chalk.cyan.bold('Feature Details:'));
          console.log(chalk.gray(`  Name: ${feature.name}`));
          console.log(chalk.gray(`  Version: ${feature.version}`));
          console.log(chalk.gray(`  Description: ${feature.description}`));
          if (feature.dependencies) {
            console.log(chalk.gray(`  Dependencies: ${feature.dependencies.join(', ')}`));
          }
          console.log();

          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: 'Install this feature?',
              default: true,
            },
          ]);

          if (!confirm) {
            console.log(chalk.yellow('Aborted.'));
            return;
          }
        }

        // Install feature
        await featureInstaller.install({
          featureName: finalFeature!,
          version: options?.version,
          skipNpmInstall: options?.skipInstall,
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
