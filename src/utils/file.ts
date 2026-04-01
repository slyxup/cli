import fs from 'fs/promises';
import path from 'path';
import { FileSystemError } from '../types/errors.js';
import { logger } from './logger.js';

export class BackupManager {
  private backups = new Map<string, string>();

  async backup(filePath: string): Promise<string> {
    try {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await fs.copyFile(filePath, backupPath);
      this.backups.set(filePath, backupPath);

      logger.info('File backed up', { original: filePath, backup: backupPath });
      return backupPath;
    } catch (error) {
      throw new FileSystemError(`Failed to backup file: ${filePath}`, error);
    }
  }

  async restore(filePath: string): Promise<void> {
    const backupPath = this.backups.get(filePath);

    if (!backupPath) {
      throw new FileSystemError(`No backup found for: ${filePath}`);
    }

    try {
      await fs.copyFile(backupPath, filePath);
      logger.info('File restored from backup', { filePath, backupPath });
    } catch (error) {
      throw new FileSystemError(`Failed to restore file: ${filePath}`, error);
    }
  }

  async restoreAll(): Promise<void> {
    const errors: Error[] = [];

    for (const [original, backup] of this.backups.entries()) {
      try {
        await fs.copyFile(backup, original);
        logger.info('File restored', { original, backup });
      } catch (error) {
        errors.push(new FileSystemError(`Failed to restore ${original}`, error));
      }
    }

    if (errors.length > 0) {
      throw new FileSystemError('Failed to restore some files', errors);
    }
  }

  async cleanup(): Promise<void> {
    for (const backupPath of this.backups.values()) {
      try {
        await fs.unlink(backupPath);
        logger.debug('Backup file removed', { backupPath });
      } catch (error) {
        logger.warn('Failed to remove backup file', { backupPath, error });
      }
    }

    this.backups.clear();
  }

  getBackups(): Map<string, string> {
    return new Map(this.backups);
  }
}

export async function safeReadJSON<T>(filePath: string): Promise<T> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    throw new FileSystemError(`Failed to read JSON file: ${filePath}`, error);
  }
}

export async function safeWriteJSON(filePath: string, data: unknown): Promise<void> {
  try {
    const content = JSON.stringify(data, null, 2);
    await fs.writeFile(filePath, content, 'utf-8');
    logger.info('JSON file written', { filePath });
  } catch (error) {
    throw new FileSystemError(`Failed to write JSON file: ${filePath}`, error);
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new FileSystemError(`Failed to create directory: ${dirPath}`, error);
  }
}

export async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function isPathSafe(basePath: string, targetPath: string): Promise<boolean> {
  const resolvedBase = path.resolve(basePath);
  const resolvedTarget = path.resolve(basePath, targetPath);

  return resolvedTarget.startsWith(resolvedBase);
}

export async function removeDir(dirPath: string): Promise<void> {
  try {
    await fs.rm(dirPath, { recursive: true, force: true });
    logger.info('Directory removed', { dirPath });
  } catch (error) {
    throw new FileSystemError(`Failed to remove directory: ${dirPath}`, error);
  }
}
