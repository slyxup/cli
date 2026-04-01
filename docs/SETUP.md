# Multi-Repository Setup Guide

This guide explains the recommended repository structure for the SlyxUp ecosystem.

## Repository Overview

The SlyxUp platform consists of multiple repositories:

### 1. **slyxup-cli** (Public)
The main CLI tool that users install.

**Repository**: `github.com/slyxup/cli`

**Purpose**: Core CLI application

**Contains**:
- CLI source code
- Core functionality (registry, downloader, extractor)
- Commands (init, add, cache, list)
- Documentation
- Tests

**Visibility**: Public

**Setup**:
```bash
git init
git add .
git commit -m "Initial commit: Production-grade CLI v1.0.0"
git branch -M main
git remote add origin git@github.com:slyxup/cli.git
git push -u origin main
```

### 2. **slyxup-registry** (Public)
Registry server and configuration.

**Repository**: `github.com/slyxup/registry`

**Purpose**: Host the registry.json and manage templates/features

**Contains**:
- `registry.json` - Main registry file
- Documentation for adding templates/features
- Validation scripts
- Registry server (optional)

**Visibility**: Public (allows community contributions)

**Setup**:
```bash
mkdir slyxup-registry
cd slyxup-registry

# Create registry.json
cat > registry.json << 'EOF'
{
  "version": "1.0.0",
  "templates": {},
  "features": {}
}
EOF

git init
git add .
git commit -m "Initial registry setup"
git branch -M main
git remote add origin git@github.com:slyxup/registry.git
git push -u origin main
```

### 3. **slyxup-templates** (Public)
Official template source code.

**Repository**: `github.com/slyxup/templates`

**Purpose**: Source code for official templates

**Contains**:
```
templates/
├── react/
│   ├── v1.0.0/
│   │   ├── package.json
│   │   ├── src/
│   │   └── ...
│   └── v1.1.0/
├── vue/
├── nextjs/
└── svelte/
```

**Visibility**: Public

**Setup**:
```bash
mkdir slyxup-templates
cd slyxup-templates

mkdir -p templates/react/v1.0.0
mkdir -p templates/vue/v1.0.0

git init
git add .
git commit -m "Initial templates repository"
git branch -M main
git remote add origin git@github.com:slyxup/templates.git
git push -u origin main
```

### 4. **slyxup-features** (Public)
Official feature packages.

**Repository**: `github.com/slyxup/features`

**Purpose**: Source code for official features

**Contains**:
```
features/
├── tailwind/
│   ├── v3.4.0/
│   │   ├── feature.json
│   │   ├── tailwind.config.js
│   │   └── postcss.config.js
│   └── v3.3.0/
├── shadcn/
├── lucide/
└── eslint/
```

**Visibility**: Public

**Setup**:
```bash
mkdir slyxup-features
cd slyxup-features

mkdir -p features/tailwind/v3.4.0
mkdir -p features/shadcn/v1.0.0

git init
git add .
git commit -m "Initial features repository"
git branch -M main
git remote add origin git@github.com:slyxup/features.git
git push -u origin main
```

### 5. **slyxup-cdn** (Private - Optional)
CDN management and build scripts.

**Repository**: `github.com/slyxup/cdn` (Private)

**Purpose**: Build and deploy templates/features to CDN

**Contains**:
- Build scripts for creating .tar.gz archives
- SHA-256 hash generation
- Upload scripts for CDN
- CDN deployment configuration

**Visibility**: Private (contains deployment credentials)

**Setup**:
```bash
mkdir slyxup-cdn
cd slyxup-cdn

# Create build script
cat > build.sh << 'EOF'
#!/bin/bash
# Build and upload templates/features to CDN
EOF

chmod +x build.sh

git init
git add .
git commit -m "Initial CDN management setup"
git branch -M main
git remote add origin git@github.com:slyxup/cdn.git
git push -u origin main
```

### 6. **slyxup-docs** (Public - Optional)
Documentation website.

**Repository**: `github.com/slyxup/docs`

**Purpose**: Documentation website (docs.slyxup.online)

**Contains**:
- Documentation site (VitePress, Docusaurus, etc.)
- Guides and tutorials
- API documentation
- Examples

**Visibility**: Public

**Setup**:
```bash
mkdir slyxup-docs
cd slyxup-docs

npm init -y
npm install -D vitepress

git init
git add .
git commit -m "Initial docs site"
git branch -M main
git remote add origin git@github.com:slyxup/docs.git
git push -u origin main
```

## Recommended Workflow

### For CLI Development

1. **Clone CLI repo**
   ```bash
   git clone git@github.com:slyxup/cli.git
   cd cli
   npm install
   ```

2. **Make changes**
   ```bash
   git checkout -b feature/my-feature
   # Make changes
   npm test
   npm run build
   ```

3. **Submit PR**
   ```bash
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

### For Adding Templates

1. **Clone templates repo**
   ```bash
   git clone git@github.com:slyxup/templates.git
   cd templates
   ```

2. **Create template**
   ```bash
   mkdir -p templates/my-framework/v1.0.0
   # Add template files
   ```

3. **Build and deploy** (requires CDN access)
   ```bash
   cd templates/my-framework/v1.0.0
   tar -czf my-framework-1.0.0.tar.gz .
   sha256sum my-framework-1.0.0.tar.gz
   # Upload to CDN
   ```

4. **Update registry**
   ```bash
   # Edit registry repo
   # Add new template entry with SHA-256 hash
   ```

### For Adding Features

1. **Clone features repo**
   ```bash
   git clone git@github.com:slyxup/features.git
   cd features
   ```

2. **Create feature**
   ```bash
   mkdir -p features/my-feature/v1.0.0
   # Add feature files and feature.json
   ```

3. **Build and deploy**
   ```bash
   cd features/my-feature/v1.0.0
   tar -czf my-feature-1.0.0.tar.gz .
   sha256sum my-feature-1.0.0.tar.gz
   # Upload to CDN
   ```

4. **Update registry**
   ```bash
   # Edit registry repo
   # Add new feature entry
   ```

## GitHub Organization

Create a GitHub organization: `github.com/slyxup`

### Team Structure

1. **Maintainers** - Full access to all repos
2. **Contributors** - Write access to public repos
3. **Community** - Read access, can submit PRs

### Repository Settings

#### Public Repos (cli, templates, features, registry, docs)
- ✅ Issues enabled
- ✅ Pull requests enabled
- ✅ GitHub Actions enabled
- ✅ Branch protection on `main`
- ✅ Require PR reviews
- ✅ Require status checks

#### Private Repos (cdn)
- ✅ Limited team access
- ✅ GitHub Actions for CI/CD
- ✅ Secrets for CDN credentials

## CI/CD Setup

### CLI Repository

**GitHub Actions**:
- Run tests on every PR
- Run linter on every PR
- Publish to npm on release

### Templates Repository

**GitHub Actions**:
- Validate template structure
- Build archives
- Generate SHA-256 hashes
- Upload to CDN (on tag)

### Registry Repository

**GitHub Actions**:
- Validate JSON schema
- Check all download URLs
- Deploy to CDN (on push to main)

## Hosting & Deployment

### Registry Hosting

**Option 1: GitHub Pages**
```yaml
# .github/workflows/deploy.yml
name: Deploy Registry
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./
```

**Option 2: Cloudflare Pages** (Recommended)
- Automatic deployments from GitHub
- Global CDN
- Free tier available
- Custom domain support

### CDN for Archives

**Recommended Options**:

1. **Cloudflare R2** (Recommended)
   - S3-compatible storage
   - Free tier: 10GB storage
   - No egress fees
   - Fast global CDN

2. **AWS S3 + CloudFront**
   - Highly reliable
   - Pay-as-you-go pricing
   - Global CDN

3. **GitHub Releases** (Free option)
   - Attach archives to GitHub releases
   - Use GitHub's CDN
   - Version tracking built-in

## Domain Setup

Register domains:
- `slyxup.online` - Main website
- `docs.slyxup.online` - Documentation
- `registry.slyxup.online` - Registry endpoint
- `cdn.slyxup.online` - CDN for archives

## Monorepo Alternative

If you prefer a monorepo approach, use:

**Repository**: `github.com/slyxup/slyxup`

**Structure**:
```
slyxup/
├── packages/
│   ├── cli/           # Main CLI
│   ├── core/          # Shared core logic
│   └── utils/         # Shared utilities
├── templates/         # Template source
├── features/          # Feature source
├── registry/          # Registry files
├── docs/              # Documentation
└── scripts/           # Build & deploy scripts
```

**Tools**:
- Turborepo or Nx for monorepo management
- pnpm workspaces
- Shared TypeScript config

## Next Steps

1. **Set up GitHub organization**
   - Create `github.com/slyxup`
   - Create repositories
   - Set up teams

2. **Configure CI/CD**
   - Add GitHub Actions workflows
   - Set up npm publishing
   - Configure CDN deployment

3. **Set up hosting**
   - Register domain
   - Set up Cloudflare/AWS
   - Configure DNS

4. **Create initial content**
   - Add first template (React)
   - Add first feature (Tailwind)
   - Update registry

5. **Launch**
   - Publish CLI to npm
   - Announce on social media
   - Write blog post

---

For questions about repository setup:
- Email: dev@slyxup.online
- Discord: https://discord.gg/slyxup
