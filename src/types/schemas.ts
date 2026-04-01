import { z } from 'zod';

// Registry Schema
export const RegistryTemplateSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  framework: z.string(),
  downloadUrl: z.string().url(),
  sha256: z.string().length(64),
  size: z.number().optional(),
  aliases: z.array(z.string()).optional(), // e.g., ["react-app", "vite-react"]
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export const RegistryFeatureSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  frameworks: z.array(z.string()),
  downloadUrl: z.string().url(),
  sha256: z.string().length(64),
  dependencies: z.array(z.string()).optional(),
  peerDependencies: z.array(z.string()).optional(),
  aliases: z.array(z.string()).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
});

export const RegistrySchema = z.object({
  version: z.string(),
  templates: z.record(z.array(RegistryTemplateSchema)),
  features: z.record(z.array(RegistryFeatureSchema)),
});

// Project Metadata Schema
export const ProjectMetadataSchema = z.object({
  framework: z.string(),
  features: z.array(z.string()),
  templateVersion: z.string(),
  cliVersion: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
});

// Feature Manifest Schema
export const FeatureManifestSchema = z.object({
  name: z.string(),
  version: z.string().optional(),
  creates: z.array(z.string()).optional(),
  modifies: z.array(z.string()).optional(),
  dependencies: z.record(z.string()).optional(),
  devDependencies: z.record(z.string()).optional(),
  scripts: z.record(z.string()).optional(),
});

// Type exports
export type RegistryTemplate = z.infer<typeof RegistryTemplateSchema>;
export type RegistryFeature = z.infer<typeof RegistryFeatureSchema>;
export type Registry = z.infer<typeof RegistrySchema>;
export type ProjectMetadata = z.infer<typeof ProjectMetadataSchema>;
export type FeatureManifest = z.infer<typeof FeatureManifestSchema>;
