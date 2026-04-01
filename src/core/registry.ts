import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Registry, RegistrySchema } from '../types/schemas.js';
import { RegistryError, ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { ensureDir, pathExists, safeReadJSON, safeWriteJSON } from '../utils/file.js';

const REGISTRY_URL = 'https://registry.slyxup.online/registry.json';
const CACHE_DIR = path.join(os.homedir(), '.slyxup', 'cache');
const REGISTRY_CACHE_FILE = path.join(CACHE_DIR, 'registry.json');
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

interface CachedRegistry {
  data: Registry;
  timestamp: number;
  url: string;
}

export class RegistryLoader {
  private registry: Registry | null = null;

  async load(forceRefresh = false): Promise<Registry> {
    logger.info('Loading registry', { forceRefresh });

    // Try to load from cache first
    if (!forceRefresh) {
      const cachedRegistry = await this.loadFromCache();
      if (cachedRegistry) {
        this.registry = cachedRegistry;
        return cachedRegistry;
      }
    }

    // Fetch from remote
    const registry = await this.fetchRegistry();
    await this.saveToCache(registry);

    this.registry = registry;
    return registry;
  }

  private async loadFromCache(): Promise<Registry | null> {
    try {
      if (!(await pathExists(REGISTRY_CACHE_FILE))) {
        logger.debug('Registry cache file not found');
        return null;
      }

      const cached = await safeReadJSON<CachedRegistry>(REGISTRY_CACHE_FILE);
      const age = Date.now() - cached.timestamp;

      if (age > CACHE_TTL) {
        logger.debug('Registry cache expired', { age });
        return null;
      }

      // Validate cached data
      const validatedRegistry = RegistrySchema.parse(cached.data);
      logger.info('Registry loaded from cache', { age });

      return validatedRegistry;
    } catch (error) {
      logger.warn('Failed to load registry from cache', error);
      return null;
    }
  }

  private async fetchRegistry(): Promise<Registry> {
    try {
      logger.info('Fetching registry from remote', { url: REGISTRY_URL });

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      const response = await fetch(REGISTRY_URL, {
        headers: {
          'User-Agent': 'SlyxUp-CLI/1.0.0',
          Accept: 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new RegistryError(
          `Failed to fetch registry: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      const registry = RegistrySchema.parse(data);

      logger.info('Registry fetched successfully', {
        version: registry.version,
        templates: Object.keys(registry.templates).length,
        features: Object.keys(registry.features).length,
      });

      return registry;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof RegistryError) {
        throw error;
      }

      throw new RegistryError('Failed to fetch or parse registry', error);
    }
  }

  private async saveToCache(registry: Registry): Promise<void> {
    try {
      await ensureDir(CACHE_DIR);

      const cached: CachedRegistry = {
        data: registry,
        timestamp: Date.now(),
        url: REGISTRY_URL,
      };

      await safeWriteJSON(REGISTRY_CACHE_FILE, cached);
      logger.info('Registry saved to cache');
    } catch (error) {
      logger.warn('Failed to save registry to cache', error);
    }
  }

  getTemplate(framework: string, version?: string) {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }

    const templates = this.registry.templates[framework];
    if (!templates || templates.length === 0) {
      throw new RegistryError(`No templates found for framework: ${framework}`);
    }

    if (version) {
      const template = templates.find((t) => t.version === version);
      if (!template) {
        throw new RegistryError(
          `Template version ${version} not found for framework: ${framework}`
        );
      }
      return template;
    }

    // Return latest version (first in array)
    return templates[0];
  }

  getFeature(name: string, version?: string) {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }

    const features = this.registry.features[name];
    if (!features || features.length === 0) {
      throw new RegistryError(`Feature not found: ${name}`);
    }

    if (version) {
      const feature = features.find((f) => f.version === version);
      if (!feature) {
        throw new RegistryError(`Feature version ${version} not found: ${name}`);
      }
      return feature;
    }

    // Return latest version (first in array)
    return features[0];
  }

  listTemplates(): string[] {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }

    return Object.keys(this.registry.templates);
  }

  listFeatures(): string[] {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }

    return Object.keys(this.registry.features);
  }

  async clearCache(): Promise<void> {
    try {
      if (await pathExists(REGISTRY_CACHE_FILE)) {
        await fs.unlink(REGISTRY_CACHE_FILE);
        logger.info('Registry cache cleared');
      }
    } catch (error) {
      logger.warn('Failed to clear registry cache', error);
    }
  }
}

export const registryLoader = new RegistryLoader();
