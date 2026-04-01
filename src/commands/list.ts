import { Command } from 'commander';
import chalk from 'chalk';
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

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function createListCommand(): Command {
  const command = new Command('list');

  command.description('List available templates and features');

  command
    .command('templates')
    .description('List available templates')
    .option('-a, --all', 'Show all templates including coming soon')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await registryLoader.load();
        const templates = registryLoader.listTemplates();

        const showAll = options.all;
        const filtered = showAll
          ? templates
          : templates.filter(t => t.status !== 'coming-soon');

        if (options.json) {
          console.log(JSON.stringify(filtered, null, 2));
          return;
        }

        console.log(chalk.bold.cyan('\n📦 Available Templates\n'));

        if (filtered.length === 0) {
          console.log(chalk.gray('  No templates available yet.'));
          console.log();
          return;
        }

        filtered.forEach((template) => {
          const status = template.status || 'stable';
          const symbol = STATUS_SYMBOLS[status];
          const statusColor = STATUS_COLORS[status];
          const statusLabel = STATUS_LABELS[status];
          const version = template.frameworkVersion || template.version;

          console.log(`  ${symbol} ${chalk.cyan.bold(template.name)} ${chalk.gray(`(${version})`)}`);
          console.log(`     ${template.description}`);
          console.log(`     ${statusColor(`Status: ${statusLabel}`)}${template.size ? chalk.gray(` | Size: ${formatSize(template.size)}`) : ''}`);

          if (template.aliases?.length) {
            console.log(chalk.gray(`     Aliases: ${template.aliases.join(', ')}`));
          }

          if (template.features?.length) {
            console.log(chalk.gray(`     Includes: ${template.features.join(', ')}`));
          }

          console.log();
        });

        if (!showAll) {
          const hiddenCount = templates.filter(t => t.status === 'coming-soon').length;
          if (hiddenCount > 0) {
            console.log(chalk.gray(`  ${hiddenCount} template(s) coming soon. Use --all to show them.`));
          }
        }

        console.log(chalk.gray('  Run without arguments for interactive mode:'));
        console.log(chalk.cyan('    slyxup init\n'));

      } catch (error) {
        logger.error('List templates failed', error);
        console.error(chalk.red('\n✗ Failed to list templates'));
        console.error(chalk.gray('  Check your internet connection and try again.'));
        process.exit(1);
      }
    });

  command
    .command('features')
    .description('List available features')
    .option('-a, --all', 'Show all features including coming soon')
    .option('--json', 'Output as JSON')
    .action(async (options) => {
      try {
        await registryLoader.load();
        const features = registryLoader.listFeatures();

        const showAll = options.all;
        const filtered = showAll
          ? features
          : features.filter(f => f.status !== 'coming-soon');

        if (options.json) {
          console.log(JSON.stringify(filtered, null, 2));
          return;
        }

        console.log(chalk.bold.cyan('\n✨ Available Features\n'));

        if (filtered.length === 0) {
          console.log(chalk.gray('  No features available yet.'));
          console.log();
          return;
        }

        const categories = [...new Set(filtered.map(f => f.category || 'other'))];

        categories.forEach(category => {
          const categoryFeatures = filtered.filter(f => (f.category || 'other') === category);

          console.log(chalk.bold.gray(`  ${category.toUpperCase()}`));
          console.log(chalk.gray('  ' + '─'.repeat(40)));

          categoryFeatures.forEach((feature) => {
            const status = feature.status || 'stable';
            const symbol = STATUS_SYMBOLS[status];
            const statusColor = STATUS_COLORS[status];
            const statusLabel = STATUS_LABELS[status];
            const version = feature.frameworkVersion || feature.version;

            console.log(`  ${symbol} ${chalk.cyan(feature.name)} ${chalk.gray(`(${version})`)}`);
            console.log(`     ${feature.description}`);
            console.log(`     ${statusColor(`Status: ${statusLabel}`)}`);
            console.log(`     ${chalk.gray(`Works with: ${feature.frameworks.join(', ')}`)}`);

            if (feature.dependencies?.length) {
              console.log(chalk.gray(`     Adds: ${feature.dependencies.length} dependency(ies)`));
            }

            console.log();
          });
        });

        if (!showAll) {
          const hiddenCount = features.filter(f => f.status === 'coming-soon').length;
          if (hiddenCount > 0) {
            console.log(chalk.gray(`  ${hiddenCount} feature(s) coming soon. Use --all to show them.`));
          }
        }

        console.log(chalk.gray('  Run without arguments for interactive mode:'));
        console.log(chalk.cyan('    slyxup add\n'));

      } catch (error) {
        logger.error('List features failed', error);
        console.error(chalk.red('\n✗ Failed to list features'));
        console.error(chalk.gray('  Check your internet connection and try again.'));
        process.exit(1);
      }
    });

  command
    .command('installed')
    .description('List installed templates and features')
    .action(async () => {
      try {
        const { findProjectRoot } = await import('../core/metadata.js');
        const projectRoot = await findProjectRoot();

        if (!projectRoot) {
          console.log(chalk.yellow('\n⚠ No SlyxUp project found in this directory.'));
          console.log(chalk.gray('  Run this command from inside a SlyxUp project.'));
          console.log();
          return;
        }

        const { MetadataManager } = await import('../core/metadata.js');
        const metadataManager = new MetadataManager(projectRoot);

        try {
          const metadata = await metadataManager.load();

          console.log(chalk.bold.cyan('\n📁 Current Project\n'));
          console.log(chalk.cyan('  Framework:  ') + chalk.white(metadata.framework));
          console.log(chalk.cyan('  Version:    ') + chalk.white(metadata.templateVersion || 'unknown'));

          if (metadata.features.length > 0) {
            console.log();
            console.log(chalk.bold.gray('  Installed Features:'));
            metadata.features.forEach((f, i) => {
              const featureVersion = metadata.featureVersions?.[f] || '';
              console.log(chalk.gray(`    ${i + 1}. ${f}${featureVersion ? ` (${featureVersion})` : ''}`));
            });
          } else {
            console.log();
            console.log(chalk.gray('  No features installed yet.'));
          }

          console.log();
        } catch {
          console.log(chalk.yellow('\n⚠ Project metadata not found.'));
          console.log(chalk.gray('  This may not be a SlyxUp project.'));
          console.log();
        }
      } catch (error) {
        logger.error('List installed failed', error);
        console.error(chalk.red('\n✗ Failed to list installed features'));
        process.exit(1);
      }
    });

  return command;
}
