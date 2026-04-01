# Contributing to SlyxUp CLI

Thank you for your interest in contributing to SlyxUp CLI! This document provides guidelines and instructions for contributing.

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please be respectful and professional in all interactions.

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn
- Git

### Setup Development Environment

1. **Fork the repository**

   Click the "Fork" button on GitHub to create your own copy.

2. **Clone your fork**

   ```bash
   git clone https://github.com/YOUR_USERNAME/slyxup-cli.git
   cd slyxup-cli
   ```

3. **Install dependencies**

   ```bash
   npm install
   ```

4. **Build the project**

   ```bash
   npm run build
   ```

5. **Run locally**

   ```bash
   npm start -- init react test-app
   ```

## Development Workflow

### Branch Naming

Use descriptive branch names:

- `feature/add-vue-template` - New features
- `fix/rollback-error` - Bug fixes
- `docs/update-readme` - Documentation
- `refactor/improve-logger` - Code refactoring
- `test/add-extractor-tests` - Tests

### Making Changes

1. **Create a branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Write clean, readable code
   - Follow existing code style
   - Add comments for complex logic
   - Update documentation if needed

3. **Run linter**

   ```bash
   npm run lint
   ```

4. **Format code**

   ```bash
   npm run format
   ```

5. **Run tests**

   ```bash
   npm test
   ```

6. **Commit your changes**

   ```bash
   git add .
   git commit -m "feat: add Vue template support"
   ```

   Use [Conventional Commits](https://www.conventionalcommits.org/):
   - `feat:` - New feature
   - `fix:` - Bug fix
   - `docs:` - Documentation
   - `refactor:` - Code refactoring
   - `test:` - Adding tests
   - `chore:` - Maintenance

7. **Push to your fork**

   ```bash
   git push origin feature/your-feature-name
   ```

8. **Create Pull Request**

   Go to GitHub and create a pull request from your branch.

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Avoid `any` type - use proper types or `unknown`
- Use explicit return types for functions
- Use interfaces for object shapes
- Use enums for constants

**Good:**
```typescript
interface TemplateOptions {
  framework: string;
  version?: string;
}

function installTemplate(options: TemplateOptions): Promise<void> {
  // ...
}
```

**Bad:**
```typescript
function installTemplate(options: any) {
  // ...
}
```

### Error Handling

- Use custom error classes from `src/types/errors.ts`
- Provide descriptive error messages
- Log errors with context

**Good:**
```typescript
if (!await pathExists(filePath)) {
  throw new FileSystemError(`File not found: ${filePath}`, { filePath });
}
```

**Bad:**
```typescript
if (!exists) {
  throw new Error('File not found');
}
```

### Async/Await

- Use async/await instead of callbacks
- Handle errors with try/catch
- Avoid mixing promises and callbacks

**Good:**
```typescript
async function download(url: string): Promise<void> {
  try {
    const response = await fetch(url);
    const data = await response.json();
  } catch (error) {
    logger.error('Download failed', error);
    throw new DownloadError('Failed to download', error);
  }
}
```

### Logging

- Use the logger utility for all logging
- Include relevant context in logs
- Use appropriate log levels

```typescript
logger.debug('Starting download', { url, targetPath });
logger.info('Download completed', { size: buffer.length });
logger.warn('Cache miss, fetching from remote', { url });
logger.error('Download failed', { error, url });
```

## Testing Guidelines

### Writing Tests

- Write tests for all new features
- Use descriptive test names
- Test both success and failure cases
- Mock external dependencies

**Example:**

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { MetadataManager } from '../metadata';

describe('MetadataManager', () => {
  let metadataManager: MetadataManager;

  beforeEach(() => {
    metadataManager = new MetadataManager('/test/project');
  });

  it('should initialize metadata with correct structure', async () => {
    await metadataManager.initialize('react', '1.0.0');
    
    const metadata = await metadataManager.load();
    expect(metadata.framework).toBe('react');
    expect(metadata.features).toEqual([]);
  });

  it('should throw error when adding duplicate feature', async () => {
    await metadataManager.initialize('react', '1.0.0');
    await metadataManager.addFeature('tailwind');

    await expect(
      metadataManager.addFeature('tailwind')
    ).rejects.toThrow('Feature already installed');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run in watch mode
npm run test:watch

# Generate coverage
npm test -- --coverage
```

## Adding New Features

### Adding a New Template Type

1. Create template files
2. Package as `.tar.gz`
3. Generate SHA-256 hash
4. Update registry documentation
5. Update README with example

### Adding a New Feature

1. Create feature files
2. Create `feature.json` manifest
3. Package as `.tar.gz`
4. Generate SHA-256 hash
5. Update registry documentation
6. Add tests
7. Update README

### Adding a New Command

1. Create command file in `src/commands/`
2. Implement command logic
3. Register in `src/cli.ts`
4. Add tests
5. Update README

**Example:**

```typescript
// src/commands/upgrade.ts
import { Command } from 'commander';

export function createUpgradeCommand(): Command {
  const command = new Command('upgrade');

  command
    .description('Upgrade project templates and features')
    .action(async () => {
      // Implementation
    });

  return command;
}

// src/cli.ts
import { createUpgradeCommand } from './commands/upgrade.js';
program.addCommand(createUpgradeCommand());
```

## Pull Request Process

1. **Ensure all tests pass**
   ```bash
   npm test
   ```

2. **Update documentation**
   - Update README.md if needed
   - Update ARCHITECTURE.md for architectural changes
   - Add JSDoc comments to new functions

3. **Write clear PR description**
   - What does this PR do?
   - Why is this change needed?
   - How was it tested?
   - Screenshots (if UI changes)

4. **Request review**
   - Tag relevant maintainers
   - Respond to feedback promptly
   - Make requested changes

5. **Squash commits** (if requested)
   ```bash
   git rebase -i main
   ```

## Reporting Bugs

When reporting bugs, please include:

1. **SlyxUp CLI version**
   ```bash
   slyxup --version
   ```

2. **Node.js version**
   ```bash
   node --version
   ```

3. **Operating system**

4. **Command that failed**
   ```bash
   slyxup init react my-app
   ```

5. **Error message**
   ```
   Full error output
   ```

6. **Log file** (if available)
   ```
   ~/.slyxup/logs/slyxup-YYYY-MM-DD.log
   ```

7. **Steps to reproduce**

## Feature Requests

When requesting features:

1. **Describe the feature**
   - What problem does it solve?
   - How would it work?

2. **Provide examples**
   - Show example commands
   - Show expected output

3. **Explain use cases**
   - When would you use this?
   - Who else would benefit?

## Documentation

### Code Documentation

- Use JSDoc comments for all public functions
- Include parameter descriptions
- Include return type descriptions
- Include usage examples

**Example:**

```typescript
/**
 * Download a file from a URL with integrity verification
 * 
 * @param options - Download options
 * @param options.url - URL to download from
 * @param options.sha256 - Expected SHA-256 hash
 * @param options.filename - Optional filename for cache
 * @returns Path to downloaded file
 * 
 * @throws {FileSystemError} If download fails
 * @throws {IntegrityError} If hash verification fails
 * 
 * @example
 * const path = await downloader.download({
 *   url: 'https://example.com/file.tar.gz',
 *   sha256: 'abc123...'
 * });
 */
async download(options: DownloadOptions): Promise<string> {
  // ...
}
```

### README Updates

- Keep examples up to date
- Add new features to feature list
- Update command documentation

## Release Process

Releases are handled by maintainers:

1. Update version in `package.json`
2. Update CHANGELOG.md
3. Create git tag
4. Build and publish to npm
5. Create GitHub release

## Questions?

- Open a [GitHub Discussion](https://github.com/slyxup/cli/discussions)
- Join our [Discord](https://discord.gg/slyxup)
- Email: dev@slyxup.online

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to SlyxUp CLI! 🚀
