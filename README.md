# SlyxUp CLI

> Production-grade CLI for secure project scaffolding with registry-driven architecture

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)](https://www.typescriptlang.org/)

## Overview

SlyxUp CLI is a **secure, registry-driven project scaffolding tool** designed with production-grade reliability similar to Angular CLI or Vite. It provides:

- **Security-first architecture** with integrity verification and sandboxed extraction
- **Registry-driven extensibility** - add templates/features without CLI updates
- **Transactional installations** with automatic rollback on failure
- **Smart caching** to minimize downloads
- **Framework-agnostic** with built-in compatibility validation

## Features

- **Secure Template Installation** - SHA-256 integrity verification, path traversal protection
- **Modular Feature System** - Add features like Tailwind, shadcn/ui, Lucide icons
- **Transactional Operations** - Atomic installations with automatic rollback
- **Smart Cache Management** - Persistent cache with integrity validation
- **Project Metadata** - Track framework, features, and versions
- **Structured Logging** - Debug-friendly logs in `~/.slyxup/logs/`

## Installation

```bash
npm install -g @slyxup/cli
```

Or use with npx (no installation required):

```bash
npx @slyxup/cli init react my-app
```

## Quick Start

### Initialize a New Project

```bash
# Create a new React project
slyxup init react my-react-app

# Navigate to project
cd my-react-app

# Install dependencies
npm install

# Start development server
npm run dev
```

### Add Features to Your Project

```bash
# Add Tailwind CSS
slyxup add tailwind

# Add shadcn/ui components
slyxup add shadcn

# Add Lucide icons
slyxup add lucide

# Install new dependencies
npm install
```

## Commands

### `slyxup init <framework> <project-name>`

Initialize a new project from a template.

```bash
slyxup init react my-app
slyxup init vue my-vue-app
slyxup init nextjs my-next-app

# Use specific version
slyxup init react my-app --version 1.2.0
```

**Options:**
- `-v, --version <version>` - Specific template version

### `slyxup add <feature>`

Add a feature to the current project.

```bash
slyxup add tailwind
slyxup add shadcn
slyxup add lucide

# Use specific version
slyxup add tailwind --version 3.4.0

# Skip npm install
slyxup add tailwind --skip-install
```

**Options:**
- `-v, --version <version>` - Specific feature version
- `--skip-install` - Skip running npm install

### `slyxup list templates|features`

List available templates or features.

```bash
# List all available templates
slyxup list templates

# List all available features
slyxup list features
```

### `slyxup cache <command>`

Manage local cache.

```bash
# Show cache information
slyxup cache info

# Clear all cached files
slyxup cache clear
```

## Architecture

SlyxUp CLI is built with a modular, security-first architecture:

```
src/
├── commands/          # CLI command implementations
│   ├── init.ts       # Template initialization
│   ├── add.ts        # Feature installation
│   ├── cache.ts      # Cache management
│   └── list.ts       # List templates/features
├── core/             # Core system modules
│   ├── registry.ts   # Registry loader with caching
│   ├── downloader.ts # Secure file downloader
│   ├── extractor.ts  # Sandboxed archive extractor
│   ├── transaction.ts # Rollback transaction system
│   ├── metadata.ts   # Project metadata manager
│   ├── template-installer.ts
│   └── feature-installer.ts
├── utils/            # Utility modules
│   ├── logger.ts     # Structured logging
│   ├── hash.ts       # SHA-256 verification
│   ├── file.ts       # Safe file operations
│   └── merge.ts      # Safe JSON/dependency merging
└── types/            # TypeScript types & schemas
    ├── schemas.ts    # Zod validation schemas
    └── errors.ts     # Custom error classes
```

For detailed architecture documentation, see [ARCHITECTURE.md](./ARCHITECTURE.md)

## Security Features

### 1. **Integrity Verification**
Every downloaded file is verified using SHA-256 hashes from the registry.

### 2. **Path Traversal Protection**
Extraction logic blocks dangerous patterns and validates all paths.

### 3. **Sandboxed Extraction**
Archives are extracted to temporary directories and validated before moving to target.

### 4. **Transactional Operations**
All installations are atomic - failures trigger automatic rollback.

### 5. **Safe File Mutations**
Files are backed up before modification with validation.

## Registry System

SlyxUp uses a remote registry at `https://registry.slyxup.online/registry.json` to define:

- **Templates** - Project scaffolds with version, download URL, and SHA-256 hash
- **Features** - Modular additions with framework compatibility
- **Versions** - Multiple versions with automatic resolution
- **Metadata** - Framework compatibility, dependencies, and more

### Registry Structure

```json
{
  "version": "1.0.0",
  "templates": {
    "react": [
      {
        "name": "react",
        "version": "1.0.0",
        "description": "React starter template",
        "framework": "react",
        "downloadUrl": "https://cdn.slyxup.online/templates/react.tar.gz",
        "sha256": "abc123..."
      }
    ]
  },
  "features": {
    "tailwind": [
      {
        "name": "tailwind",
        "version": "3.4.0",
        "description": "Tailwind CSS integration",
        "frameworks": ["react", "vue", "nextjs"],
        "downloadUrl": "https://cdn.slyxup.online/features/tailwind.tar.gz",
        "sha256": "def456..."
      }
    ]
  }
}
```

## Project Metadata

Each project contains `.slyxup/project.json`:

```json
{
  "framework": "react",
  "features": ["tailwind", "shadcn"],
  "templateVersion": "1.0.0",
  "cliVersion": "1.0.0",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T01:00:00.000Z"
}
```

This metadata:
- Controls feature installation decisions
- Prevents duplicate installations
- Tracks project history
- Enables intelligent upgrades

## Feature Manifests

Each feature archive includes `feature.json`:

```json
{
  "name": "tailwind",
  "version": "3.4.0",
  "creates": [
    "tailwind.config.js",
    "postcss.config.js"
  ],
  "modifies": [
    "package.json",
    "src/index.css"
  ],
  "dependencies": {
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.33",
    "autoprefixer": "^10.4.16"
  }
}
```

## Cache System

SlyxUp maintains a persistent cache in `~/.slyxup/`:

```
~/.slyxup/
├── cache/
│   ├── registry.json      # Cached registry (1 hour TTL)
│   └── downloads/         # Downloaded archives
├── logs/                  # Structured logs
│   └── slyxup-2024-01-01.log
└── temp/                  # Temporary extraction workspace
```

## Error Handling

SlyxUp provides clear, actionable error messages:

```
✗ Installation failed

Error: Feature tailwind is not compatible with vue3.
Supported frameworks: react, nextjs

Changes rolled back successfully
```

All errors are logged to `~/.slyxup/logs/` for debugging.

## Development

### Setup

```bash
# Clone repository
git clone https://github.com/slyxup/cli.git
cd cli

# Install dependencies
npm install

# Build
npm run build

# Run locally
npm start -- init react test-app
```

### Testing

```bash
# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm test -- --coverage
```

### Linting & Formatting

```bash
# Lint code
npm run lint

# Format code
npm run format
```

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## Roadmap

- [ ] Support for more frameworks (Vue, Svelte, Angular, Solid)
- [ ] Interactive template/feature selection
- [ ] Upgrade command for updating templates/features
- [ ] Plugin system for custom templates
- [ ] Web dashboard for registry management
- [ ] CI/CD integrations

## License

MIT License - see [LICENSE](./LICENSE) for details

## Support

- **Issues**: [GitHub Issues](https://github.com/slyxup/cli/issues)
- **Documentation**: [docs.slyxup.online](https://docs.slyxup.online)
- **Discord**: [Join our community](https://discord.gg/slyxup)

---

Built with ❤️ by the SlyxUp Team
