import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { MetadataManager } from '../core/metadata';
import { ValidationError } from '../types/errors';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

describe('MetadataManager', () => {
  let testDir: string;
  let metadataManager: MetadataManager;

  beforeEach(async () => {
    // Create a temporary test directory
    testDir = path.join(os.tmpdir(), `slyxup-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
    metadataManager = new MetadataManager(testDir);
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('initialize', () => {
    it('should create metadata file with correct structure', async () => {
      await metadataManager.initialize('react', '1.0.0');

      const metadata = await metadataManager.load();

      expect(metadata).toMatchObject({
        framework: 'react',
        features: [],
        templateVersion: '1.0.0',
        cliVersion: '1.0.0',
      });

      expect(metadata.createdAt).toBeDefined();
      expect(metadata.updatedAt).toBeDefined();
    });

    it('should throw error if metadata already exists', async () => {
      await metadataManager.initialize('react', '1.0.0');

      await expect(
        metadataManager.initialize('react', '1.0.0')
      ).rejects.toThrow(ValidationError);
    });

    it('should create .slyxup directory', async () => {
      await metadataManager.initialize('react', '1.0.0');

      const metadataDir = path.join(testDir, '.slyxup');
      const stats = await fs.stat(metadataDir);

      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('load', () => {
    it('should load existing metadata', async () => {
      await metadataManager.initialize('vue', '2.0.0');

      const metadata = await metadataManager.load();

      expect(metadata.framework).toBe('vue');
      expect(metadata.templateVersion).toBe('2.0.0');
    });

    it('should throw error if metadata does not exist', async () => {
      await expect(metadataManager.load()).rejects.toThrow(ValidationError);
    });
  });

  describe('addFeature', () => {
    beforeEach(async () => {
      await metadataManager.initialize('react', '1.0.0');
    });

    it('should add feature to metadata', async () => {
      await metadataManager.addFeature('tailwind');

      const metadata = await metadataManager.load();

      expect(metadata.features).toContain('tailwind');
    });

    it('should add multiple features', async () => {
      await metadataManager.addFeature('tailwind');
      await metadataManager.addFeature('shadcn');

      const metadata = await metadataManager.load();

      expect(metadata.features).toEqual(['tailwind', 'shadcn']);
    });

    it('should throw error when adding duplicate feature', async () => {
      await metadataManager.addFeature('tailwind');

      await expect(
        metadataManager.addFeature('tailwind')
      ).rejects.toThrow('Feature already installed: tailwind');
    });

    it('should update timestamp when adding feature', async () => {
      const initialMetadata = await metadataManager.load();
      const initialTimestamp = initialMetadata.updatedAt;

      // Wait a bit to ensure timestamp changes
      await new Promise(resolve => setTimeout(resolve, 10));

      await metadataManager.addFeature('tailwind');

      const updatedMetadata = await metadataManager.load();

      expect(updatedMetadata.updatedAt).not.toBe(initialTimestamp);
    });
  });

  describe('hasFeature', () => {
    beforeEach(async () => {
      await metadataManager.initialize('react', '1.0.0');
    });

    it('should return true for installed feature', async () => {
      await metadataManager.addFeature('tailwind');

      const hasFeature = await metadataManager.hasFeature('tailwind');

      expect(hasFeature).toBe(true);
    });

    it('should return false for non-installed feature', async () => {
      const hasFeature = await metadataManager.hasFeature('shadcn');

      expect(hasFeature).toBe(false);
    });
  });

  describe('removeFeature', () => {
    beforeEach(async () => {
      await metadataManager.initialize('react', '1.0.0');
      await metadataManager.addFeature('tailwind');
    });

    it('should remove feature from metadata', async () => {
      await metadataManager.removeFeature('tailwind');

      const metadata = await metadataManager.load();

      expect(metadata.features).not.toContain('tailwind');
    });

    it('should throw error when removing non-existent feature', async () => {
      await expect(
        metadataManager.removeFeature('shadcn')
      ).rejects.toThrow('Feature not found: shadcn');
    });
  });
});
