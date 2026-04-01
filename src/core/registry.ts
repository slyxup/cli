import fetch from 'node-fetch';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { Registry, RegistrySchema, RegistryTemplate, RegistryFeature } from '../types/schemas.js';
import { RegistryError, ValidationError } from '../types/errors.js';
import { logger } from '../utils/logger.js';
import { ensureDir, pathExists, safeReadJSON, safeWriteJSON } from '../utils/file.js';

const DEFAULT_REGISTRY_URL = 'https://registry.slyxup.online/registry.json';
const REGISTRY_URL = process.env.SLYXUP_REGISTRY_URL || DEFAULT_REGISTRY_URL;
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
      // Check if REGISTRY_URL is a local file path
      const isLocalFile = REGISTRY_URL.startsWith('file://') || REGISTRY_URL.startsWith('/');
      
      if (isLocalFile) {
        return await this.fetchLocalRegistry(REGISTRY_URL);
      }

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

  private async fetchLocalRegistry(filePath: string): Promise<Registry> {
    try {
      const localPath = filePath.startsWith('file://') ? filePath.replace('file://', '') : filePath;
      
      logger.info('Loading registry from local file', { path: localPath });
      
      if (!(await pathExists(localPath))) {
        throw new RegistryError(`Local registry file not found: ${localPath}`);
      }
      
      const data = await safeReadJSON(localPath);
      const registry = RegistrySchema.parse(data);
      
      logger.info('Registry loaded from local file', {
        version: registry.version,
        templates: Object.keys(registry.templates).length,
        features: Object.keys(registry.features).length,
      });
      
      return registry;
    } catch (error) {
      if (error instanceof ValidationError || error instanceof RegistryError) {
        throw error;
      }
      
      // Log the actual error for debugging
      logger.error('Failed to load local registry', error);
      throw new RegistryError('Failed to load local registry', error);
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

  getTemplate(identifier: string, version?: string): RegistryTemplate {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }

    const { frameworkKey, templates } = this.resolveTemplateCollection(identifier);
    if (templates.length === 0) {
      throw new RegistryError(`No templates found for ${identifier}`);
    }

    if (version) {
      const template = templates.find((t) => t.version === version);
      if (!template) {
        throw new RegistryError(
          `Template version ${version} not found for ${frameworkKey}`
        );
      }
      return template;
    }

    return templates[0];
  }

  getFeature(name: string, version?: string): RegistryFeature {
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

  listTemplates(): RegistryTemplate[] {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }

    return Object.values(this.registry.templates).map((templates) => templates[0]);
  }

  listFeatures(): RegistryFeature[] {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }

    return Object.values(this.registry.features).map((features) => features[0]);
  }

  getRegistry(): Registry {
    if (!this.registry) {
      throw new RegistryError('Registry not loaded');
    }
    return this.registry;
  }

  private normalizeIdentifier(value: string): string {
    return value.trim().toLowerCase();
  }

  private matchesTemplate(
    template: RegistryTemplate,
    identifier: string,
    frameworkKey: string
  ): boolean {
    const normalizedId = this.normalizeIdentifier(identifier);
    const normalizedFramework = this.normalizeIdentifier(frameworkKey);

    if (this.normalizeIdentifier(template.name) === normalizedId) {
      return true;
    }

    if (normalizedFramework === normalizedId) {
      return true;
    }

    if (template.aliases) {
      const hasAlias = template.aliases.some(
        (alias) => this.normalizeIdentifier(alias) === normalizedId
      );
      if (hasAlias) {
        return true;
      }
    }

    if (template.tags) {
      const hasTag = template.tags.some(
        (tag) => this.normalizeIdentifier(tag) === normalizedId
      );
      if (hasTag) {
        return true;
      }
    }

    return false;
  }

  private resolveTemplateCollection(identifier: string): { frameworkKey: string; templates: RegistryTemplate[] } {
    const normalizedId = this.normalizeIdentifier(identifier);
    const registry = this.registry;

    if (!registry) {
      throw new RegistryError('Registry not loaded');
    }

    const directCollection = registry.templates[normalizedId];
    if (directCollection && directCollection.length > 0) {
      return { frameworkKey: normalizedId, templates: directCollection };
    }

    for (const [frameworkKey, templates] of Object.entries(registry.templates)) {
      for (const template of templates) {
        if (this.matchesTemplate(template, identifier, frameworkKey)) {
          return { frameworkKey, templates };
        }
      }
    }

    throw new RegistryError(`Template not found: ${identifier}`);
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
