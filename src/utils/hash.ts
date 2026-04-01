import crypto from 'crypto';
import { createReadStream } from 'fs';
import { IntegrityError } from '../types/errors.js';
import { logger } from './logger.js';

export async function generateSHA256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

export async function verifySHA256(filePath: string, expectedHash: string): Promise<boolean> {
  try {
    const actualHash = await generateSHA256(filePath);
    const isValid = actualHash === expectedHash;

    if (!isValid) {
      logger.error('Integrity verification failed', {
        filePath,
        expected: expectedHash,
        actual: actualHash,
      });
      throw new IntegrityError(
        `File integrity check failed for ${filePath}. Expected ${expectedHash}, got ${actualHash}`
      );
    }

    logger.info('Integrity verification successful', { filePath });
    return true;
  } catch (error) {
    if (error instanceof IntegrityError) {
      throw error;
    }
    throw new IntegrityError('Failed to verify file integrity', error);
  }
}

export async function verifyBufferSHA256(buffer: Buffer, expectedHash: string): Promise<boolean> {
  const hash = crypto.createHash('sha256');
  hash.update(buffer);
  const actualHash = hash.digest('hex');

  if (actualHash !== expectedHash) {
    throw new IntegrityError(
      `Buffer integrity check failed. Expected ${expectedHash}, got ${actualHash}`
    );
  }

  return true;
}
