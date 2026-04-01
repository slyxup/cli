import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { FileSystemError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { verifySHA256 } from '../utils/hash.js';
import { ensureDir, pathExists } from '../utils/file.js';

const CACHE_DIR = path.join(os.homedir(), '.slyxup', 'cache');
const DOWNLOAD_DIR = path.join(CACHE_DIR, 'downloads');

export interface DownloadOptions {
  url: string;
  sha256: string;
  filename?: string;
  useCache?: boolean;
  verbose?: boolean;
  onCacheHit?: () => void;
  onCacheMiss?: () => void;
}

export class Downloader {
  private downloadDir: string;

  constructor() {
    this.downloadDir = DOWNLOAD_DIR;
  }

  async download(options: DownloadOptions): Promise<string> {
    const { url, sha256, filename, useCache = true, verbose, onCacheHit, onCacheMiss } = options;

    await ensureDir(this.downloadDir);

    // Check if this is a local file path (for testing)
    const isLocalFile = url.startsWith('file://') || url.startsWith('/');
    
    if (isLocalFile) {
      return this.handleLocalFile(url, sha256, verbose);
    }

    const targetFilename = filename || this.getFilenameFromUrl(url);
    const targetPath = path.join(this.downloadDir, targetFilename);

    // Check cache
    if (useCache && (await this.isCacheValid(targetPath, sha256))) {
      logger.info('Using cached file', { path: targetPath });
      if (verbose) {
        console.log(chalk.gray(`  Using cached ${targetFilename}`));
      }
      onCacheHit?.();
      return targetPath;
    }

    // Download file
    if (verbose) {
      console.log(chalk.gray(`  Downloading ${targetFilename}...`));
    }
    onCacheMiss?.();
    logger.info('Downloading file', { url, target: targetPath });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minutes

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'SlyxUp-CLI/1.0.0',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new FileSystemError(
          `Failed to download file: ${response.status} ${response.statusText}`
        );
      }

      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(targetPath, buffer);

      logger.info('File downloaded', { size: buffer.length, path: targetPath });

      // Verify integrity
      await verifySHA256(targetPath, sha256);

      return targetPath;
    } catch (error) {
      // Clean up partial download
      if (await pathExists(targetPath)) {
        await fs.unlink(targetPath).catch(() => {});
      }

      throw new FileSystemError('Failed to download file', error);
    }
  }

  /**
   * Handle local file paths for testing
   */
  private async handleLocalFile(url: string, sha256: string, verbose?: boolean): Promise<string> {
    const localPath = url.startsWith('file://') ? url.replace('file://', '') : url;
    
    if (verbose) {
      console.log(chalk.gray(`  Using local file: ${localPath}`));
    }
    
    // Verify the local file exists
    if (!(await pathExists(localPath))) {
      throw new FileSystemError(`Local file not found: ${localPath}`);
    }
    
    // Verify integrity
    await verifySHA256(localPath, sha256);
    
    logger.info('Using local file', { path: localPath });
    return localPath;
  }

  private async isCacheValid(filePath: string, expectedHash: string): Promise<boolean> {
    try {
      if (!(await pathExists(filePath))) {
        return false;
      }

      await verifySHA256(filePath, expectedHash);
      return true;
    } catch {
      return false;
    }
  }

  private getFilenameFromUrl(url: string): string {
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;
    const filename = pathname.split('/').pop() || 'download';
    return filename;
  }

  async clearCache(): Promise<void> {
    try {
      if (await pathExists(this.downloadDir)) {
        await fs.rm(this.downloadDir, { recursive: true, force: true });
        logger.info('Download cache cleared');
      }
    } catch (error) {
      logger.warn('Failed to clear download cache', error);
    }
  }

  async getCacheSize(): Promise<number> {
    try {
      if (!(await pathExists(this.downloadDir))) {
        return 0;
      }

      const files = await fs.readdir(this.downloadDir);
      let totalSize = 0;

      for (const file of files) {
        const filePath = path.join(this.downloadDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (error) {
      logger.warn('Failed to calculate cache size', error);
      return 0;
    }
  }
}

export const downloader = new Downloader();
