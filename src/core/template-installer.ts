import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { registryLoader } from './registry.js';
import { downloader } from './downloader.js';
import { extractor } from './extractor.js';
import { MetadataManager } from './metadata.js';
import { transactionManager } from './transaction.js';
import { FeatureInstaller } from './feature-installer.js';
import { logger } from '../utils/logger.js';
import { ensureDir, pathExists } from '../utils/file.js';
import { InstallationError } from '../types/errors.js';

export interface TemplateInstallOptions {
  framework: string;
  projectName: string;
  targetDir?: string;
  version?: string;
  verbose?: boolean;
}

export class TemplateInstaller {
  async install(options: TemplateInstallOptions): Promise<void> {
    const { framework, projectName, targetDir, version, verbose } = options;
    const projectDir = targetDir || path.resolve(process.cwd(), projectName);
    const isCurrentDir = targetDir === process.cwd();

    // Only check if directory exists for new directories (not current dir)
    if (!isCurrentDir && !targetDir && await pathExists(projectDir)) {
      throw new InstallationError(`Directory already exists: ${projectName}`);
    }

    const spinner = ora('Initializing template installation...').start();
    const transactionId = `template-${Date.now()}`;
    const transaction = transactionManager.createTransaction(transactionId);

    let fromCache = false;

    try {
      spinner.text = 'Loading registry...';
      await registryLoader.load();
      spinner.succeed(chalk.green('✓ Registry loaded'));

      spinner.start('Resolving template...');
      const template = registryLoader.getTemplate(framework, version);
      const displayVersion = template.frameworkVersion || template.version;
      logger.info('Template resolved', { framework, version: template.version });
      spinner.succeed(
        chalk.green(`✓ Template resolved: ${framework} (${displayVersion})`)
      );

      if (verbose) {
        console.log(chalk.gray(`  Source: ${template.downloadUrl}`));
        if (template.description) {
          console.log(chalk.gray(`  Description: ${template.description}`));
        }
      }

      spinner.start('Downloading template...');
      const archivePath = await downloader.download({
        url: template.downloadUrl,
        sha256: template.sha256,
        filename: `${framework}.tar.gz`,
        verbose,
        onCacheHit: () => { fromCache = true; },
      });

      if (fromCache) {
        spinner.succeed(chalk.green('✓ Template ready (from cache)'));
      } else {
        spinner.succeed(chalk.green('✓ Template downloaded'));
      }

      spinner.start('Verifying integrity...');
      spinner.succeed(chalk.green('✓ Integrity verified'));

      spinner.start('Creating project directory...');
      await ensureDir(projectDir);
      if (!isCurrentDir) {
        transaction.recordCreateDir(projectDir);
      }
      spinner.succeed(chalk.green('✓ Project directory ready'));

      spinner.start('Extracting template...');
      const extractedFiles = await extractor.extract(archivePath, projectDir);
      spinner.succeed(chalk.green('✓ Template extracted'));

      if (verbose && extractedFiles.length > 0) {
        console.log(chalk.gray(`  Created ${extractedFiles.length} file(s)`));
      }

      spinner.start('Initializing project metadata...');
      const metadataManager = new MetadataManager(projectDir);
      await metadataManager.initialize(framework, template.version);
      spinner.succeed(chalk.green('✓ Project metadata initialized'));

      if (template.features && template.features.length > 0) {
        const featureInstaller = new FeatureInstaller();
        for (const featureName of template.features) {
          spinner.start(`Installing feature: ${featureName}...`);
          await featureInstaller.install({ featureName, skipNpmInstall: true, verbose });
          await metadataManager.addFeature(featureName);
          spinner.succeed(chalk.green(`✓ Feature installed: ${featureName}`));
        }
      }

      await transactionManager.commitTransaction(transactionId);
      spinner.succeed(chalk.green('✓ Installation completed successfully'));

      console.log();
      console.log(chalk.bold.green('✓ Project created successfully!'));

      if (verbose) {
        console.log();
        console.log(chalk.gray('  Project location: ') + chalk.white(projectDir));
        console.log(chalk.gray('  Framework: ') + chalk.white(`${framework} (${displayVersion})`));
      }

      console.log();
      console.log(chalk.cyan('Next steps:'));
      if (!isCurrentDir) {
        console.log(chalk.gray(`  cd ${projectName}`));
      }
      console.log(chalk.gray('  npm install'));
      console.log(chalk.gray('  npm run dev'));
      console.log();
      console.log(chalk.gray('Add features:'));
      console.log(chalk.cyan('  slyxup add tailwind'));

      logger.info('Template installation completed', { framework, projectName });
    } catch (error) {
      spinner.fail(chalk.red('✗ Installation failed'));

      try {
        await transactionManager.rollbackTransaction(transactionId);
        console.log(chalk.yellow('Changes rolled back successfully'));
      } catch (rollbackError) {
        logger.error('Rollback failed', rollbackError);
        console.log(chalk.red('Warning: Rollback failed. Manual cleanup may be required.'));
      }

      throw error;
    }
  }
}

export const templateInstaller = new TemplateInstaller();
