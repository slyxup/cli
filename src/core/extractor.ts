import { extract } from 'tar';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileSystemError, ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { ensureDir, pathExists } from '../utils/file.js';

const TEMP_DIR = path.join(os.homedir(), '.slyxup', 'temp');

// Dangerous patterns that should be blocked
const DANGEROUS_PATTERNS = [
  /\.\./,           // Path traversal
  /^\//, // Absolute paths
  /^~/, // Home directory
  /\0/,             // Null bytes
  /[<>:"|?*]/,      // Invalid filename characters (Windows)
];

export class SecureExtractor {
  private tempDir: string;

  constructor() {
    this.tempDir = TEMP_DIR;
  }

  async extract(archivePath: string, targetDir: string): Promise<string> {
    await ensureDir(this.tempDir);

    // Create a unique temporary extraction directory
    const extractId = `extract-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const extractDir = path.join(this.tempDir, extractId);

    try {
      await ensureDir(extractDir);

      logger.info('Extracting archive', { archive: archivePath, target: extractDir });

      // Extract to temp directory first for validation
      await this.extractArchive(archivePath, extractDir);

      // Validate extracted files
      await this.validateExtractedFiles(extractDir);

      // Move to target directory
      await this.moveToTarget(extractDir, targetDir);

      logger.info('Extraction completed successfully', { targetDir });

      return targetDir;
    } catch (error) {
      // Clean up temp directory on error
      await this.cleanup(extractDir);
      throw error;
    }
  }

  private async extractArchive(archivePath: string, extractDir: string): Promise<void> {
    try {
    await extract({
        file: archivePath,
        cwd: extractDir,
        strict: true,
        onentry: (entry) => {
          // Validate each entry before extraction
          this.validateEntry(entry.path, extractDir);
        },
      });

      logger.debug('Archive extracted to temp directory', { extractDir });
    } catch (error) {
      throw new FileSystemError('Failed to extract archive', error);
    }
  }

  private validateEntry(entryPath: string, baseDir: string): void {
    // Check for dangerous patterns
    for (const pattern of DANGEROUS_PATTERNS) {
      if (pattern.test(entryPath)) {
        throw new ValidationError(`Dangerous path detected: ${entryPath}`);
      }
    }

    // Check for path traversal
    const resolvedPath = path.resolve(baseDir, entryPath);
    if (!resolvedPath.startsWith(baseDir)) {
      throw new ValidationError(`Path traversal attempt detected: ${entryPath}`);
    }

    // Check filename length (prevent filesystem issues)
    const filename = path.basename(entryPath);
    if (filename.length > 255) {
      throw new ValidationError(`Filename too long: ${filename}`);
    }

    logger.debug('Entry validated', { entryPath });
  }

  private async validateExtractedFiles(extractDir: string): Promise<void> {
    const files = await this.getAllFiles(extractDir);

    for (const file of files) {
      const relativePath = path.relative(extractDir, file);

      // Re-validate all paths
      this.validateEntry(relativePath, extractDir);

      // Check file size (prevent zip bombs)
      const stats = await fs.stat(file);
      if (stats.size > 100 * 1024 * 1024) {
        // 100MB limit per file
        throw new ValidationError(`File too large: ${relativePath} (${stats.size} bytes)`);
      }
    }

    logger.debug('All extracted files validated', { count: files.length });
  }

  private async getAllFiles(dir: string): Promise<string[]> {
    const files: string[] = [];
    const entries = await fs.readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subFiles = await this.getAllFiles(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private async moveToTarget(sourceDir: string, targetDir: string): Promise<void> {
    try {
      await ensureDir(targetDir);

      const entries = await fs.readdir(sourceDir, { withFileTypes: true });

      for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const targetPath = path.join(targetDir, entry.name);

        if (entry.isDirectory()) {
          await this.moveToTarget(sourcePath, targetPath);
        } else {
          // Check if target already exists
          if (await pathExists(targetPath)) {
            logger.warn('File already exists, skipping', { path: targetPath });
            continue;
          }

          await fs.copyFile(sourcePath, targetPath);
          logger.debug('File moved', { from: sourcePath, to: targetPath });
        }
      }
    } catch (error) {
      throw new FileSystemError('Failed to move files to target directory', error);
    }
  }

  async cleanup(extractDir?: string): Promise<void> {
    const dirToClean = extractDir || this.tempDir;

    try {
      if (await pathExists(dirToClean)) {
        await fs.rm(dirToClean, { recursive: true, force: true });
        logger.debug('Temp directory cleaned', { dir: dirToClean });
      }
    } catch (error) {
      logger.warn('Failed to cleanup temp directory', { dir: dirToClean, error });
    }
  }

  async cleanupAll(): Promise<void> {
    try {
      if (await pathExists(this.tempDir)) {
        const entries = await fs.readdir(this.tempDir);

        for (const entry of entries) {
          const entryPath = path.join(this.tempDir, entry);
          await fs.rm(entryPath, { recursive: true, force: true });
        }

        logger.info('All temp directories cleaned');
      }
    } catch (error) {
      logger.warn('Failed to cleanup all temp directories', error);
    }
  }
}

export const extractor = new SecureExtractor();
