# Getting Started - Developer Guide

This guide will help you get the SlyxUp CLI up and running for development.

## Prerequisites

- **Node.js** >= 18.0.0
- **npm** or **yarn**
- **Git**

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/slyxup/cli.git
cd cli
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Build the Project

```bash
npm run build
```

You should see output in the `dist/` directory.

### 4. Link CLI Locally

```bash
npm link
```

Now you can use `slyxup` command globally during development.

### 5. Test the CLI

```bash
slyxup --version
# Output: 1.0.0

slyxup --help
# Shows all available commands
```

## Development Workflow

### Watch Mode

Run TypeScript compiler in watch mode:

```bash
npm run dev
```

This will automatically recompile when you make changes.

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

### Linting

```bash
# Check for lint errors
npm run lint

# Auto-fix lint errors
npm run lint -- --fix
```

### Formatting

```bash
# Format all files
npm run format
```

## Project Structure Overview

```
src/
├── cli.ts              # Entry point
├── commands/           # Command implementations
├── core/              # Core business logic
├── utils/             # Shared utilities
└── types/             # TypeScript types
```

## Making Changes

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Your Changes

Edit files in `src/` directory.

### 3. Test Your Changes

```bash
# Build
npm run build

# Test manually
slyxup init react test-app
```

### 4. Run Tests & Lint

```bash
npm test
npm run lint
npm run format
```

### 5. Commit Your Changes

```bash
git add .
git commit -m "feat: add your feature description"
```

Use [Conventional Commits](https://www.conventionalcommits.org/):
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Tests
- `chore:` - Maintenance

### 6. Push and Create PR

```bash
git push origin feature/your-feature-name
```

Then create a Pull Request on GitHub.

## Testing Without Registry

Since the registry isn't set up yet, you can test with a mock registry:

### Create Mock Registry

Create `mock-registry.json`:

```json
{
  "version": "1.0.0",
  "templates": {
    "react": [{
      "name": "react",
      "version": "1.0.0",
      "description": "Mock React template",
      "framework": "react",
      "downloadUrl": "https://github.com/vitejs/vite/archive/refs/heads/main.tar.gz",
      "sha256": "0000000000000000000000000000000000000000000000000000000000000000"
    }]
  },
  "features": {}
}
```

### Serve Locally

```bash
# In a separate terminal
cd /path/to/mock-registry
npx http-server . -p 3000 --cors
```

### Modify Registry URL (Temporarily)

In `src/core/registry.ts`, change:

```typescript
// For testing only - don't commit!
const REGISTRY_URL = 'http://localhost:3000/mock-registry.json';
```

### Test Installation

```bash
npm run build
slyxup init react test-app
```

**Remember**: Revert the registry URL before committing!

## Common Development Tasks

### Add a New Command

1. Create file in `src/commands/new-command.ts`
2. Implement command using Commander.js
3. Register in `src/cli.ts`
4. Add tests in `src/__tests__/`
5. Update README.md

Example:

```typescript
// src/commands/upgrade.ts
import { Command } from 'commander';

export function createUpgradeCommand(): Command {
  const command = new Command('upgrade');
  
  command
    .description('Upgrade project to latest version')
    .action(async () => {
      // Implementation
    });
  
  return command;
}

// src/cli.ts
import { createUpgradeCommand } from './commands/upgrade.js';
program.addCommand(createUpgradeCommand());
```

### Add a New Utility

1. Create file in `src/utils/`
2. Export functions
3. Add tests
4. Export from `src/index.ts` if public API

### Add a New Error Type

1. Add to `src/types/errors.ts`
2. Extend `SlyxUpError`
3. Use in your code

```typescript
export class NetworkError extends SlyxUpError {
  constructor(message: string, details?: unknown) {
    super(message, 'NETWORK_ERROR', details);
    this.name = 'NetworkError';
  }
}
```

## Debugging

### Enable Debug Logging

Modify `src/utils/logger.ts` to log to console:

```typescript
// Temporarily for debugging
console.log(`[${entry.level}] ${entry.message}`, entry.data);
```

### Check Log Files

```bash
# View today's log
cat ~/.slyxup/logs/slyxup-$(date +%Y-%m-%d).log

# Tail log in real-time
tail -f ~/.slyxup/logs/slyxup-$(date +%Y-%m-%d).log
```

### Debug in VS Code

Create `.vscode/launch.json`:

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/dist/cli.js",
      "args": ["init", "react", "test-app"],
      "outFiles": ["${workspaceFolder}/dist/**/*.js"],
      "sourceMaps": true
    }
  ]
}
```

Set breakpoints and press F5 to debug.

## Common Issues

### "Cannot find module" errors

```bash
# Rebuild
npm run build

# Relink
npm unlink
npm link
```

### TypeScript errors

```bash
# Check TypeScript version
npx tsc --version

# Should be >= 5.3.3
# If not:
npm install -D typescript@latest
```

### Tests failing

```bash
# Clear Jest cache
npx jest --clearCache

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Resources

- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Commander.js Documentation](https://github.com/tj/commander.js)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Node.js API Reference](https://nodejs.org/api/)

## Getting Help

- **Issues**: Check existing GitHub issues
- **Discussions**: GitHub Discussions for questions
- **Discord**: Join our community server
- **Email**: dev@slyxup.online

## Next Steps

1. **Read the Architecture**: See [ARCHITECTURE.md](./ARCHITECTURE.md)
2. **Check Open Issues**: Find something to work on
3. **Read Contributing Guide**: See [CONTRIBUTING.md](./CONTRIBUTING.md)
4. **Join Discord**: Meet the community

---

Happy coding! 🚀
