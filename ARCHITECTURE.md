# SlyxUp CLI Architecture

## Overview

SlyxUp CLI is designed as a **production-grade, security-first scaffolding tool** with a registry-driven architecture that prioritizes:

- **Security** - Integrity verification, path traversal protection, sandboxed operations
- **Reliability** - Transactional installations with automatic rollback
- **Extensibility** - Registry-driven templates and features
- **Performance** - Smart caching and parallel operations
- **Maintainability** - Modular design with clear separation of concerns

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│  (Commander.js - Command parsing and routing)               │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
    ┌────▼────┐    ┌────▼────┐    ┌────▼────┐
    │  Init   │    │   Add   │    │  Cache  │
    │ Command │    │ Command │    │ Command │
    └────┬────┘    └────┬────┘    └────┬────┘
         │               │               │
         └───────────────┼───────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                      Core Layer                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │   Registry   │  │  Downloader  │  │  Extractor   │     │
│  │    Loader    │  │              │  │   (Secure)   │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Transaction  │  │   Metadata   │  │  Installer   │     │
│  │   Manager    │  │   Manager    │  │   Engines    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                     Utils Layer                             │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │    Logger    │  │     Hash     │  │     File     │     │
│  │  (Structured)│  │ Verification │  │  Operations  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘     │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                        │
│  │    Backup    │  │     Merge    │                        │
│  │   Manager    │  │   Utilities  │                        │
│  └──────────────┘  └──────────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Registry System

**Purpose**: Fetch and cache the remote registry that defines templates and features.

**Location**: `src/core/registry.ts`

**Key Features**:
- Remote registry fetching from `https://registry.slyxup.online/registry.json`
- 1-hour TTL cache in `~/.slyxup/cache/registry.json`
- Zod schema validation for type safety
- Template and feature resolution with version support

**Flow**:
```
User Command → Load Registry → Check Cache (1h TTL)
                                    ↓
                            Cache Hit? Yes → Return Cached
                                    ↓ No
                            Fetch Remote → Validate Schema → Cache → Return
```

### 2. Download System

**Purpose**: Securely download and cache template/feature archives.

**Location**: `src/core/downloader.ts`

**Key Features**:
- SHA-256 integrity verification
- Persistent cache in `~/.slyxup/cache/downloads/`
- Cache validation before reuse
- Timeout protection (2 minutes)
- Automatic cleanup on failure

**Flow**:
```
Download Request → Check Cache → Valid? Yes → Return Cached Path
                        ↓ No
                 Fetch from URL → Write to Cache → Verify SHA-256 → Return Path
                        ↓ Error
                 Cleanup Partial → Throw Error
```

### 3. Secure Extractor

**Purpose**: Extract archives with security validation and sandboxing.

**Location**: `src/core/extractor.ts`

**Key Features**:
- Path traversal protection (blocks `..`, absolute paths, null bytes)
- Extraction to temporary workspace
- File-by-file validation
- Size limits (100MB per file)
- Dangerous pattern blocking

**Security Checks**:
```typescript
const DANGEROUS_PATTERNS = [
  /\.\./,           // Path traversal
  /^\//,            // Absolute paths
  /^~/,             // Home directory
  /\0/,             // Null bytes
  /[<>:"|?*]/,      // Invalid filename characters
];
```

**Flow**:
```
Extract Archive → Create Temp Workspace → Extract Each Entry
                                              ↓
                                    Validate Entry Path
                                              ↓
                                    Extract to Temp
                                              ↓
                                    Validate All Files
                                              ↓
                                    Move to Target Directory
                                              ↓
                                    Cleanup Temp
```

### 4. Transaction System

**Purpose**: Atomic operations with automatic rollback on failure.

**Location**: `src/core/transaction.ts`

**Key Features**:
- Record all file operations (create, modify, delete)
- Automatic backup before modifications
- Rollback restoration of original state
- Transaction commit/rollback
- Error aggregation for debugging

**Transaction Lifecycle**:
```
Create Transaction → Record Operations → Backup Files
                          ↓
                    Execute Changes
                          ↓
                Success? Yes → Commit → Cleanup Backups
                          ↓ No
                    Rollback → Restore Backups → Remove Created Files → Cleanup
```

### 5. Metadata System

**Purpose**: Manage project metadata and feature tracking.

**Location**: `src/core/metadata.ts`

**Key Features**:
- `.slyxup/project.json` initialization
- Framework and feature tracking
- Duplicate installation prevention
- Version tracking
- Project root discovery

**Metadata Structure**:
```typescript
{
  framework: string;
  features: string[];
  templateVersion: string;
  cliVersion?: string;
  createdAt?: string;
  updatedAt?: string;
}
```

### 6. Template Installer

**Purpose**: Install project templates with validation and metadata.

**Location**: `src/core/template-installer.ts`

**Installation Pipeline**:
```
1. Validate directory doesn't exist
2. Create transaction
3. Load registry
4. Resolve template (with version)
5. Download archive
6. Verify integrity (SHA-256)
7. Create project directory
8. Extract template
9. Initialize metadata (.slyxup/project.json)
10. Commit transaction
    ↓ Error at any step
    Rollback → Remove all changes → Report failure
```

### 7. Feature Installer

**Purpose**: Add features to existing projects with compatibility validation.

**Location**: `src/core/feature-installer.ts`

**Installation Pipeline**:
```
1. Find project root (search for .slyxup/)
2. Load project metadata
3. Validate not already installed
4. Load registry
5. Resolve feature (with version)
6. Validate framework compatibility
7. Download archive
8. Verify integrity
9. Extract to temp workspace
10. Read feature manifest (feature.json)
11. Apply manifest:
    - Create new files
    - Backup files to modify
    - Merge dependencies
    - Update package.json
12. Update project metadata
13. Commit transaction
    ↓ Error at any step
    Rollback → Restore backups → Remove created files → Report failure
```

## Utility Systems

### Logger

**Purpose**: Structured logging for debugging and audit trails.

**Location**: `src/utils/logger.ts`

**Features**:
- Daily log files in `~/.slyxup/logs/`
- Log levels: DEBUG, INFO, WARN, ERROR
- Automatic cleanup (7-day retention)
- ISO timestamps
- JSON data serialization

### Hash Verification

**Purpose**: Ensure file integrity with SHA-256 hashing.

**Location**: `src/utils/hash.ts`

**Functions**:
- `generateSHA256(filePath)` - Generate hash from file
- `verifySHA256(filePath, expectedHash)` - Verify file integrity
- `verifyBufferSHA256(buffer, expectedHash)` - Verify buffer integrity

### File Operations

**Purpose**: Safe file system operations with validation.

**Location**: `src/utils/file.ts`

**Key Functions**:
- `BackupManager` - File backup and restoration
- `safeReadJSON` / `safeWriteJSON` - JSON operations with error handling
- `ensureDir` - Recursive directory creation
- `pathExists` - Safe existence checking
- `isPathSafe` - Path traversal validation
- `removeDir` - Safe recursive deletion

### Merge Utilities

**Purpose**: Safely merge JSON objects and dependencies.

**Location**: `src/utils/merge.ts`

**Functions**:
- `deepMerge` - Deep merge objects with array deduplication
- `mergeDependencies` - Merge dependencies with conflict detection
- `mergeScripts` - Merge npm scripts intelligently

## Security Architecture

### 1. Integrity Verification

All downloaded files are verified using SHA-256 hashes from the registry:

```typescript
// Download
const archivePath = await downloader.download({
  url: template.downloadUrl,
  sha256: template.sha256, // Verified automatically
});
```

### 2. Path Traversal Protection

Multiple layers of validation:

```typescript
// Pattern blocking
const DANGEROUS_PATTERNS = [/\.\./, /^\//, /^~/, /\0/];

// Path validation
const resolvedPath = path.resolve(baseDir, entryPath);
if (!resolvedPath.startsWith(baseDir)) {
  throw new ValidationError('Path traversal attempt');
}
```

### 3. Sandboxed Extraction

Archives are extracted to temporary directories:

```typescript
const tempWorkspace = path.join(os.homedir(), '.slyxup', 'temp', uuid);
await extractor.extract(archive, tempWorkspace);
// Validate all files
await validateExtractedFiles(tempWorkspace);
// Only then move to target
await moveToTarget(tempWorkspace, projectDir);
```

### 4. Transactional Safety

All operations are wrapped in transactions:

```typescript
const transaction = transactionManager.createTransaction(id);
try {
  await transaction.backupFile(packageJsonPath);
  await modifyFile(packageJsonPath);
  await transaction.commit();
} catch (error) {
  await transaction.rollback(); // Automatic restoration
  throw error;
}
```

## Cache Architecture

Cache structure in `~/.slyxup/`:

```
~/.slyxup/
├── cache/
│   ├── registry.json          # Registry cache (1h TTL)
│   └── downloads/
│       ├── react-1.0.0.tar.gz
│       └── tailwind-3.4.0.tar.gz
├── logs/
│   ├── slyxup-2024-01-01.log
│   └── slyxup-2024-01-02.log
└── temp/
    └── extract-{timestamp}-{random}/
```

**Cache Invalidation**:
- Registry: 1-hour TTL
- Downloads: SHA-256 validation before reuse
- Temp: Cleanup after extraction
- Logs: 7-day retention

## Error Handling

### Error Hierarchy

```
SlyxUpError (base)
├── RegistryError
├── ValidationError
├── IntegrityError
├── FileSystemError
├── InstallationError
└── RollbackError
```

### Error Flow

```
Error Occurs → Log to File → Rollback Transaction → Display User Message → Exit
```

## Extension Points

### Adding New Templates

1. Create template archive with project files
2. Upload to CDN
3. Generate SHA-256 hash
4. Add to registry.json:

```json
{
  "templates": {
    "new-framework": [{
      "name": "new-framework",
      "version": "1.0.0",
      "downloadUrl": "https://cdn.slyxup.online/templates/new-framework-1.0.0.tar.gz",
      "sha256": "hash..."
    }]
  }
}
```

No CLI code changes required!

### Adding New Features

1. Create feature files
2. Create `feature.json` manifest
3. Package as tar.gz
4. Upload to CDN
5. Add to registry.json:

```json
{
  "features": {
    "new-feature": [{
      "name": "new-feature",
      "version": "1.0.0",
      "frameworks": ["react", "vue"],
      "downloadUrl": "https://cdn.slyxup.online/features/new-feature-1.0.0.tar.gz",
      "sha256": "hash..."
    }]
  }
}
```

No CLI code changes required!

## Performance Optimizations

1. **Registry Caching** - 1-hour TTL reduces network calls
2. **Download Caching** - Reuse validated archives
3. **Parallel Operations** - Independent downloads/extractions
4. **Lazy Loading** - Load registry only when needed
5. **Stream Processing** - Stream-based extraction for large files

## Testing Strategy

### Unit Tests
- Individual utility functions
- Schema validation
- Error handling

### Integration Tests
- End-to-end template installation
- Feature installation with rollback
- Cache management

### Security Tests
- Path traversal attempts
- Malformed archives
- Hash mismatch scenarios
- Large file handling

## Future Enhancements

1. **Parallel Downloads** - Download multiple features simultaneously
2. **Incremental Updates** - Smart template updates
3. **Plugin System** - Custom template sources
4. **Web Dashboard** - Visual registry management
5. **CI/CD Integration** - GitHub Actions, GitLab CI
6. **Telemetry** - Anonymous usage analytics (opt-in)

---

This architecture ensures SlyxUp CLI remains:
- **Secure** - Multiple validation layers
- **Reliable** - Transactional operations
- **Extensible** - Registry-driven
- **Maintainable** - Clear separation of concerns
- **Performant** - Smart caching and optimization
