import path from 'path';
import ora from 'ora';
import chalk from 'chalk';
import { registryLoader } from './registry.js';
import { downloader } from './downloader.js';
import { extractor } from './extractor.js';
import { MetadataManager } from './metadata.js';
import { transactionManager } from './transaction.js';
import { logger } from '../utils/logger.js';
import { ensureDir, pathExists } from '../utils/file.js';
import { InstallationError } from '../types/errors.js';

export interface TemplateInstallOptions {
  framework: string;
  projectName: string;
  version?: string;
}

export class TemplateInstaller {
  async install(options: TemplateInstallOptions): Promise<void> {
    const { framework, projectName, version } = options;
    const projectDir = path.resolve(process.cwd(), projectName);

    // Check if directory already exists
    if (await pathExists(projectDir)) {
      throw new InstallationError(`Directory already exists: ${projectName}`);
    }

    const spinner = ora('Initializing template installation...').start();
    const transactionId = `template-${Date.now()}`;
    const transaction = transactionManager.createTransaction(transactionId);

    try {
      // Load registry
      spinner.text = 'Loading registry...';
      await registryLoader.load();
      spinner.succeed(chalk.green('✓ Registry loaded'));

      // Get template
      spinner.start('Resolving template...');
      const template = registryLoader.getTemplate(framework, version);
      logger.info('Template resolved', { framework, version: template.version });
      spinner.succeed(
        chalk.green(`✓ Template resolved: ${framework}@${template.version}`)
      );

      // Download template
      spinner.start('Downloading template...');
      const archivePath = await downloader.download({
        url: template.downloadUrl,
        sha256: template.sha256,
        filename: `${framework}-${template.version}.tar.gz`,
      });
      spinner.succeed(chalk.green('✓ Template downloaded'));

      // Verify integrity
      spinner.start('Verifying integrity...');
      // Already verified in downloader
      spinner.succeed(chalk.green('✓ Integrity verified'));

      // Create project directory
      spinner.start('Creating project directory...');
      await ensureDir(projectDir);
      transaction.recordCreateDir(projectDir);
      spinner.succeed(chalk.green('✓ Project directory created'));

      // Extract template
      spinner.start('Extracting template...');
      await extractor.extract(archivePath, projectDir);
      spinner.succeed(chalk.green('✓ Template extracted'));

      // Initialize metadata
      spinner.start('Initializing project metadata...');
      const metadataManager = new MetadataManager(projectDir);
      await metadataManager.initialize(framework, template.version);
      spinner.succeed(chalk.green('✓ Project metadata initialized'));

      // Commit transaction
      await transactionManager.commitTransaction(transactionId);
      spinner.succeed(chalk.green('✓ Installation completed successfully'));

      console.log();
      console.log(chalk.bold.green('Project created successfully!'));
      console.log();
      console.log(chalk.cyan('Next steps:'));
      console.log(chalk.gray(`  cd ${projectName}`));
      console.log(chalk.gray('  npm install'));
      console.log(chalk.gray('  npm run dev'));
      console.log();
      console.log(chalk.cyan('Add features:'));
      console.log(chalk.gray('  slyxup add tailwind'));
      console.log(chalk.gray('  slyxup add shadcn'));
      console.log();

      logger.info('Template installation completed', { framework, projectName });
    } catch (error) {
      spinner.fail(chalk.red('✗ Installation failed'));

      // Rollback transaction
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
