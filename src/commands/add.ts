import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { execSync } from 'child_process';

import { detectProject, initializeSlyxUpMetadata } from '../core/detector.js';
import { featureInstaller } from '../core/feature-installer.js';
import { advancedFeatureInstaller } from '../core/advanced-feature-installer.js';
import { registryLoader } from '../core/registry.js';
import { logger } from '../utils/logger.js';

const STATUS_SYMBOLS: Record<string, string> = {
  'stable': '🟢',
  'beta': '🟡',
  'coming-soon': '🔴',
};

const STATUS_COLORS: Record<string, typeof chalk.green> = {
  'stable': chalk.green,
  'beta': chalk.yellow,
  'coming-soon': chalk.gray,
};

const STATUS_LABELS: Record<string, string> = {
  'stable': 'Stable',
  'beta': 'Beta',
  'coming-soon': 'Coming soon',
};

interface AddOptions {
  version?: string;
  skipInstall?: boolean;
  yes?: boolean;
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
  legacy?: boolean;
}

export function createAddCommand(): Command {
  const command = new Command('add');

  command
    .description('Add features to your project')
    .argument('[features...]', 'Features to add (e.g., tailwind, shadcn, prettier)')
    .option('-v, --version <version>', 'Specific feature version')
    .option('--skip-install', 'Skip npm install after adding feature')
    .option('-y, --yes', 'Skip confirmation prompts')
    .option('--dry-run', 'Preview what will be added without making changes')
    .option('--verbose', 'Show detailed information')
    .option('--force', 'Force install even with conflicts')
    .option('--legacy', 'Use legacy installer (for debugging)')
    .addHelpText(
      'after',
      `
Examples:
  $ slyxup add tailwind
  $ slyxup add tailwind shadcn prettier
  $ slyxup add eslint --skip-install
  $ slyxup add tailwind --dry-run
  $ slyxup add prisma --force
  $ slyxup add --verbose
    `
    )
    .action(async (features: string[], options?: AddOptions) => {
      try {
        const spinner = ora('Detecting project...').start();
        const project = await detectProject();

        if (!project) {
          spinner.fail(chalk.red('No project found'));
          console.log();
          console.log(chalk.yellow('⚠ Could not find a project in this directory.'));
          console.log(chalk.gray('  Make sure you are in a directory with a package.json file.'));
          console.log();
          console.log(chalk.gray('To create a new project:'));
          console.log(chalk.cyan('  slyxup init react my-app'));
          console.log();
          process.exit(1);
        }

        spinner.succeed(chalk.green(`Detected ${chalk.cyan(project.framework)} project`));

        console.log(chalk.gray(`  Project: ${project.name}`));
        console.log(chalk.gray(`  Path: ${project.root}`));

        if (!project.isSlyxUp) {
          console.log(
            chalk.gray(`  Note: Not a SlyxUp project (will initialize tracking)`)
          );
        }
        console.log();

        if (project.framework === 'unknown') {
          const { proceed } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'proceed',
              message: chalk.yellow('Could not detect framework. Proceed anyway?'),
              default: false,
            },
          ]);

          if (!proceed) {
            console.log(chalk.gray('\nAborted.\n'));
            return;
          }
        }

        spinner.start('Loading feature registry...');
        await registryLoader.load();
        spinner.succeed(chalk.green('Registry loaded'));

        let featuresToInstall = features;

        if (featuresToInstall.length === 0) {
          const allFeatures = registryLoader.listFeatures();

          const compatibleFeatures = allFeatures.filter(
            (f) =>
              f.frameworks.includes(project.framework) ||
              f.frameworks.includes('*') ||
              project.framework === 'unknown'
          );

          const availableFeatures = compatibleFeatures.filter(
            (f) => !project.features.includes(f.name)
          );

          if (availableFeatures.length === 0) {
            console.log(
              chalk.yellow('\n⚠ No additional features available for this project.')
            );
            if (project.features.length > 0) {
              console.log(
                chalk.gray('  Installed features: ' + project.features.join(', '))
              );
            }
            console.log();
            return;
          }

          console.log(chalk.bold.cyan('\n✨ Available Features\n'));

          const categories = [...new Set(availableFeatures.map(f => f.category || 'other'))];

          for (const category of categories) {
            const categoryFeatures = availableFeatures.filter(f => (f.category || 'other') === category);
            console.log(chalk.bold.gray(`  ${category.toUpperCase()}`));

            for (const f of categoryFeatures) {
              const status = f.status || 'stable';
              const symbol = STATUS_SYMBOLS[status];
              const statusColor = STATUS_COLORS[status];
              const version = f.frameworkVersion || f.version;

              console.log(`    ${symbol} ${chalk.cyan(f.name)} ${chalk.gray(`(${version})`)}`);
              console.log(`       ${f.description}`);
              console.log(`       ${statusColor(`[${STATUS_LABELS[status]}]`)}`);
            }
            console.log();
          }

          const { selectedFeatures } = await inquirer.prompt([
            {
              type: 'checkbox',
              name: 'selectedFeatures',
              message: 'Select features to add (Space to select, Enter to confirm):',
              choices: availableFeatures.map((f) => ({
                name: `${f.name} ${chalk.gray(`(${f.frameworkVersion || f.version})`)}`,
                value: f.name,
                checked: false,
              })),
            },
          ]);

          if (selectedFeatures.length === 0) {
            console.log(chalk.yellow('\nNo features selected.\n'));
            return;
          }

          featuresToInstall = selectedFeatures;
        }

        console.log();
        console.log(chalk.bold('📦 Installation Plan:\n'));

        const installPlan: Array<{
          name: string;
          version: string;
          dependencies: string[];
          creates?: string[];
          modifies?: string[];
          status: string;
        }> = [];

        for (const featureName of featuresToInstall) {
          if (project.features.includes(featureName) && !options?.force) {
            console.log(chalk.yellow(`  ⚠ ${featureName} is already installed (skipping)`));
            continue;
          }

          try {
            const feature = registryLoader.getFeature(featureName, options?.version);

            if (
              !feature.frameworks.includes(project.framework) &&
              !feature.frameworks.includes('*') &&
              project.framework !== 'unknown'
            ) {
              console.log(
                chalk.red(`  ✗ ${featureName} is not compatible with ${project.framework}`)
              );
              console.log(chalk.gray(`    Supported: ${feature.frameworks.join(', ')}`));
              continue;
            }

            const status = feature.status || 'stable';
            const statusColor = STATUS_COLORS[status];
            const statusLabel = STATUS_LABELS[status];
            const displayVersion = feature.frameworkVersion || feature.version;

            installPlan.push({
              name: feature.name,
              version: displayVersion,
              dependencies: feature.dependencies || [],
              creates: [],
              modifies: [],
              status: statusLabel,
            });

            console.log(chalk.green(`  ✓ ${feature.name} ${chalk.gray(`(${displayVersion})`)}`));
            console.log(`    ${statusColor(`[${statusLabel}]`)}`);

            if (feature.dependencies?.length) {
              console.log(chalk.gray(`    Dependencies:`));
              feature.dependencies.forEach(dep => {
                console.log(chalk.gray(`      + ${dep}`));
              });
            }
          } catch {
            console.log(chalk.red(`  ✗ ${featureName} not found in registry`));
            console.log(chalk.gray(`    Run 'slyxup list features' to see available features.`));
          }
        }

        if (installPlan.length === 0) {
          console.log(chalk.yellow('\n⚠ Nothing to install.\n'));
          return;
        }

        console.log();

        // Handle dry run for preview
        if (options?.dryRun) {
          console.log(chalk.bold.cyan('\n🔍 Dry Run - Preview Mode\n'));
          
          // Use advanced installer for detailed dry run
          for (const plan of installPlan) {
            try {
              await advancedFeatureInstaller.install({
                featureName: plan.name,
                version: options?.version,
                skipNpmInstall: true,
                projectRoot: project.root,
                framework: project.framework,
                verbose: options?.verbose,
                dryRun: true,
                force: options?.force,
              });
            } catch (error) {
              // Dry run errors are informational
              if (options?.verbose && error instanceof Error) {
                console.log(chalk.gray(`  Note: ${error.message}`));
              }
            }
          }
          
          console.log(chalk.green('\n✓ This was a preview. No files were created.\n'));
          console.log(chalk.gray('  Run without --dry-run to actually install features.'));
          return;
        }

        if (!options?.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Install ${installPlan.length} feature(s)?`,
              default: true,
            },
          ]);

          if (!confirm) {
            console.log(chalk.gray('\nAborted.\n'));
            return;
          }
        }

        if (!project.isSlyxUp) {
          spinner.start('Initializing SlyxUp tracking...');
          await initializeSlyxUpMetadata(project);
          spinner.succeed(chalk.green('SlyxUp tracking initialized'));
        }

        // Install features
        const results: Array<{ name: string; success: boolean; error?: string }> = [];

        for (const plan of installPlan) {
          try {
            // Use advanced installer by default, fallback to legacy if specified
            if (options?.legacy) {
              const featureSpinner = ora(`Installing ${plan.name} (legacy mode)...`).start();
              
              await featureInstaller.install({
                featureName: plan.name,
                version: options?.version,
                skipNpmInstall: true,
                projectRoot: project.root,
                framework: project.framework,
                verbose: options?.verbose,
              });
              
              featureSpinner.succeed(chalk.green(`✓ ${plan.name} installed`));
              results.push({ name: plan.name, success: true });
            } else {
              // Use advanced installer with framework-aware features
              const report = await advancedFeatureInstaller.install({
                featureName: plan.name,
                version: options?.version,
                skipNpmInstall: true,
                projectRoot: project.root,
                framework: project.framework,
                verbose: options?.verbose,
                dryRun: false,
                force: options?.force,
              });
              
              results.push({ name: plan.name, success: report.success });

              if (options?.verbose && report.success) {
                if (report.filesCreated.length > 0) {
                  console.log(chalk.gray(`    Created: ${report.filesCreated.join(', ')}`));
                }
                if (report.filesModified.length > 0) {
                  console.log(chalk.gray(`    Modified: ${report.filesModified.join(', ')}`));
                }
                if (Object.keys(report.dependenciesAdded).length > 0) {
                  console.log(chalk.gray(`    Dependencies: ${Object.keys(report.dependenciesAdded).join(', ')}`));
                }
              }
            }
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.push({ name: plan.name, success: false, error: errorMessage });
            
            console.log(chalk.red(`  ✗ Failed to install ${plan.name}`));
            if (options?.verbose) {
              console.log(chalk.gray(`    Error: ${errorMessage}`));
            }
          }
        }

        console.log();

        // Summary
        const successCount = results.filter(r => r.success).length;
        const failCount = results.filter(r => !r.success).length;

        if (successCount > 0) {
          console.log(chalk.bold.green('✓ ') + chalk.bold(`Added ${successCount} feature(s) successfully!`));
        }

        if (failCount > 0) {
          console.log(chalk.bold.red('✗ ') + chalk.bold(`${failCount} feature(s) failed to install.`));
          
          for (const result of results.filter(r => !r.success)) {
            console.log(chalk.red(`  - ${result.name}: ${result.error}`));
          }
        }

        if (!options?.skipInstall && successCount > 0) {
          console.log();
          const { runInstall } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'runInstall',
              message: `Run ${project.packageManager} install to install dependencies?`,
              default: true,
            },
          ]);

          if (runInstall) {
            console.log(chalk.gray(`\n  Running ${project.packageManager} install...`));
            try {
              execSync(`${project.packageManager} install`, {
                cwd: project.root,
                stdio: 'inherit',
              });
              console.log(chalk.green(`\n✓ Dependencies installed successfully.`));
            } catch (error) {
              console.log(chalk.red(`\n✗ Failed to install dependencies.`));
              console.log(chalk.gray(`  Please run '${project.packageManager} install' manually.`));
            }
          } else {
            console.log(
              chalk.cyan(`\nRun `) + chalk.white(`\`${project.packageManager} install\``) + chalk.cyan(' to install dependencies.')
            );
          }
        }

        console.log();
        console.log(chalk.gray('Tip: Use ') + chalk.cyan('slyxup list installed') + chalk.gray(' to see all installed features.\n'));

        logger.info('Add command completed', {
          features: results.filter(r => r.success).map(r => r.name),
          failed: results.filter(r => !r.success).map(r => r.name),
          project: project.name,
        });

        // Exit with error code if any installations failed
        if (failCount > 0 && successCount === 0) {
          process.exit(1);
        }
      } catch (error) {
        logger.error('Add command failed', error);

        if (error instanceof Error) {
          console.error(chalk.red(`\n✗ Error: ${error.message}`));
          if (options?.verbose) {
            console.error(chalk.gray(error.stack || ''));
          }
        } else {
          console.error(chalk.red('\n✗ An unexpected error occurred'));
        }

        console.log();
        console.log(chalk.gray('Troubleshooting:'));
        console.log(chalk.cyan('  slyxup doctor          ') + chalk.gray('# Check environment'));
        console.log(chalk.cyan('  slyxup cache clear     ') + chalk.gray('# Clear cache'));
        console.log(chalk.cyan('  slyxup list features    ') + chalk.gray('# List available features'));
        console.log();

        process.exit(1);
      }
    });

  return command;
}
