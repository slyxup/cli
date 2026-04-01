/**
 * Advanced Feature Installer
 * 
 * Intelligently installs features in any project structure:
 * - Auto-detects project type and framework
 * - Uses framework-specific file paths
 * - Applies smart file modifications
 * - Handles dependencies and conflicts
 * - Supports monorepo structures
 */

import path from 'path';
import fs from 'fs/promises';
import ora from 'ora';
import chalk from 'chalk';

import { analyzeProject, AnalyzedProject } from './project-analyzer.js';
import { createFrameworkAdapter, FrameworkAdapter } from './framework-adapter.js';
import { createSmartFileModifier, SmartFileModifier } from './smart-file-modifier.js';
import { registryLoader } from './registry.js';
import { downloader } from './downloader.js';
import { extractor } from './extractor.js';
import { MetadataManager } from './metadata.js';
import { transactionManager, Transaction } from './transaction.js';
import { logger } from '../utils/logger.js';
import { pathExists, safeReadJSON, safeWriteJSON, ensureDir } from '../utils/file.js';
import { mergeDependencies, mergeScripts } from '../utils/merge.js';
import { InstallationError, ValidationError } from '../types/errors.js';
import { 
  FeatureManifest, 
  EnhancedFeatureManifest,
  FeatureManifestSchema,
  EnhancedFeatureManifestSchema,
  ContentModification,
} from '../types/schemas.js';
import os from 'os';

// ============================================================================
// Types
// ============================================================================

export interface AdvancedInstallOptions {
  featureName: string;
  version?: string;
  skipNpmInstall?: boolean;
  projectRoot?: string;
  framework?: string;
  verbose?: boolean;
  dryRun?: boolean;
  force?: boolean;           // Force install even with conflicts
  skipValidation?: boolean;  // Skip pre-install validation
}

export interface InstallationReport {
  success: boolean;
  featureName: string;
  version: string;
  framework: string;
  filesCreated: string[];
  filesModified: string[];
  dependenciesAdded: Record<string, string>;
  devDependenciesAdded: Record<string, string>;
  scriptsAdded: Record<string, string>;
  warnings: string[];
  errors: string[];
  duration: number;
}

// ============================================================================
// Feature Installer Class
// ============================================================================

export class AdvancedFeatureInstaller {
  private project: AnalyzedProject | null = null;
  private adapter: FrameworkAdapter | null = null;
  private modifier: SmartFileModifier | null = null;

  /**
   * Install a feature into the project
   */
  async install(options: AdvancedInstallOptions): Promise<InstallationReport> {
    const startTime = Date.now();
    const report: InstallationReport = {
      success: false,
      featureName: options.featureName,
      version: '',
      framework: '',
      filesCreated: [],
      filesModified: [],
      dependenciesAdded: {},
      devDependenciesAdded: {},
      scriptsAdded: {},
      warnings: [],
      errors: [],
      duration: 0,
    };

    const spinner = ora('Analyzing project...').start();
    const transactionId = `feature-${options.featureName}-${Date.now()}`;
    const transaction = transactionManager.createTransaction(transactionId);

    try {
      // Step 1: Analyze project
      spinner.text = 'Analyzing project structure...';
      this.project = await analyzeProject(options.projectRoot || process.cwd());

      if (!this.project) {
        throw new InstallationError('No project found. Make sure you are in a directory with package.json.');
      }

      report.framework = this.project.framework;
      spinner.succeed(chalk.green(`✓ Detected ${chalk.cyan(this.project.framework)} project`));

      if (options.verbose) {
        console.log(chalk.gray(`  Project: ${this.project.name}`));
        console.log(chalk.gray(`  Path: ${this.project.root}`));
        console.log(chalk.gray(`  TypeScript: ${this.project.hasTypescript ? 'Yes' : 'No'}`));
        console.log(chalk.gray(`  Build tool: ${this.project.buildTool}`));
        if (this.project.installedFeatures.length > 0) {
          console.log(chalk.gray(`  Features: ${this.project.installedFeatures.join(', ')}`));
        }
      }

      // Step 2: Create framework adapter
      this.adapter = createFrameworkAdapter(this.project);

      // Step 3: Create file modifier
      this.modifier = createSmartFileModifier({
        projectRoot: this.project.root,
        framework: this.project.framework,
        hasTypescript: this.project.hasTypescript,
        fileExtension: this.project.hasTypescript ? '.tsx' : '.jsx',
      });

      // Step 4: Check if feature is already installed
      if (this.project.installedFeatures.includes(options.featureName) && !options.force) {
        spinner.warn(chalk.yellow(`Feature ${options.featureName} is already installed`));
        report.warnings.push(`Feature ${options.featureName} is already installed`);
        report.success = true;
        report.duration = Date.now() - startTime;
        return report;
      }

      // Step 5: Check framework compatibility
      if (!this.adapter.supportsFeature(options.featureName)) {
        throw new ValidationError(
          `Feature ${options.featureName} is not compatible with ${this.project.framework}`
        );
      }

      // Step 6: Load registry and get feature info
      spinner.start('Loading feature registry...');
      await registryLoader.load();
      const featureInfo = registryLoader.getFeature(options.featureName, options.version);
      report.version = featureInfo.version;
      spinner.succeed(chalk.green(`✓ Feature resolved: ${options.featureName} v${featureInfo.version}`));

      // Step 7: Download feature
      spinner.start('Downloading feature...');
      const archivePath = await downloader.download({
        url: featureInfo.downloadUrl,
        sha256: featureInfo.sha256,
        filename: `${options.featureName}.tar.gz`,
      });
      spinner.succeed(chalk.green('✓ Feature downloaded'));

      // Step 8: Extract to temporary workspace
      spinner.start('Extracting feature...');
      const tempWorkspace = path.join(os.homedir(), '.slyxup', 'temp', `feature-${Date.now()}`);
      await extractor.extract(archivePath, tempWorkspace);
      spinner.succeed(chalk.green('✓ Feature extracted'));

      // Step 9: Read and parse feature manifest
      spinner.start('Reading feature manifest...');
      const manifest = await this.loadManifest(tempWorkspace);
      spinner.succeed(chalk.green('✓ Feature manifest loaded'));

      // Step 10: Pre-installation validation
      if (!options.skipValidation) {
        spinner.start('Validating installation...');
        const validationResult = await this.validateInstallation(manifest);
        if (!validationResult.valid) {
          throw new ValidationError(validationResult.message);
        }
        spinner.succeed(chalk.green('✓ Validation passed'));
      }

      // Step 11: Show dry run info if enabled
      if (options.dryRun) {
        spinner.stop();
        await this.showDryRunInfo(manifest, tempWorkspace);
        report.success = true;
        report.duration = Date.now() - startTime;
        return report;
      }

      // Step 12: Apply files
      spinner.start('Creating files...');
      const filesResult = await this.applyFiles(manifest, tempWorkspace, transaction);
      report.filesCreated = filesResult.created;
      report.filesModified = filesResult.modified;
      spinner.succeed(chalk.green(`✓ Created ${filesResult.created.length} file(s)`));

      // Step 13: Apply modifications
      if (manifest.modifications && manifest.modifications.length > 0) {
        spinner.start('Applying modifications...');
        const modResult = await this.applyModifications(manifest);
        report.filesModified.push(...modResult.modified);
        spinner.succeed(chalk.green(`✓ Modified ${modResult.modified.length} file(s)`));
      }

      // Step 14: Update package.json
      spinner.start('Updating dependencies...');
      const depsResult = await this.updateDependencies(manifest, transaction);
      report.dependenciesAdded = depsResult.dependencies;
      report.devDependenciesAdded = depsResult.devDependencies;
      report.scriptsAdded = depsResult.scripts;
      spinner.succeed(chalk.green('✓ Dependencies updated'));

      // Step 15: Update SlyxUp metadata
      if (this.project.isSlyxUp) {
        spinner.start('Updating project metadata...');
        const metadataManager = new MetadataManager(this.project.root);
        await metadataManager.addFeature(options.featureName);
        spinner.succeed(chalk.green('✓ Metadata updated'));
      } else {
        // Initialize SlyxUp metadata for non-SlyxUp projects
        spinner.start('Initializing SlyxUp tracking...');
        await this.initializeSlyxUp();
        const metadataManager = new MetadataManager(this.project.root);
        await metadataManager.addFeature(options.featureName);
        spinner.succeed(chalk.green('✓ SlyxUp tracking initialized'));
      }

      // Step 16: Commit transaction
      await transactionManager.commitTransaction(transactionId);

      // Step 17: Cleanup
      await extractor.cleanup(tempWorkspace);

      // Step 18: Post-installation
      await this.showPostInstallInfo(manifest, options);

      report.success = true;
      report.duration = Date.now() - startTime;

      logger.info('Feature installation completed', {
        featureName: options.featureName,
        framework: this.project.framework,
        duration: report.duration,
      });

      return report;

    } catch (error) {
      spinner.fail(chalk.red('✗ Installation failed'));

      // Rollback transaction
      try {
        await transactionManager.rollbackTransaction(transactionId);
        console.log(chalk.yellow('↩ Changes rolled back'));
      } catch (rollbackError) {
        logger.error('Rollback failed', rollbackError);
        console.log(chalk.red('⚠ Warning: Rollback failed. Manual cleanup may be required.'));
      }

      report.duration = Date.now() - startTime;
      
      if (error instanceof Error) {
        report.errors.push(error.message);
      }

      throw error;
    }
  }

  /**
   * Load and parse feature manifest (supports both legacy and enhanced format)
   */
  private async loadManifest(workspace: string): Promise<EnhancedFeatureManifest> {
    const manifestPath = path.join(workspace, 'feature.json');

    if (!(await pathExists(manifestPath))) {
      throw new InstallationError('Feature manifest not found in archive');
    }

    const rawManifest = await safeReadJSON<Record<string, unknown>>(manifestPath);

    // Try enhanced schema first
    try {
      return EnhancedFeatureManifestSchema.parse(rawManifest);
    } catch {
      // Fall back to legacy schema and convert
      const legacyManifest = FeatureManifestSchema.parse(rawManifest);
      return this.convertLegacyManifest(legacyManifest, rawManifest);
    }
  }

  /**
   * Convert legacy manifest to enhanced format
   */
  private convertLegacyManifest(
    legacy: FeatureManifest,
    raw: Record<string, unknown>
  ): EnhancedFeatureManifest {
    return {
      name: legacy.name,
      version: legacy.version || '1.0.0',
      frameworks: (raw.frameworks as string[]) || ['*'],
      requiresTypescript: false,
      creates: legacy.creates,
      modifies: legacy.modifies,
      dependencies: legacy.dependencies,
      devDependencies: legacy.devDependencies,
      scripts: legacy.scripts,
    };
  }

  /**
   * Validate installation prerequisites
   */
  private async validateInstallation(
    manifest: EnhancedFeatureManifest
  ): Promise<{ valid: boolean; message: string }> {
    // Check required features
    if (manifest.requiresFeatures && this.project) {
      for (const required of manifest.requiresFeatures) {
        if (!this.project.installedFeatures.includes(required)) {
          return {
            valid: false,
            message: `Feature ${manifest.name} requires ${required} to be installed first`,
          };
        }
      }
    }

    // Check conflicts
    if (manifest.conflictsWith && this.project) {
      for (const conflict of manifest.conflictsWith) {
        if (this.project.installedFeatures.includes(conflict)) {
          return {
            valid: false,
            message: `Feature ${manifest.name} conflicts with ${conflict}`,
          };
        }
      }
    }

    // Check TypeScript requirement
    if (manifest.requiresTypescript && this.project && !this.project.hasTypescript) {
      return {
        valid: false,
        message: `Feature ${manifest.name} requires TypeScript`,
      };
    }

    // Run custom validation
    if (manifest.validation?.preInstall && this.project) {
      for (const check of manifest.validation.preInstall) {
        const passed = await this.runValidationCheck(check);
        if (!passed) {
          return {
            valid: false,
            message: check.message || `Validation failed: ${check.type}`,
          };
        }
      }
    }

    return { valid: true, message: '' };
  }

  /**
   * Run a validation check
   */
  private async runValidationCheck(
    check: { type: string; target: string; message?: string }
  ): Promise<boolean> {
    if (!this.project) return false;

    switch (check.type) {
      case 'file-exists':
        return pathExists(path.join(this.project.root, check.target));
      case 'file-not-exists':
        return !(await pathExists(path.join(this.project.root, check.target)));
      case 'dependency':
        return (check.target in this.project.dependencies) || (check.target in this.project.devDependencies);
      case 'no-dependency':
        return !(check.target in this.project.dependencies) && !(check.target in this.project.devDependencies);
      default:
        return true;
    }
  }

  /**
   * Show dry run information
   */
  private async showDryRunInfo(
    manifest: EnhancedFeatureManifest,
    _workspace: string
  ): Promise<void> {
    console.log();
    console.log(chalk.bold.cyan('📋 Dry Run - Installation Plan'));
    console.log();

    if (manifest.creates && manifest.creates.length > 0) {
      console.log(chalk.bold('Files to create:'));
      for (const file of manifest.creates) {
        const targetPath = this.adapter?.transformFilePath(file, manifest.name) || file;
        console.log(chalk.green(`  + ${targetPath}`));
      }
      console.log();
    }

    if (manifest.modifies && manifest.modifies.length > 0) {
      console.log(chalk.bold('Files to modify:'));
      for (const file of manifest.modifies) {
        console.log(chalk.yellow(`  ~ ${file}`));
      }
      console.log();
    }

    if (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) {
      console.log(chalk.bold('Dependencies to add:'));
      for (const [name, version] of Object.entries(manifest.dependencies)) {
        console.log(chalk.cyan(`  ${name}: ${version}`));
      }
      console.log();
    }

    if (manifest.devDependencies && Object.keys(manifest.devDependencies).length > 0) {
      console.log(chalk.bold('Dev dependencies to add:'));
      for (const [name, version] of Object.entries(manifest.devDependencies)) {
        console.log(chalk.cyan(`  ${name}: ${version}`));
      }
      console.log();
    }

    if (manifest.scripts && Object.keys(manifest.scripts).length > 0) {
      console.log(chalk.bold('Scripts to add:'));
      for (const [name, command] of Object.entries(manifest.scripts)) {
        console.log(chalk.magenta(`  "${name}": "${command}"`));
      }
      console.log();
    }

    console.log(chalk.green('✓ This was a preview. No files were modified.'));
    console.log(chalk.gray('  Run without --dry-run to actually install the feature.'));
  }

  /**
   * Apply files from the feature archive
   */
  private async applyFiles(
    manifest: EnhancedFeatureManifest,
    workspace: string,
    transaction: Transaction
  ): Promise<{ created: string[]; modified: string[] }> {
    const created: string[] = [];
    const modified: string[] = [];

    if (!this.project || !this.adapter) return { created, modified };

    // Framework-specific file configuration can be used for conditional file processing
    // const frameworkConfig = manifest.frameworkConfigs?.[this.project.framework];

    // Process files from manifest.creates (legacy)
    if (manifest.creates) {
      for (const file of manifest.creates) {
        const sourcePath = path.join(workspace, 'files', file);
        const targetFile = this.adapter.transformFilePath(file, manifest.name);
        const targetPath = path.join(this.project.root, targetFile);

        // Skip if in skip list
        const skipFiles = this.adapter.getSkipFiles(manifest.name);
        if (skipFiles.includes(file)) {
          continue;
        }

        if (!(await pathExists(sourcePath))) {
          logger.warn('Source file not found', { file });
          continue;
        }

        if (await pathExists(targetPath)) {
          logger.warn('Target file already exists, skipping', { file: targetFile });
          continue;
        }

        await ensureDir(path.dirname(targetPath));
        await fs.copyFile(sourcePath, targetPath);
        transaction.recordCreate(targetPath);
        created.push(targetFile);

        logger.info('File created', { file: targetFile });
      }
    }

    // Process files from enhanced format
    if (manifest.files) {
      for (const fileOp of manifest.files) {
        if (fileOp.condition && !this.evaluateCondition(fileOp.condition)) {
          continue;
        }

        const sourcePath = path.join(workspace, fileOp.source);
        const targetFile = this.adapter.transformFilePath(fileOp.destination, manifest.name);
        const targetPath = path.join(this.project.root, targetFile);

        if (!(await pathExists(sourcePath))) {
          logger.warn('Source file not found', { file: fileOp.source });
          continue;
        }

        const targetExists = await pathExists(targetPath);
        if (targetExists && !fileOp.overwrite) {
          logger.warn('Target file exists, skipping', { file: targetFile });
          continue;
        }

        await ensureDir(path.dirname(targetPath));
        
        if (targetExists) {
          await transaction.backupFile(targetPath);
          modified.push(targetFile);
        } else {
          created.push(targetFile);
        }

        await fs.copyFile(sourcePath, targetPath);
        transaction.recordCreate(targetPath);

        logger.info('File applied', { file: targetFile, action: fileOp.action });
      }
    }

    // Process framework-specific additional files
    const additionalFiles = this.adapter.getAdditionalFiles(manifest.name);
    for (const { source, target } of additionalFiles) {
      const sourcePath = path.join(workspace, source);
      const targetPath = path.join(this.project.root, target);

      if (!(await pathExists(sourcePath))) {
        continue;
      }

      if (!(await pathExists(targetPath))) {
        await ensureDir(path.dirname(targetPath));
        await fs.copyFile(sourcePath, targetPath);
        transaction.recordCreate(targetPath);
        created.push(target);
      }
    }

    return { created, modified };
  }

  /**
   * Apply content modifications
   */
  private async applyModifications(
    manifest: EnhancedFeatureManifest
  ): Promise<{ modified: string[] }> {
    const modified: string[] = [];

    if (!this.project || !this.modifier) return { modified };

    // Get framework-specific modifications
    const frameworkMods = this.adapter?.getFeatureModifications(manifest.name) || [];
    
    // Combine manifest modifications with framework-specific ones
    const allModifications: ContentModification[] = [
      ...(manifest.modifications || []),
      ...frameworkMods,
    ];

    for (const mod of allModifications) {
      // Transform file path based on framework
      const transformedMod = {
        ...mod,
        file: this.adapter?.transformFilePath(mod.file, manifest.name) || mod.file,
      };

      const result = await this.modifier.applyModification(transformedMod);
      
      if (result.success && result.message.includes('Successfully')) {
        modified.push(transformedMod.file);
      }

      logger.info('Modification applied', {
        file: transformedMod.file,
        action: mod.action,
        success: result.success,
      });
    }

    return { modified };
  }

  /**
   * Update package.json with dependencies and scripts
   */
  private async updateDependencies(
    manifest: EnhancedFeatureManifest,
    transaction: Transaction
  ): Promise<{
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    scripts: Record<string, string>;
  }> {
    const added = {
      dependencies: {} as Record<string, string>,
      devDependencies: {} as Record<string, string>,
      scripts: {} as Record<string, string>,
    };

    if (!this.project) return added;

    const packageJsonPath = path.join(this.project.root, 'package.json');
    
    if (!(await pathExists(packageJsonPath))) {
      logger.warn('package.json not found');
      return added;
    }

    await transaction.backupFile(packageJsonPath);

    const pkg = await safeReadJSON<Record<string, unknown>>(packageJsonPath);

    // Get framework-specific additional dependencies
    const { deps: extraDeps, devDeps: extraDevDeps } = 
      this.adapter?.getAdditionalDependencies(manifest.name) || { deps: {}, devDeps: {} };

    // Merge all dependencies
    const allDeps = { ...manifest.dependencies, ...extraDeps };
    const allDevDeps = { ...manifest.devDependencies, ...extraDevDeps };

    // Add dependencies
    if (Object.keys(allDeps).length > 0) {
      const existingDeps = (pkg.dependencies as Record<string, string>) || {};
      const merged = mergeDependencies(existingDeps, allDeps);
      
      for (const [name, version] of Object.entries(allDeps)) {
        if (!existingDeps[name]) {
          added.dependencies[name] = version;
        }
      }
      
      pkg.dependencies = merged;
    }

    // Add devDependencies
    if (Object.keys(allDevDeps).length > 0) {
      const existingDevDeps = (pkg.devDependencies as Record<string, string>) || {};
      const merged = mergeDependencies(existingDevDeps, allDevDeps);
      
      for (const [name, version] of Object.entries(allDevDeps)) {
        if (!existingDevDeps[name]) {
          added.devDependencies[name] = version;
        }
      }
      
      pkg.devDependencies = merged;
    }

    // Add scripts
    if (manifest.scripts && Object.keys(manifest.scripts).length > 0) {
      const existingScripts = (pkg.scripts as Record<string, string>) || {};
      const merged = mergeScripts(existingScripts, manifest.scripts);
      
      for (const [name, command] of Object.entries(manifest.scripts)) {
        if (!existingScripts[name]) {
          added.scripts[name] = command;
        }
      }
      
      pkg.scripts = merged;
    }

    await safeWriteJSON(packageJsonPath, pkg);
    transaction.recordModify(packageJsonPath);

    return added;
  }

  /**
   * Initialize SlyxUp metadata for non-SlyxUp projects
   */
  private async initializeSlyxUp(): Promise<void> {
    if (!this.project) return;

    const metadataDir = path.join(this.project.root, '.slyxup');
    const metadataFile = path.join(metadataDir, 'project.json');

    await fs.mkdir(metadataDir, { recursive: true });

    const metadata = {
      framework: this.project.framework,
      features: this.project.installedFeatures,
      templateVersion: 'external',
      cliVersion: '2.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      packageManager: this.project.packageManager,
      initialized: 'auto-detected',
    };

    await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    
    // Update project state
    this.project.isSlyxUp = true;
  }

  /**
   * Show post-installation information
   */
  private async showPostInstallInfo(
    manifest: EnhancedFeatureManifest,
    options: AdvancedInstallOptions
  ): Promise<void> {
    console.log();
    console.log(chalk.bold.green(`✓ Feature '${manifest.name}' installed successfully!`));
    console.log();

    // Show post-install message
    if (manifest.postInstall?.message) {
      console.log(chalk.cyan(manifest.postInstall.message));
      console.log();
    }

    // Show instructions
    if (manifest.postInstall?.instructions) {
      console.log(chalk.bold('Next steps:'));
      for (const instruction of manifest.postInstall.instructions) {
        console.log(chalk.gray(`  ${instruction}`));
      }
      console.log();
    }

    // Show environment variables if any
    if (manifest.envVariables && manifest.envVariables.length > 0) {
      console.log(chalk.bold('Environment variables:'));
      for (const env of manifest.envVariables) {
        const required = env.required ? chalk.red('*') : '';
        console.log(chalk.yellow(`  ${env.name}${required}`));
        if (env.description) {
          console.log(chalk.gray(`    ${env.description}`));
        }
        if (env.example) {
          console.log(chalk.gray(`    Example: ${env.example}`));
        }
      }
      console.log();
    }

    // Show npm install hint if dependencies were added
    if (!options.skipNpmInstall) {
      const hasDeps = (manifest.dependencies && Object.keys(manifest.dependencies).length > 0) ||
                      (manifest.devDependencies && Object.keys(manifest.devDependencies).length > 0);
      
      if (hasDeps && this.project) {
        console.log(chalk.cyan('Install dependencies:'));
        console.log(chalk.gray(`  ${this.project.packageManager} install`));
        console.log();
      }
    }
  }

  /**
   * Evaluate a condition expression
   */
  private evaluateCondition(condition: string): boolean {
    if (!this.project) return false;

    try {
      if (condition.includes('framework')) {
        const match = condition.match(/framework\s*===?\s*['"]([^'"]+)['"]/);
        if (match) {
          return this.project.framework === match[1];
        }
      }

      if (condition === 'hasTypescript') {
        return this.project.hasTypescript;
      }

      return true;
    } catch {
      return true;
    }
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createAdvancedFeatureInstaller(): AdvancedFeatureInstaller {
  return new AdvancedFeatureInstaller();
}

// ============================================================================
// Default export for backward compatibility
// ============================================================================

export const advancedFeatureInstaller = new AdvancedFeatureInstaller();
