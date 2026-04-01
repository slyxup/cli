import { z } from 'zod';

// ============================================================================
// Registry Schemas
// ============================================================================

export const RegistryTemplateSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  framework: z.string(),
  frameworkVersion: z.string().optional(),
  status: z.enum(['stable', 'beta', 'coming-soon']).optional().default('stable'),
  downloadUrl: z.string(), // Allow both URLs and file paths
  sha256: z.string().length(64),
  size: z.number().optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  features: z.array(z.string()).optional(),
});

export const RegistryFeatureSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  frameworks: z.array(z.string()),
  frameworkVersion: z.string().optional(),
  status: z.enum(['stable', 'beta', 'coming-soon']).optional().default('stable'),
  downloadUrl: z.string(), // Allow both URLs and file paths
  sha256: z.string().length(64),
  dependencies: z.array(z.string()).optional(),
  peerDependencies: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  size: z.number().optional(),
});

export const RegistrySchema = z.object({
  version: z.string(),
  templates: z.record(z.array(RegistryTemplateSchema)),
  features: z.record(z.array(RegistryFeatureSchema)),
});

// ============================================================================
// Project Metadata Schema
// ============================================================================

export const ProjectMetadataSchema = z.object({
  framework: z.string(),
  features: z.array(z.string()),
  template: z.string().optional(),
  templateVersion: z.string(),
  name: z.string().optional(),
  packageManager: z.enum(['npm', 'yarn', 'pnpm', 'bun']).optional(),
  cliVersion: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  featureVersions: z.record(z.string()).optional(),
});

// ============================================================================
// Enhanced Feature Manifest Schema (Multi-Framework Support)
// ============================================================================

// File action types
const FileActionSchema = z.enum([
  'create',           // Create new file
  'copy',             // Copy file
  'prepend',          // Add content to beginning
  'append',           // Add content to end
  'merge',            // Merge JSON/config content
  'replace',          // Replace content
  'insert-import',    // Insert import statement
  'insert-code',      // Insert code at marker
  'wrap-provider',    // Wrap with provider component
  'modify-config',    // Modify configuration file
]);

// File operation schema
const FileOperationSchema = z.object({
  source: z.string(),                        // Source path in feature archive
  destination: z.string(),                   // Target path in project
  action: FileActionSchema.optional().default('create'),
  overwrite: z.boolean().optional().default(false),
  condition: z.string().optional(),          // Condition expression: "framework === 'next'"
  transform: z.string().optional(),          // Transform function name
});

// Content modification schema
const ContentModificationSchema = z.object({
  file: z.string(),                          // Target file path
  action: FileActionSchema,
  content: z.string().optional(),            // Content to add/modify
  contentFile: z.string().optional(),        // File containing content
  marker: z.string().optional(),             // Marker to find in file (for skip if exists)
  position: z.enum(['top', 'bottom', 'after-imports', 'before-exports', 'at-marker']).optional(),
  targetMarker: z.string().optional(),       // Marker for position: 'at-marker'
  condition: z.string().optional(),          // Condition expression
  jsonPath: z.string().optional(),           // JSON path for merge operations
});

// Framework-specific configuration
const FrameworkConfigSchema = z.object({
  files: z.array(FileOperationSchema).optional(),
  modifications: z.array(ContentModificationSchema).optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional(),
  postInstallCommands: z.array(z.string()).optional(),
  envVariables: z.array(z.string()).optional(),
});

// Main enhanced feature manifest schema
export const EnhancedFeatureManifestSchema = z.object({
  // Basic info
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  
  // Compatibility
  frameworks: z.array(z.string()),           // Supported frameworks ["*"] for all
  requiresTypescript: z.boolean().optional().default(false),
  conflictsWith: z.array(z.string()).optional(),
  requiresFeatures: z.array(z.string()).optional(),
  
  // Default/Common configuration (applied to all frameworks)
  files: z.array(FileOperationSchema).optional(),
  modifications: z.array(ContentModificationSchema).optional(),
  creates: z.array(z.string()).optional(),   // Legacy: simple file list
  modifies: z.array(z.string()).optional(),  // Legacy: simple file list
  
  // Dependencies
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  peerDependencies: z.record(z.string()).optional(),
  
  // Scripts
  scripts: z.record(z.string()).optional(),
  
  // Environment variables
  envVariables: z.array(z.object({
    name: z.string(),
    description: z.string().optional(),
    required: z.boolean().optional().default(false),
    defaultValue: z.string().optional(),
    example: z.string().optional(),
  })).optional(),
  
  // Framework-specific overrides and additions
  frameworkConfigs: z.record(FrameworkConfigSchema).optional(),
  
  // Post-installation
  postInstall: z.object({
    commands: z.array(z.string()).optional(),
    message: z.string().optional(),
    instructions: z.array(z.string()).optional(),
  }).optional(),
  
  // Validation
  validation: z.object({
    preInstall: z.array(z.object({
      type: z.enum(['file-exists', 'file-not-exists', 'dependency', 'no-dependency', 'custom']),
      target: z.string(),
      message: z.string().optional(),
    })).optional(),
    postInstall: z.array(z.object({
      type: z.enum(['file-exists', 'import-works', 'custom']),
      target: z.string(),
      message: z.string().optional(),
    })).optional(),
  }).optional(),
});

// Legacy feature manifest (backward compatibility)
export const FeatureManifestSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  creates: z.array(z.string()).optional(),
  modifies: z.array(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional(),
});

// ============================================================================
// Template Manifest Schema
// ============================================================================

export const TemplateManifestSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string().optional(),
  framework: z.string(),
  frameworkVersion: z.string().optional(),
  
  // Structure
  structure: z.object({
    sourceDir: z.string().optional(),
    componentsDir: z.string().optional(),
    libDir: z.string().optional(),
    stylesDir: z.string().optional(),
    publicDir: z.string().optional(),
  }).optional(),
  
  // Default features to install
  defaultFeatures: z.array(z.string()).optional(),
  
  // Recommended features
  recommendedFeatures: z.array(z.string()).optional(),
  
  // Scripts to add
  scripts: z.record(z.string()).optional(),
  
  // Files to rename based on project name
  renameFiles: z.array(z.object({
    from: z.string(),
    to: z.string(),       // Can contain {{projectName}} placeholder
  })).optional(),
  
  // Content placeholders to replace
  placeholders: z.record(z.string()).optional(),
});

// ============================================================================
// Monorepo Support Schemas
// ============================================================================

export const MonorepoConfigSchema = z.object({
  type: z.enum(['turborepo', 'nx', 'lerna', 'pnpm-workspaces', 'yarn-workspaces', 'npm-workspaces']),
  workspaces: z.array(z.string()),
  packages: z.record(z.object({
    name: z.string(),
    path: z.string(),
    framework: z.string().optional(),
    features: z.array(z.string()).optional(),
  })).optional(),
});

// ============================================================================
// Installation Plan Schema
// ============================================================================

export const InstallationPlanSchema = z.object({
  featureName: z.string(),
  version: z.string(),
  
  // Files to create
  filesToCreate: z.array(z.object({
    source: z.string(),
    destination: z.string(),
    content: z.string().optional(),
  })),
  
  // Files to modify
  filesToModify: z.array(z.object({
    path: z.string(),
    action: FileActionSchema,
    content: z.string(),
    marker: z.string().optional(),
  })),
  
  // Dependencies
  dependencies: z.record(z.string()),
  devDependencies: z.record(z.string()),
  
  // Scripts
  scripts: z.record(z.string()),
  
  // Post-install commands
  postInstallCommands: z.array(z.string()),
  
  // Warnings/Info
  warnings: z.array(z.string()).optional(),
  info: z.array(z.string()).optional(),
});

// ============================================================================
// Feature Resolution Schema
// ============================================================================

export const FeatureResolutionSchema = z.object({
  feature: z.string(),
  resolved: z.boolean(),
  version: z.string().optional(),
  dependencies: z.array(z.string()),
  conflicts: z.array(z.string()),
  missingRequirements: z.array(z.string()),
});

// ============================================================================
// Type Exports
// ============================================================================

export type RegistryTemplate = z.infer<typeof RegistryTemplateSchema>;
export type RegistryFeature = z.infer<typeof RegistryFeatureSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
export type FeatureManifest = z.infer<typeof FeatureManifestSchema>;
export type EnhancedFeatureManifest = z.infer<typeof EnhancedFeatureManifestSchema>;
export type TemplateManifest = z.infer<typeof TemplateManifestSchema>;
export type MonorepoConfig = z.infer<typeof MonorepoConfigSchema>;
export type InstallationPlan = z.infer<typeof InstallationPlanSchema>;
export type FeatureResolution = z.infer<typeof FeatureResolutionSchema>;
export type FileAction = z.infer<typeof FileActionSchema>;
export type FileOperation = z.infer<typeof FileOperationSchema>;
export type ContentModification = z.infer<typeof ContentModificationSchema>;
export type FrameworkConfig = z.infer<typeof FrameworkConfigSchema>;
