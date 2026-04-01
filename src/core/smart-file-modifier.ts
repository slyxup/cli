/**
 * Smart File Modifier
 * 
 * Intelligent file modification system that can:
 * - Parse and modify JavaScript/TypeScript files
 * - Merge JSON/YAML configurations
 * - Insert imports and code blocks
 * - Handle framework-specific modifications
 * - Preserve formatting and comments
 */

import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';
import { pathExists, safeReadJSON, safeWriteJSON } from '../utils/file.js';
import type { ContentModification, FileAction } from '../types/schemas.js';

// ============================================================================
// Types
// ============================================================================

export interface ModificationResult {
  success: boolean;
  path: string;
  action: FileAction;
  message: string;
  backup?: string;
}

export interface ModificationContext {
  projectRoot: string;
  framework: string;
  hasTypescript: boolean;
  fileExtension: string;
}

// ============================================================================
// File Content Utilities
// ============================================================================

/**
 * Read file content safely
 */
async function readFileContent(filePath: string): Promise<string | null> {
  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch {
    return null;
  }
}

/**
 * Write file content safely with directory creation
 */
async function writeFileContent(filePath: string, content: string): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Create backup of file
 */
async function createBackup(filePath: string): Promise<string | undefined> {
  try {
    const content = await readFileContent(filePath);
    if (content !== null) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      await writeFileContent(backupPath, content);
      return backupPath;
    }
  } catch {
    logger.warn('Failed to create backup', { filePath });
  }
  return undefined;
}

// ============================================================================
// Import Statement Handling
// ============================================================================

interface ImportInfo {
  type: 'named' | 'default' | 'namespace' | 'side-effect';
  module: string;
  names: string[];
  defaultName?: string;
  line: string;
}

/**
 * Parse import statements from content
 */
function parseImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  const importRegex = /^import\s+(?:(?:(\*\s+as\s+\w+)|(\{[^}]+\})|(\w+))\s+from\s+)?['"]([^'"]+)['"];?\s*$/gm;
  
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    const [line, namespace, named, defaultImport, module] = match;
    
    if (!module) {
      // Side-effect import
      imports.push({
        type: 'side-effect',
        module: match[4] || '',
        names: [],
        line,
      });
    } else if (namespace) {
      imports.push({
        type: 'namespace',
        module,
        names: [namespace.replace('* as ', '')],
        line,
      });
    } else if (named) {
      const names = named
        .replace(/[{}]/g, '')
        .split(',')
        .map(n => n.trim())
        .filter(Boolean);
      imports.push({
        type: 'named',
        module,
        names,
        defaultName: defaultImport,
        line,
      });
    } else if (defaultImport) {
      imports.push({
        type: 'default',
        module,
        names: [],
        defaultName: defaultImport,
        line,
      });
    }
  }
  
  return imports;
}

/**
 * Find the end position of import statements
 */
function findImportEndPosition(content: string): number {
  const lines = content.split('\n');
  let lastImportLine = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('import ') || line.startsWith("import '") || line.startsWith('import "')) {
      lastImportLine = i;
    } else if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && lastImportLine >= 0) {
      // Found non-import, non-comment line after imports
      break;
    }
  }
  
  if (lastImportLine === -1) {
    // No imports found, return position after any initial comments/directives
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*') && !line.startsWith("'use ") && !line.startsWith('"use ')) {
        return lines.slice(0, i).join('\n').length + (i > 0 ? 1 : 0);
      }
    }
  }
  
  return lines.slice(0, lastImportLine + 1).join('\n').length + 1;
}

/**
 * Generate import statement
 */
function generateImportStatement(
  module: string,
  options: {
    default?: string;
    named?: string[];
    namespace?: string;
  }
): string {
  const parts: string[] = [];
  
  if (options.default) {
    parts.push(options.default);
  }
  
  if (options.named && options.named.length > 0) {
    parts.push(`{ ${options.named.join(', ')} }`);
  }
  
  if (options.namespace) {
    parts.push(`* as ${options.namespace}`);
  }
  
  if (parts.length > 0) {
    return `import ${parts.join(', ')} from '${module}';`;
  }
  
  // Side-effect import
  return `import '${module}';`;
}

/**
 * Check if import already exists
 */
function hasImport(content: string, module: string, importName?: string): boolean {
  const imports = parseImports(content);
  
  for (const imp of imports) {
    if (imp.module === module) {
      if (!importName) return true;
      if (imp.defaultName === importName) return true;
      if (imp.names.includes(importName)) return true;
    }
  }
  
  return false;
}

// ============================================================================
// Content Modification Functions
// ============================================================================

/**
 * Prepend content to file
 */
function prependContent(
  existingContent: string,
  newContent: string,
  marker?: string
): { content: string; modified: boolean } {
  // Check if marker already exists
  if (marker && existingContent.includes(marker)) {
    return { content: existingContent, modified: false };
  }
  
  // Check for duplicate content
  if (existingContent.startsWith(newContent.trim())) {
    return { content: existingContent, modified: false };
  }
  
  return {
    content: newContent + existingContent,
    modified: true,
  };
}

/**
 * Append content to file
 */
function appendContent(
  existingContent: string,
  newContent: string,
  marker?: string
): { content: string; modified: boolean } {
  // Check if marker already exists
  if (marker && existingContent.includes(marker)) {
    return { content: existingContent, modified: false };
  }
  
  // Check for duplicate content
  if (existingContent.endsWith(newContent.trim())) {
    return { content: existingContent, modified: false };
  }
  
  return {
    content: existingContent + (existingContent.endsWith('\n') ? '' : '\n') + newContent,
    modified: true,
  };
}

/**
 * Insert content after imports
 */
function insertAfterImports(
  existingContent: string,
  newContent: string,
  marker?: string
): { content: string; modified: boolean } {
  // Check if marker already exists
  if (marker && existingContent.includes(marker)) {
    return { content: existingContent, modified: false };
  }
  
  const importEndPos = findImportEndPosition(existingContent);
  const before = existingContent.slice(0, importEndPos);
  const after = existingContent.slice(importEndPos);
  
  return {
    content: before + '\n' + newContent + after,
    modified: true,
  };
}

/**
 * Insert content at marker position
 */
function insertAtMarker(
  existingContent: string,
  newContent: string,
  targetMarker: string,
  position: 'before' | 'after' = 'after'
): { content: string; modified: boolean } {
  const markerIndex = existingContent.indexOf(targetMarker);
  
  if (markerIndex === -1) {
    logger.warn('Marker not found', { targetMarker });
    return { content: existingContent, modified: false };
  }
  
  if (position === 'before') {
    return {
      content: existingContent.slice(0, markerIndex) + newContent + '\n' + existingContent.slice(markerIndex),
      modified: true,
    };
  } else {
    const markerEndIndex = markerIndex + targetMarker.length;
    const lineEndIndex = existingContent.indexOf('\n', markerEndIndex);
    const insertPos = lineEndIndex === -1 ? existingContent.length : lineEndIndex + 1;
    
    return {
      content: existingContent.slice(0, insertPos) + newContent + '\n' + existingContent.slice(insertPos),
      modified: true,
    };
  }
}

/**
 * Insert import statement
 */
function insertImport(
  existingContent: string,
  importStatement: string,
  options?: {
    module?: string;
    importName?: string;
  }
): { content: string; modified: boolean } {
  // Parse the import statement to get module info
  const moduleMatch = importStatement.match(/from\s+['"]([^'"]+)['"]/);
  const module = options?.module || moduleMatch?.[1];
  
  // Check if import already exists
  if (module && hasImport(existingContent, module, options?.importName)) {
    return { content: existingContent, modified: false };
  }
  
  const importEndPos = findImportEndPosition(existingContent);
  
  if (importEndPos === 0) {
    // No imports, add at top
    return {
      content: importStatement + '\n' + existingContent,
      modified: true,
    };
  }
  
  // Insert at end of imports
  const before = existingContent.slice(0, importEndPos);
  const after = existingContent.slice(importEndPos);
  
  return {
    content: before + importStatement + '\n' + after,
    modified: true,
  };
}

// ============================================================================
// JSON/Config Merging
// ============================================================================

/**
 * Deep merge two objects
 */
function deepMerge<T extends Record<string, unknown>>(target: T, source: Partial<T>): T {
  const output = { ...target };
  
  for (const key of Object.keys(source) as Array<keyof T>) {
    const sourceValue = source[key];
    const targetValue = target[key];
    
    if (
      sourceValue !== undefined &&
      typeof sourceValue === 'object' &&
      sourceValue !== null &&
      !Array.isArray(sourceValue) &&
      typeof targetValue === 'object' &&
      targetValue !== null &&
      !Array.isArray(targetValue)
    ) {
      output[key] = deepMerge(
        targetValue as Record<string, unknown>,
        sourceValue as Record<string, unknown>
      ) as T[keyof T];
    } else if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
      // Merge arrays (deduplicate)
      output[key] = [...new Set([...targetValue, ...sourceValue])] as T[keyof T];
    } else if (sourceValue !== undefined) {
      output[key] = sourceValue as T[keyof T];
    }
  }
  
  return output;
}

/**
 * Set value at JSON path
 */
function setJsonPath(obj: Record<string, unknown>, path: string, value: unknown): void {
  const parts = path.split('.');
  let current = obj;
  
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (!(part in current) || typeof current[part] !== 'object') {
      current[part] = {};
    }
    current = current[part] as Record<string, unknown>;
  }
  
  const lastPart = parts[parts.length - 1];
  current[lastPart] = value;
}

/**
 * Merge JSON content
 */
function mergeJsonContent(
  existingContent: string,
  newContent: string | Record<string, unknown>,
  jsonPath?: string
): { content: string; modified: boolean } {
  try {
    const existing = JSON.parse(existingContent);
    const toMerge = typeof newContent === 'string' ? JSON.parse(newContent) : newContent;
    
    let merged: Record<string, unknown>;
    
    if (jsonPath) {
      merged = { ...existing };
      setJsonPath(merged, jsonPath, toMerge);
    } else {
      merged = deepMerge(existing, toMerge);
    }
    
    // Check if anything changed
    const newJson = JSON.stringify(merged, null, 2);
    const oldJson = JSON.stringify(existing, null, 2);
    
    if (newJson === oldJson) {
      return { content: existingContent, modified: false };
    }
    
    return {
      content: newJson,
      modified: true,
    };
  } catch (error) {
    logger.error('Failed to merge JSON', error);
    return { content: existingContent, modified: false };
  }
}

// ============================================================================
// JavaScript/TypeScript Config File Handling
// ============================================================================

/**
 * Parse simple JS config export (for config files like tailwind.config.js)
 * @internal Reserved for future AST-based config parsing
 */
export function parseJsConfig(content: string): Record<string, unknown> | null {
  try {
    // Try to extract the export object
    const exportMatch = content.match(/export\s+default\s+({[\s\S]*})\s*;?\s*$/m);
    const moduleExportsMatch = content.match(/module\.exports\s*=\s*({[\s\S]*})\s*;?\s*$/m);
    
    const configStr = exportMatch?.[1] || moduleExportsMatch?.[1];
    
    if (!configStr) return null;
    
    // This is a simplified parser - for complex configs, we'd need proper AST parsing
    // For now, just identify the structure
    return { _raw: configStr };
  } catch {
    return null;
  }
}

/**
 * Modify JavaScript/TypeScript config file
 */
function modifyJsConfig(
  existingContent: string,
  modification: {
    addProperty?: { name: string; value: string };
    addToArray?: { path: string; value: string };
    addImport?: string;
  }
): { content: string; modified: boolean } {
  let content = existingContent;
  let modified = false;
  
  // Add import if needed
  if (modification.addImport && !content.includes(modification.addImport)) {
    const result = insertImport(content, modification.addImport);
    if (result.modified) {
      content = result.content;
      modified = true;
    }
  }
  
  // Add property to config object
  if (modification.addProperty) {
    const { name, value } = modification.addProperty;
    
    // Check if property already exists
    const propRegex = new RegExp(`\\b${name}\\s*:`);
    if (!propRegex.test(content)) {
      // Find the config object and add property
      const exportDefaultMatch = content.match(/export\s+default\s+{/);
      const moduleExportsMatch = content.match(/module\.exports\s*=\s*{/);
      
      const match = exportDefaultMatch || moduleExportsMatch;
      if (match && match.index !== undefined) {
        const insertPos = match.index + match[0].length;
        content = content.slice(0, insertPos) + `\n  ${name}: ${value},` + content.slice(insertPos);
        modified = true;
      }
    }
  }
  
  // Add value to array in config
  if (modification.addToArray) {
    const { path, value } = modification.addToArray;
    
    // Find the array and check if value exists
    const arrayRegex = new RegExp(`${path}\\s*:\\s*\\[([^\\]]*)`);
    const match = content.match(arrayRegex);
    
    if (match && !match[1].includes(value)) {
      const insertPos = (match.index || 0) + match[0].length;
      const separator = match[1].trim() ? ', ' : '\n    ';
      content = content.slice(0, insertPos) + separator + value + content.slice(insertPos);
      modified = true;
    }
  }
  
  return { content, modified };
}

// ============================================================================
// Provider Wrapping (React/Vue)
// ============================================================================

/**
 * Wrap app component with provider
 */
function wrapWithProvider(
  existingContent: string,
  providerName: string,
  importStatement: string,
  options?: {
    props?: string;
  }
): { content: string; modified: boolean } {
  // Check if provider is already used
  if (existingContent.includes(`<${providerName}`)) {
    return { content: existingContent, modified: false };
  }
  
  // Add import
  let content = existingContent;
  let modified = false;
  
  if (!hasImport(content, '', providerName)) {
    const importResult = insertImport(content, importStatement);
    if (importResult.modified) {
      content = importResult.content;
      modified = true;
    }
  }
  
  // Find the return statement and wrap
  const returnMatch = content.match(/return\s*\(\s*\n?\s*(<[\s\S]*?>)/);
  
  if (returnMatch && returnMatch.index !== undefined) {
    const props = options?.props ? ` ${options.props}` : '';
    const wrappedJsx = `<${providerName}${props}>\n        ${returnMatch[1]}`;
    
    // Find the closing tag and add provider closing
    const returnStart = returnMatch.index + returnMatch[0].length - returnMatch[1].length;
    
    // This is simplified - proper implementation would use AST
    const closingMatch = content.slice(returnStart).match(/<\/[^>]+>\s*\)/);
    if (closingMatch && closingMatch.index !== undefined) {
      const closingPos = returnStart + closingMatch.index + closingMatch[0].length - 1;
      content = 
        content.slice(0, returnStart) + 
        wrappedJsx.slice(0, -returnMatch[1].length) + 
        content.slice(returnStart, closingPos) + 
        `\n      </${providerName}>` +
        content.slice(closingPos);
      modified = true;
    }
  }
  
  return { content, modified };
}

// ============================================================================
// Main Modifier Class
// ============================================================================

export class SmartFileModifier {
  private context: ModificationContext;

  constructor(context: ModificationContext) {
    this.context = context;
  }

  /**
   * Apply a single modification
   */
  async applyModification(modification: ContentModification): Promise<ModificationResult> {
    const filePath = path.join(this.context.projectRoot, modification.file);
    
    // Check if file exists
    const exists = await pathExists(filePath);
    if (!exists && modification.action !== 'create') {
      // Create file if it doesn't exist for prepend/append operations
      if (['prepend', 'append'].includes(modification.action)) {
        await writeFileContent(filePath, modification.content || '');
        return {
          success: true,
          path: filePath,
          action: modification.action,
          message: `Created file with content`,
        };
      }
      
      return {
        success: false,
        path: filePath,
        action: modification.action,
        message: `File not found`,
      };
    }

    const existingContent = await readFileContent(filePath) || '';
    
    // Create backup
    const backup = await createBackup(filePath);

    // Get content to add
    let newContent = modification.content || '';
    if (modification.contentFile) {
      const contentFilePath = path.join(this.context.projectRoot, modification.contentFile);
      newContent = await readFileContent(contentFilePath) || newContent;
    }

    let result: { content: string; modified: boolean };

    switch (modification.action) {
      case 'prepend':
        result = prependContent(existingContent, newContent, modification.marker);
        break;

      case 'append':
        result = appendContent(existingContent, newContent, modification.marker);
        break;

      case 'insert-import':
        result = insertImport(existingContent, newContent);
        break;

      case 'insert-code':
        if (modification.position === 'after-imports') {
          result = insertAfterImports(existingContent, newContent, modification.marker);
        } else if (modification.position === 'at-marker' && modification.targetMarker) {
          result = insertAtMarker(existingContent, newContent, modification.targetMarker);
        } else if (modification.position === 'top') {
          result = prependContent(existingContent, newContent + '\n', modification.marker);
        } else {
          result = appendContent(existingContent, newContent, modification.marker);
        }
        break;

      case 'merge':
        if (filePath.endsWith('.json')) {
          result = mergeJsonContent(existingContent, newContent, modification.jsonPath);
        } else {
          // For JS/TS config files
          try {
            const parsedContent = JSON.parse(newContent);
            result = modifyJsConfig(existingContent, {
              addProperty: parsedContent.addProperty,
              addToArray: parsedContent.addToArray,
              addImport: parsedContent.addImport,
            });
          } catch {
            result = { content: existingContent, modified: false };
          }
        }
        break;

      case 'wrap-provider':
        // Parse the content as provider config
        try {
          const config = JSON.parse(newContent);
          result = wrapWithProvider(
            existingContent,
            config.providerName,
            config.importStatement,
            { props: config.props }
          );
        } catch {
          result = { content: existingContent, modified: false };
        }
        break;

      case 'replace':
        if (modification.marker && existingContent.includes(modification.marker)) {
          result = {
            content: existingContent.replace(modification.marker, newContent),
            modified: true,
          };
        } else {
          result = {
            content: newContent,
            modified: existingContent !== newContent,
          };
        }
        break;

      default:
        return {
          success: false,
          path: filePath,
          action: modification.action,
          message: `Unknown action: ${modification.action}`,
        };
    }

    if (result.modified) {
      await writeFileContent(filePath, result.content);
      return {
        success: true,
        path: filePath,
        action: modification.action,
        message: `Successfully applied ${modification.action}`,
        backup,
      };
    }

    return {
      success: true,
      path: filePath,
      action: modification.action,
      message: `No changes needed (content already exists or marker found)`,
    };
  }

  /**
   * Apply multiple modifications
   */
  async applyModifications(modifications: ContentModification[]): Promise<ModificationResult[]> {
    const results: ModificationResult[] = [];
    
    for (const modification of modifications) {
      // Check condition if present
      if (modification.condition) {
        const conditionMet = this.evaluateCondition(modification.condition);
        if (!conditionMet) {
          results.push({
            success: true,
            path: modification.file,
            action: modification.action,
            message: `Skipped (condition not met: ${modification.condition})`,
          });
          continue;
        }
      }
      
      const result = await this.applyModification(modification);
      results.push(result);
    }
    
    return results;
  }

  /**
   * Evaluate a simple condition expression
   */
  private evaluateCondition(condition: string): boolean {
    try {
      // Simple condition evaluation
      // Supports: framework === 'next', hasTypescript, !hasTypescript
      
      if (condition.includes('framework')) {
        const match = condition.match(/framework\s*===?\s*['"]([^'"]+)['"]/);
        if (match) {
          return this.context.framework === match[1];
        }
        const notMatch = condition.match(/framework\s*!==?\s*['"]([^'"]+)['"]/);
        if (notMatch) {
          return this.context.framework !== notMatch[1];
        }
      }
      
      if (condition === 'hasTypescript') {
        return this.context.hasTypescript;
      }
      
      if (condition === '!hasTypescript') {
        return !this.context.hasTypescript;
      }
      
      // Default to true for unknown conditions
      logger.warn('Unknown condition expression', { condition });
      return true;
    } catch {
      return true;
    }
  }

  /**
   * Update package.json with dependencies and scripts
   */
  async updatePackageJson(
    dependencies?: Record<string, string>,
    devDependencies?: Record<string, string>,
    scripts?: Record<string, string>
  ): Promise<ModificationResult> {
    const packageJsonPath = path.join(this.context.projectRoot, 'package.json');
    
    if (!(await pathExists(packageJsonPath))) {
      return {
        success: false,
        path: packageJsonPath,
        action: 'merge',
        message: 'package.json not found',
      };
    }

    const backup = await createBackup(packageJsonPath);
    const pkg = await safeReadJSON<Record<string, unknown>>(packageJsonPath);
    
    let modified = false;

    // Merge dependencies
    if (dependencies && Object.keys(dependencies).length > 0) {
      const existingDeps = (pkg.dependencies as Record<string, string>) || {};
      pkg.dependencies = { ...existingDeps };
      
      for (const [name, version] of Object.entries(dependencies)) {
        if (!existingDeps[name]) {
          (pkg.dependencies as Record<string, string>)[name] = version;
          modified = true;
        }
      }
    }

    // Merge devDependencies
    if (devDependencies && Object.keys(devDependencies).length > 0) {
      const existingDevDeps = (pkg.devDependencies as Record<string, string>) || {};
      pkg.devDependencies = { ...existingDevDeps };
      
      for (const [name, version] of Object.entries(devDependencies)) {
        if (!existingDevDeps[name]) {
          (pkg.devDependencies as Record<string, string>)[name] = version;
          modified = true;
        }
      }
    }

    // Merge scripts
    if (scripts && Object.keys(scripts).length > 0) {
      const existingScripts = (pkg.scripts as Record<string, string>) || {};
      pkg.scripts = { ...existingScripts };
      
      for (const [name, command] of Object.entries(scripts)) {
        if (!existingScripts[name]) {
          (pkg.scripts as Record<string, string>)[name] = command;
          modified = true;
        }
      }
    }

    if (modified) {
      await safeWriteJSON(packageJsonPath, pkg);
      return {
        success: true,
        path: packageJsonPath,
        action: 'merge',
        message: 'Successfully updated package.json',
        backup,
      };
    }

    return {
      success: true,
      path: packageJsonPath,
      action: 'merge',
      message: 'No changes needed to package.json',
    };
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createSmartFileModifier(context: ModificationContext): SmartFileModifier {
  return new SmartFileModifier(context);
}

// ============================================================================
// Utility exports
// ============================================================================

export {
  parseImports,
  hasImport,
  generateImportStatement,
  deepMerge,
  prependContent,
  appendContent,
  insertAfterImports,
  mergeJsonContent,
};
