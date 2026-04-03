# SlyxUp CLI - Local Testing Guide

This guide explains how to test the SlyxUp CLI locally before publishing to npm.

## Quick Start

```bash
# From the cli folder
node scripts/deploy.js local
```

This will:
1. Build the CLI
2. Link it globally
3. Configure local registry

## Manual Setup

### 1. Build the CLI

```bash
cd cli
npm install
npm run build
```

### 2. Link Globally

```bash
npm link
```

This creates a global symlink so you can run `slyxup` from anywhere.

### 3. Configure Local Registry

Set the environment variable to use the local registry:

**Linux/Mac (bash/zsh):**
```bash
export SLYXUP_REGISTRY_URL="file:///path/to/slyxup/registry/local-registry.json"
```

**Add to ~/.bashrc or ~/.zshrc for persistence:**
```bash
echo 'export SLYXUP_REGISTRY_URL="file:///home/youruser/slyxup/registry/local-registry.json"' >> ~/.bashrc
source ~/.bashrc
```

**Windows PowerShell:**
```powershell
$env:SLYXUP_REGISTRY_URL = "file:///C:/path/to/slyxup/registry/local-registry.json"
```

**Windows CMD:**
```cmd
set SLYXUP_REGISTRY_URL=file:///C:/path/to/slyxup/registry/local-registry.json
```

### 4. Verify Installation

```bash
slyxup --version
slyxup --help
```

## Test Commands

### List Available Templates
```bash
slyxup list templates
```

### List Available Features
```bash
slyxup list features
```

### Create a New Project
```bash
slyxup init react my-test-app
cd my-test-app
npm install
npm run dev
```

### Add Features to a Project
```bash
cd my-test-app
slyxup add tailwind
slyxup add eslint prettier
```

### Test Fuzzy Search (Typo Handling)
```bash
slyxup add tailwid     # Should suggest "tailwind"
slyxup add eslin       # Should suggest "eslint"
slyxup add reactquery  # Should suggest "react-query"
```

### Dry Run Mode
```bash
slyxup add tailwind --dry-run
```

### Verbose Mode
```bash
slyxup add tailwind --verbose
```

## Development Workflow

### Watch Mode (Auto-rebuild)

In one terminal:
```bash
cd cli
npm run dev
```

In another terminal, test your changes:
```bash
slyxup list features
```

### Running Tests

```bash
cd cli
npm test
```

### Linting

```bash
npm run lint
npm run format
```

## Troubleshooting

### Command Not Found

If `slyxup` command is not found after linking:

1. Check npm global bin directory:
   ```bash
   npm config get prefix
   ```

2. Ensure it's in your PATH:
   ```bash
   export PATH="$(npm config get prefix)/bin:$PATH"
   ```

### Cache Issues

Clear the CLI cache:
```bash
slyxup cache clear
```

Or manually:
```bash
rm -rf ~/.slyxup/cache
```

### Registry Not Loading

1. Verify the registry file exists:
   ```bash
   ls -la ../registry/local-registry.json
   ```

2. Check the URL format:
   ```bash
   echo $SLYXUP_REGISTRY_URL
   ```

3. Test file URL:
   ```bash
   # Should work
   file:///home/user/slyxup/registry/local-registry.json
   
   # Also works
   /home/user/slyxup/registry/local-registry.json
   ```

### Unlink Before Publishing

Before publishing to npm, unlink the local version:
```bash
npm unlink -g slyxup
```

## Testing with Different Projects

### Test with Unknown Project Type

```bash
mkdir test-unknown && cd test-unknown
npm init -y
slyxup add tailwind
```

### Test with React Project

```bash
npm create vite@latest test-react -- --template react-ts
cd test-react
slyxup add tailwind shadcn
```

### Test with Next.js Project

```bash
npx create-next-app@latest test-next
cd test-next
slyxup add prisma trpc
```

## Full Local Environment Reset

```bash
# 1. Unlink CLI
npm unlink -g slyxup

# 2. Clean cache
rm -rf ~/.slyxup

# 3. Unset registry URL
unset SLYXUP_REGISTRY_URL

# 4. Rebuild everything
cd /path/to/slyxup
node sync.js local
```

## Using the Master Sync Script

For a complete local setup:

```bash
cd /path/to/slyxup
node sync.js local
```

This will:
1. Package all templates and features
2. Generate local-registry.json
3. Build the CLI
4. Link it globally
5. Show environment setup instructions

## Debugging Tips

### Enable Debug Logging

```bash
DEBUG=slyxup:* slyxup add tailwind
```

### Check Version Sync

```bash
cd /path/to/slyxup
node sync.js check
```

### Inspect Project Metadata

```bash
cd my-test-app
slyxup inspect
```

### Run Doctor

```bash
slyxup doctor
```

## IDE Setup

### VS Code

Install extensions:
- ESLint
- Prettier
- TypeScript

Recommended settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

### Debugging in VS Code

Add to `.vscode/launch.json`:
```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "Debug CLI",
      "program": "${workspaceFolder}/cli/dist/cli.js",
      "args": ["list", "features"],
      "cwd": "${workspaceFolder}/test-projects/test-broken-syntax",
      "env": {
        "SLYXUP_REGISTRY_URL": "file://${workspaceFolder}/registry/local-registry.json"
      }
    }
  ]
}
```
