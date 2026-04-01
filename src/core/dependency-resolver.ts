/**
 * Feature Dependency Resolver
 * 
 * Handles feature dependency resolution including:
 * - Topological sorting for installation order
 * - Conflict detection and resolution
 * - Circular dependency detection
 * - Version compatibility checking
 */

import { registryLoader } from './registry.js';
import { logger } from '../utils/logger.js';

// ============================================================================
// Types
// ============================================================================

export interface FeatureNode {
  name: string;
  version: string;
  dependencies: string[];
  conflicts: string[];
  frameworks: string[];
}

export interface DependencyResolution {
  success: boolean;
  installOrder: string[];
  missingDependencies: Array<{ feature: string; missing: string[] }>;
  conflicts: Array<{ feature: string; conflictsWith: string }>;
  circularDependencies: string[][];
  warnings: string[];
}

export interface ResolverOptions {
  framework: string;
  installedFeatures: string[];
  requestedFeatures: string[];
  ignoreConflicts?: boolean;
}

// ============================================================================
// Dependency Resolver Class
// ============================================================================

export class FeatureDependencyResolver {
  private featureMap: Map<string, FeatureNode> = new Map();
  private visited: Set<string> = new Set();
  private recursionStack: Set<string> = new Set();
  private sortedOrder: string[] = [];
  
  /**
   * Load feature definitions from registry
   */
  async loadFeatureDefinitions(): Promise<void> {
    await registryLoader.load();
    const features = registryLoader.listFeatures();
    
    this.featureMap.clear();
    
    for (const feature of features) {
      // Get detailed feature info if available
      const node: FeatureNode = {
        name: feature.name,
        version: feature.version,
        dependencies: feature.dependencies || [],
        conflicts: [], // Will be populated from feature.json
        frameworks: feature.frameworks,
      };
      
      this.featureMap.set(feature.name, node);
    }
  }
  
  /**
   * Add feature node with detailed info from manifest
   */
  addFeatureNode(name: string, node: Partial<FeatureNode>): void {
    const existing = this.featureMap.get(name);
    if (existing) {
      this.featureMap.set(name, { ...existing, ...node });
    } else {
      this.featureMap.set(name, {
        name,
        version: node.version || '1.0.0',
        dependencies: node.dependencies || [],
        conflicts: node.conflicts || [],
        frameworks: node.frameworks || ['*'],
      });
    }
  }
  
  /**
   * Resolve dependencies for a set of requested features
   */
  resolve(options: ResolverOptions): DependencyResolution {
    const result: DependencyResolution = {
      success: true,
      installOrder: [],
      missingDependencies: [],
      conflicts: [],
      circularDependencies: [],
      warnings: [],
    };
    
    // Reset state
    this.visited.clear();
    this.recursionStack.clear();
    this.sortedOrder = [];
    
    const { framework, installedFeatures, requestedFeatures, ignoreConflicts } = options;
    
    // Build expanded feature set (including dependencies)
    const expandedFeatures = new Set<string>();
    
    for (const featureName of requestedFeatures) {
      this.expandDependencies(featureName, expandedFeatures, result);
    }
    
    // Check framework compatibility
    for (const featureName of expandedFeatures) {
      const node = this.featureMap.get(featureName);
      if (node && !node.frameworks.includes('*') && !node.frameworks.includes(framework)) {
        result.warnings.push(
          `Feature '${featureName}' may not be compatible with ${framework}. ` +
          `Supported: ${node.frameworks.join(', ')}`
        );
      }
    }
    
    // Detect conflicts
    const allFeatures = [...installedFeatures, ...expandedFeatures];
    
    for (const featureName of expandedFeatures) {
      const node = this.featureMap.get(featureName);
      if (node?.conflicts) {
        for (const conflict of node.conflicts) {
          if (allFeatures.includes(conflict)) {
            result.conflicts.push({
              feature: featureName,
              conflictsWith: conflict,
            });
            
            if (!ignoreConflicts) {
              result.success = false;
            }
          }
        }
      }
    }
    
    // Also check reverse conflicts
    for (const installed of installedFeatures) {
      const node = this.featureMap.get(installed);
      if (node?.conflicts) {
        for (const conflict of node.conflicts) {
          if (expandedFeatures.has(conflict)) {
            // Check if already recorded
            const exists = result.conflicts.some(
              c => c.feature === installed && c.conflictsWith === conflict
            );
            
            if (!exists) {
              result.conflicts.push({
                feature: installed,
                conflictsWith: conflict,
              });
              
              if (!ignoreConflicts) {
                result.success = false;
              }
            }
          }
        }
      }
    }
    
    // Topological sort (detect circular dependencies)
    for (const featureName of expandedFeatures) {
      if (!this.visited.has(featureName)) {
        const cycle = this.topologicalSort(featureName, expandedFeatures);
        if (cycle) {
          result.circularDependencies.push(cycle);
          result.success = false;
        }
      }
    }
    
    // Filter out already installed features from install order
    result.installOrder = this.sortedOrder.filter(
      f => !installedFeatures.includes(f) && expandedFeatures.has(f)
    );
    
    // Check for missing dependencies
    for (const featureName of expandedFeatures) {
      const node = this.featureMap.get(featureName);
      if (node?.dependencies) {
        const missing = node.dependencies.filter(dep => {
          // Check if dependency is available and will be installed
          if (!this.featureMap.has(dep)) {
            return true; // Unknown dependency
          }
          // Check if it's either already installed or will be installed
          return !installedFeatures.includes(dep) && !expandedFeatures.has(dep);
        });
        
        if (missing.length > 0) {
          result.missingDependencies.push({
            feature: featureName,
            missing,
          });
        }
      }
    }
    
    // If there are missing dependencies and they're required, fail
    if (result.missingDependencies.some(m => m.missing.length > 0)) {
      const criticalMissing = result.missingDependencies.filter(m => {
        // Check if any missing deps are completely unknown
        return m.missing.some(dep => !this.featureMap.has(dep));
      });
      
      if (criticalMissing.length > 0) {
        result.success = false;
      }
    }
    
    logger.info('Dependency resolution completed', {
      requested: requestedFeatures,
      installOrder: result.installOrder,
      success: result.success,
    });
    
    return result;
  }
  
  /**
   * Expand dependencies recursively
   */
  private expandDependencies(
    featureName: string,
    expanded: Set<string>,
    result: DependencyResolution
  ): void {
    if (expanded.has(featureName)) {
      return; // Already processed
    }
    
    expanded.add(featureName);
    
    const node = this.featureMap.get(featureName);
    if (!node) {
      logger.warn('Feature not found in registry', { feature: featureName });
      return;
    }
    
    // Recursively expand dependencies
    for (const dep of node.dependencies) {
      this.expandDependencies(dep, expanded, result);
    }
  }
  
  /**
   * Topological sort using DFS (Kahn's algorithm variant)
   * Returns cycle path if circular dependency detected
   */
  private topologicalSort(
    featureName: string,
    validFeatures: Set<string>
  ): string[] | null {
    // Mark as being processed
    this.recursionStack.add(featureName);
    this.visited.add(featureName);
    
    const node = this.featureMap.get(featureName);
    if (node?.dependencies) {
      for (const dep of node.dependencies) {
        // Only process if it's in our valid feature set
        if (!validFeatures.has(dep)) {
          continue;
        }
        
        // Check for cycle
        if (this.recursionStack.has(dep)) {
          // Found a cycle, reconstruct path
          const cycle: string[] = [];
          let found = false;
          for (const f of this.recursionStack) {
            if (f === dep || found) {
              found = true;
              cycle.push(f);
            }
          }
          cycle.push(dep);
          return cycle;
        }
        
        if (!this.visited.has(dep)) {
          const cycle = this.topologicalSort(dep, validFeatures);
          if (cycle) {
            return cycle;
          }
        }
      }
    }
    
    // Done processing, remove from recursion stack
    this.recursionStack.delete(featureName);
    
    // Add to sorted order (dependencies first)
    this.sortedOrder.push(featureName);
    
    return null;
  }
  
  /**
   * Get direct dependencies of a feature
   */
  getDependencies(featureName: string): string[] {
    const node = this.featureMap.get(featureName);
    return node?.dependencies || [];
  }
  
  /**
   * Get features that conflict with a given feature
   */
  getConflicts(featureName: string): string[] {
    const node = this.featureMap.get(featureName);
    return node?.conflicts || [];
  }
  
  /**
   * Check if two features conflict
   */
  hasConflict(feature1: string, feature2: string): boolean {
    const node1 = this.featureMap.get(feature1);
    const node2 = this.featureMap.get(feature2);
    
    return (
      (node1?.conflicts || []).includes(feature2) ||
      (node2?.conflicts || []).includes(feature1)
    );
  }
  
  /**
   * Get all features that depend on a given feature
   */
  getDependents(featureName: string): string[] {
    const dependents: string[] = [];
    
    for (const [name, node] of this.featureMap) {
      if (node.dependencies.includes(featureName)) {
        dependents.push(name);
      }
    }
    
    return dependents;
  }
  
  /**
   * Suggest compatible features based on current setup
   */
  suggestCompatibleFeatures(
    framework: string,
    installedFeatures: string[]
  ): string[] {
    const suggestions: string[] = [];
    
    for (const [name, node] of this.featureMap) {
      // Skip already installed
      if (installedFeatures.includes(name)) {
        continue;
      }
      
      // Check framework compatibility
      if (!node.frameworks.includes('*') && !node.frameworks.includes(framework)) {
        continue;
      }
      
      // Check for conflicts
      const hasConflict = node.conflicts.some(c => installedFeatures.includes(c));
      if (hasConflict) {
        continue;
      }
      
      // Check if dependencies are satisfied
      const dependenciesSatisfied = node.dependencies.every(dep =>
        installedFeatures.includes(dep) || this.featureMap.has(dep)
      );
      
      if (dependenciesSatisfied) {
        suggestions.push(name);
      }
    }
    
    return suggestions;
  }
}

// ============================================================================
// Factory and singleton
// ============================================================================

export function createDependencyResolver(): FeatureDependencyResolver {
  return new FeatureDependencyResolver();
}

export const dependencyResolver = new FeatureDependencyResolver();
