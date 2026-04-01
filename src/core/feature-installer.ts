import path from 'path';
import fs from 'fs/promises';
import ora from 'ora';
import chalk from 'chalk';
import { registryLoader } from './registry.js';
import { downloader } from './downloader.js';
import { extractor } from './extractor.js';
import { MetadataManager, findProjectRoot } from './metadata.js';
import { transactionManager } from './transaction.js';
import { logger } from '../utils/logger.js';
import { pathExists, safeReadJSON, safeWriteJSON } from '../utils/file.js';
import { mergeDependencies, mergeScripts } from '../utils/merge.js';
import { InstallationError, ValidationError } from '../types/errors.js';
import { FeatureManifest, FeatureManifestSchema } from '../types/schemas.js';
import os from 'os';

export interface FeatureInstallOptions {
  featureName: string;
  version?: string;
  skipNpmInstall?: boolean;
}

export class FeatureInstaller {
  async install(options: FeatureInstallOptions): Promise<void> {
    const { featureName, version, skipNpmInstall = false } = options;

    const spinner = ora('Initializing feature installation...').start();
    const transactionId = `feature-${featureName}-${Date.now()}`;
    const transaction = transactionManager.createTransaction(transactionId);

    try {
      // Find project root
      spinner.text = 'Locating project...';
      const projectRoot = await findProjectRoot();

      if (!projectRoot) {
        throw new InstallationError(
          'Not in a SlyxUp project directory. Run this command from within a project.'
        );
      }

      spinner.succeed(chalk.green('✓ Project located'));

      // Load project metadata
      spinner.start('Loading project metadata...');
      const metadataManager = new MetadataManager(projectRoot);
      const metadata = await metadataManager.load();
      spinner.succeed(chalk.green(`✓ Project metadata loaded (${metadata.framework})`));

      // Check if feature already installed
      if (await metadataManager.hasFeature(featureName)) {
        throw new InstallationError(`Feature already installed: ${featureName}`);
      }

      // Load registry
      spinner.start('Loading registry...');
      await registryLoader.load();
      spinner.succeed(chalk.green('✓ Registry loaded'));

      // Get feature
      spinner.start('Resolving feature...');
      const feature = registryLoader.getFeature(featureName, version);
      logger.info('Feature resolved', { featureName, version: feature.version });

      // Validate framework compatibility
      if (!feature.frameworks.includes(metadata.framework)) {
        throw new ValidationError(
          `Feature ${featureName} is not compatible with ${metadata.framework}. ` +
            `Supported frameworks: ${feature.frameworks.join(', ')}`
        );
      }

      spinner.succeed(chalk.green(`✓ Feature resolved: ${featureName}@${feature.version}`));
      spinner.succeed(chalk.green('✓ Framework compatibility confirmed'));

      // Download feature
      spinner.start('Downloading feature...');
      const archivePath = await downloader.download({
        url: feature.downloadUrl,
        sha256: feature.sha256,
        filename: `${featureName}-${feature.version}.tar.gz`,
      });
      spinner.succeed(chalk.green('✓ Feature downloaded'));

      // Verify integrity
      spinner.start('Verifying integrity...');
      spinner.succeed(chalk.green('✓ Integrity verified'));

      // Extract to temporary workspace
      spinner.start('Extracting feature...');
      const tempWorkspace = path.join(os.homedir(), '.slyxup', 'temp', `feature-${Date.now()}`);
      await extractor.extract(archivePath, tempWorkspace);
      spinner.succeed(chalk.green('✓ Feature extracted'));

      // Read feature manifest
      spinner.start('Reading feature manifest...');
      const manifestPath = path.join(tempWorkspace, 'feature.json');

      if (!(await pathExists(manifestPath))) {
        throw new InstallationError('Feature manifest not found in archive');
      }

      const manifestData = await safeReadJSON<FeatureManifest>(manifestPath);
      const manifest = FeatureManifestSchema.parse(manifestData);
      spinner.succeed(chalk.green('✓ Feature manifest loaded'));

      // Apply file mutations
      await this.applyManifest(manifest, tempWorkspace, projectRoot, transaction);

      // Update metadata
      spinner.start('Updating project metadata...');
      await metadataManager.addFeature(featureName);
      spinner.succeed(chalk.green('✓ Metadata updated'));

      // Commit transaction
      await transactionManager.commitTransaction(transactionId);
      spinner.succeed(chalk.green('✓ Installation completed safely'));

      // Cleanup temp workspace
      await extractor.cleanup(tempWorkspace);

      console.log();
      console.log(chalk.bold.green(`Feature '${featureName}' installed successfully!`));

      if (!skipNpmInstall && (manifest.dependencies || manifest.devDependencies)) {
        console.log();
        console.log(chalk.cyan('Dependencies added. Run:'));
        console.log(chalk.gray('  npm install'));
      }

      console.log();

      logger.info('Feature installation completed', { featureName, projectRoot });
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

  private async applyManifest(
    manifest: FeatureManifest,
    sourceDir: string,
    targetDir: string,
    transaction: any
  ): Promise<void> {
    const spinner = ora();

    // Create new files
    if (manifest.creates && manifest.creates.length > 0) {
      spinner.start(`Creating ${manifest.creates.length} file(s)...`);

      for (const file of manifest.creates) {
        const sourcePath = path.join(sourceDir, file);
        const targetPath = path.join(targetDir, file);

        if (!(await pathExists(sourcePath))) {
          logger.warn('File not found in feature archive', { file });
          continue;
        }

        if (await pathExists(targetPath)) {
          logger.warn('File already exists, skipping', { file });
          continue;
        }

        // Ensure target directory exists
        const targetDirPath = path.dirname(targetPath);
        await fs.mkdir(targetDirPath, { recursive: true });

        await fs.copyFile(sourcePath, targetPath);
        transaction.recordCreate(targetPath);

        logger.info('File created', { file });
      }

      spinner.succeed(chalk.green(`✓ Created ${manifest.creates.length} file(s)`));
    }

    // Modify existing files
    if (manifest.modifies && manifest.modifies.length > 0) {
      spinner.start(`Modifying ${manifest.modifies.length} file(s)...`);

      for (const file of manifest.modifies) {
        const targetPath = path.join(targetDir, file);

        if (!(await pathExists(targetPath))) {
          logger.warn('File to modify does not exist, skipping', { file });
          continue;
        }

        // Backup before modifying
        await transaction.backupFile(targetPath);
        transaction.recordModify(targetPath);

        logger.info('File backed up', { file });
      }

      spinner.succeed(chalk.green(`✓ Files backed up for modification`));
    }

    // Update package.json
    await this.updatePackageJson(manifest, targetDir, transaction);
  }

  private async updatePackageJson(
    manifest: FeatureManifest,
    projectDir: string,
    transaction: any
  ): Promise<void> {
    const packageJsonPath = path.join(projectDir, 'package.json');

    if (!(await pathExists(packageJsonPath))) {
      logger.warn('package.json not found, skipping dependency injection');
      return;
    }

    const spinner = ora('Updating package.json...').start();

    // Backup package.json
    await transaction.backupFile(packageJsonPath);

    const packageJson = await safeReadJSON<Record<string, any>>(packageJsonPath);

    // Merge dependencies
    if (manifest.dependencies) {
      packageJson.dependencies = mergeDependencies(
        packageJson.dependencies || {},
        manifest.dependencies
      );
      spinner.text = 'Dependencies injected...';
    }

    // Merge devDependencies
    if (manifest.devDependencies) {
      packageJson.devDependencies = mergeDependencies(
        packageJson.devDependencies || {},
        manifest.devDependencies
      );
      spinner.text = 'Dev dependencies injected...';
    }

    // Merge scripts
    if (manifest.scripts) {
      packageJson.scripts = mergeScripts(packageJson.scripts || {}, manifest.scripts);
      spinner.text = 'Scripts updated...';
    }

    await safeWriteJSON(packageJsonPath, packageJson);
    transaction.recordModify(packageJsonPath);

    spinner.succeed(chalk.green('✓ package.json updated'));
  }
}

export const featureInstaller = new FeatureInstaller();
