import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { FileSystemError } from '../types/errors.js';

export enum LogLevel {
  DEBUG = 'DEBUG',
  INFO = 'INFO',
  WARN = 'WARN',
  ERROR = 'ERROR',
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  data?: unknown;
}

class Logger {
  private logDir: string;
  private logFile: string;
  private initialized = false;

  constructor() {
    this.logDir = path.join(os.homedir(), '.slyxup', 'logs');
    this.logFile = path.join(
      this.logDir,
      `slyxup-${new Date().toISOString().split('T')[0]}.log`
    );
  }

  private async ensureLogDir(): Promise<void> {
    if (this.initialized) return;

    try {
      await fs.mkdir(this.logDir, { recursive: true });
      this.initialized = true;
    } catch (error) {
      throw new FileSystemError('Failed to create log directory', error);
    }
  }

  private async writeLog(entry: LogEntry): Promise<void> {
    await this.ensureLogDir();

    const logLine = `${entry.timestamp} [${entry.level}] ${entry.message}${
      entry.data ? ` ${JSON.stringify(entry.data)}` : ''
    }\n`;

    try {
      await fs.appendFile(this.logFile, logLine);
    } catch (error) {
      // Silent fail for logging errors to prevent cascading failures
      console.error('Failed to write log:', error);
    }
  }

  private createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      data,
    };
  }

  debug(message: string, data?: unknown): void {
    const entry = this.createLogEntry(LogLevel.DEBUG, message, data);
    this.writeLog(entry).catch(() => {});
  }

  info(message: string, data?: unknown): void {
    const entry = this.createLogEntry(LogLevel.INFO, message, data);
    this.writeLog(entry).catch(() => {});
  }

  warn(message: string, data?: unknown): void {
    const entry = this.createLogEntry(LogLevel.WARN, message, data);
    this.writeLog(entry).catch(() => {});
  }

  error(message: string, data?: unknown): void {
    const entry = this.createLogEntry(LogLevel.ERROR, message, data);
    this.writeLog(entry).catch(() => {});
  }

  async cleanup(daysToKeep = 7): Promise<void> {
    await this.ensureLogDir();

    try {
      const files = await fs.readdir(this.logDir);
      const now = Date.now();
      const maxAge = daysToKeep * 24 * 60 * 60 * 1000;

      for (const file of files) {
        const filePath = path.join(this.logDir, file);
        const stats = await fs.stat(filePath);

        if (now - stats.mtimeMs > maxAge) {
          await fs.unlink(filePath);
          this.info(`Cleaned up old log file: ${file}`);
        }
      }
    } catch (error) {
      this.warn('Failed to cleanup old logs', error);
    }
  }
}

export const logger = new Logger();
