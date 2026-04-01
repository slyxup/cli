import fs from 'fs/promises';
import { BackupManager } from '../utils/file.js';
import { RollbackError, FileSystemError } from '../types/errors.js';
import { logger } from '../utils/logger.js';

export interface TransactionStep {
  type: 'create' | 'modify' | 'delete';
  path: string;
  data?: unknown;
}

export class Transaction {
  private steps: TransactionStep[] = [];
  private backupManager: BackupManager;
  private createdFiles: string[] = [];
  private createdDirs: string[] = [];
  private committed = false;

  constructor() {
    this.backupManager = new BackupManager();
  }

  recordCreate(filePath: string): void {
    this.steps.push({ type: 'create', path: filePath });
    this.createdFiles.push(filePath);
    logger.debug('Transaction: record create', { filePath });
  }

  recordModify(filePath: string, originalData?: unknown): void {
    this.steps.push({ type: 'modify', path: filePath, data: originalData });
    logger.debug('Transaction: record modify', { filePath });
  }

  recordDelete(filePath: string): void {
    this.steps.push({ type: 'delete', path: filePath });
    logger.debug('Transaction: record delete', { filePath });
  }

  recordCreateDir(dirPath: string): void {
    this.createdDirs.push(dirPath);
    logger.debug('Transaction: record create directory', { dirPath });
  }

  async backupFile(filePath: string): Promise<void> {
    try {
      await this.backupManager.backup(filePath);
      logger.debug('Transaction: file backed up', { filePath });
    } catch (error) {
      throw new FileSystemError(`Failed to backup file: ${filePath}`, error);
    }
  }

  async commit(): Promise<void> {
    this.committed = true;
    await this.backupManager.cleanup();
    logger.info('Transaction committed successfully');
  }

  async rollback(): Promise<void> {
    if (this.committed) {
      throw new RollbackError('Cannot rollback committed transaction');
    }

    logger.warn('Rolling back transaction', { steps: this.steps.length });

    const errors: Error[] = [];

    // Restore backed up files
    try {
      await this.backupManager.restoreAll();
    } catch (error) {
      errors.push(new RollbackError('Failed to restore backups', error));
    }

    // Remove created files
    for (const filePath of this.createdFiles) {
      try {
        await fs.unlink(filePath);
        logger.debug('Transaction rollback: file removed', { filePath });
      } catch (error) {
        errors.push(new RollbackError(`Failed to remove file: ${filePath}`, error));
      }
    }

    // Remove created directories (in reverse order)
    for (const dirPath of this.createdDirs.reverse()) {
      try {
        await fs.rmdir(dirPath);
        logger.debug('Transaction rollback: directory removed', { dirPath });
      } catch (error) {
        // Ignore errors for non-empty directories
        logger.debug('Transaction rollback: could not remove directory', { dirPath, error });
      }
    }

    // Clean up backups
    await this.backupManager.cleanup();

    if (errors.length > 0) {
      throw new RollbackError('Rollback completed with errors', errors);
    }

    logger.info('Transaction rolled back successfully');
  }

  getSteps(): TransactionStep[] {
    return [...this.steps];
  }

  isCommitted(): boolean {
    return this.committed;
  }
}

export class TransactionManager {
  private activeTransactions = new Map<string, Transaction>();

  createTransaction(id: string): Transaction {
    if (this.activeTransactions.has(id)) {
      throw new RollbackError(`Transaction already exists: ${id}`);
    }

    const transaction = new Transaction();
    this.activeTransactions.set(id, transaction);

    logger.info('Transaction created', { id });
    return transaction;
  }

  getTransaction(id: string): Transaction | undefined {
    return this.activeTransactions.get(id);
  }

  async commitTransaction(id: string): Promise<void> {
    const transaction = this.activeTransactions.get(id);

    if (!transaction) {
      throw new RollbackError(`Transaction not found: ${id}`);
    }

    await transaction.commit();
    this.activeTransactions.delete(id);

    logger.info('Transaction committed and removed', { id });
  }

  async rollbackTransaction(id: string): Promise<void> {
    const transaction = this.activeTransactions.get(id);

    if (!transaction) {
      throw new RollbackError(`Transaction not found: ${id}`);
    }

    await transaction.rollback();
    this.activeTransactions.delete(id);

    logger.info('Transaction rolled back and removed', { id });
  }

  async rollbackAll(): Promise<void> {
    const errors: Error[] = [];

    for (const [id, transaction] of this.activeTransactions.entries()) {
      try {
        await transaction.rollback();
        logger.info('Transaction rolled back', { id });
      } catch (error) {
        errors.push(new RollbackError(`Failed to rollback transaction: ${id}`, error));
      }
    }

    this.activeTransactions.clear();

    if (errors.length > 0) {
      throw new RollbackError('Failed to rollback all transactions', errors);
    }
  }

  getActiveTransactionIds(): string[] {
    return Array.from(this.activeTransactions.keys());
  }
}

export const transactionManager = new TransactionManager();
