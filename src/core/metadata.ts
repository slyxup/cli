import path from 'path';
import { ProjectMetadata, ProjectMetadataSchema } from '../types/schemas.js';
import { ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { ensureDir, pathExists, safeReadJSON, safeWriteJSON } from '../utils/file.js';

const METADATA_DIR = '.slyxup';
const METADATA_FILE = 'project.json';

export class MetadataManager {
  private projectRoot: string;
  private metadataDir: string;
  private metadataFile: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
    this.metadataDir = path.join(projectRoot, METADATA_DIR);
    this.metadataFile = path.join(this.metadataDir, METADATA_FILE);
  }

  async initialize(framework: string, templateVersion: string): Promise<void> {
    if (await this.exists()) {
      throw new ValidationError('Project metadata already exists');
    }

    await ensureDir(this.metadataDir);

    const metadata: ProjectMetadata = {
      framework,
      features: [],
      templateVersion,
      cliVersion: '1.0.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await safeWriteJSON(this.metadataFile, metadata);
    logger.info('Project metadata initialized', { framework, templateVersion });
  }

  async load(): Promise<ProjectMetadata> {
    if (!(await this.exists())) {
      throw new ValidationError(
        'Project metadata not found. This directory is not a SlyxUp project.'
      );
    }

    try {
      const data = await safeReadJSON<ProjectMetadata>(this.metadataFile);
      const metadata = ProjectMetadataSchema.parse(data);

      logger.debug('Project metadata loaded', metadata);
      return metadata;
    } catch (error) {
      throw new ValidationError('Invalid project metadata', error);
    }
  }

  async update(updates: Partial<ProjectMetadata>): Promise<void> {
    const metadata = await this.load();

    const updatedMetadata: ProjectMetadata = {
      ...metadata,
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await safeWriteJSON(this.metadataFile, updatedMetadata);
    logger.info('Project metadata updated', updates);
  }

  async addFeature(featureName: string): Promise<void> {
    const metadata = await this.load();

    if (metadata.features.includes(featureName)) {
      throw new ValidationError(`Feature already installed: ${featureName}`);
    }

    metadata.features.push(featureName);
    metadata.updatedAt = new Date().toISOString();

    await safeWriteJSON(this.metadataFile, metadata);
    logger.info('Feature added to metadata', { featureName });
  }

  async removeFeature(featureName: string): Promise<void> {
    const metadata = await this.load();

    const index = metadata.features.indexOf(featureName);
    if (index === -1) {
      throw new ValidationError(`Feature not found: ${featureName}`);
    }

    metadata.features.splice(index, 1);
    metadata.updatedAt = new Date().toISOString();

    await safeWriteJSON(this.metadataFile, metadata);
    logger.info('Feature removed from metadata', { featureName });
  }

  async hasFeature(featureName: string): Promise<boolean> {
    const metadata = await this.load();
    return metadata.features.includes(featureName);
  }

  async exists(): Promise<boolean> {
    return pathExists(this.metadataFile);
  }

  async validate(): Promise<boolean> {
    try {
      await this.load();
      return true;
    } catch {
      return false;
    }
  }

  getMetadataPath(): string {
    return this.metadataFile;
  }

  getProjectRoot(): string {
    return this.projectRoot;
  }
}

export async function findProjectRoot(startDir: string = process.cwd()): Promise<string | null> {
  let currentDir = path.resolve(startDir);
  const root = path.parse(currentDir).root;

  while (currentDir !== root) {
    const metadataPath = path.join(currentDir, METADATA_DIR, METADATA_FILE);

    if (await pathExists(metadataPath)) {
      return currentDir;
    }

    currentDir = path.dirname(currentDir);
  }

  return null;
}
