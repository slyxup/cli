# Registry Documentation

This document describes the structure and requirements for the SlyxUp registry.

## Registry URL

The production registry is hosted at:
```
https://registry.slyxup.online/registry.json
```

## Registry Schema

```typescript
{
  version: string;                    // Registry schema version
  templates: {
    [framework: string]: Template[];  // Templates grouped by framework
  };
  features: {
    [name: string]: Feature[];        // Features grouped by name
  };
}
```

### Template Schema

```typescript
{
  name: string;           // Template name (e.g., "react")
  version: string;        // Template version (semantic versioning)
  description: string;    // Human-readable description
  framework: string;      // Framework identifier
  downloadUrl: string;    // HTTPS URL to .tar.gz archive
  sha256: string;         // SHA-256 hash of archive (64 hex chars)
  size?: number;          // Optional file size in bytes
}
```

### Feature Schema

```typescript
{
  name: string;           // Feature name (e.g., "tailwind")
  version: string;        // Feature version
  description: string;    // Human-readable description
  frameworks: string[];   // Compatible frameworks
  downloadUrl: string;    // HTTPS URL to .tar.gz archive
  sha256: string;         // SHA-256 hash of archive (64 hex chars)
  dependencies?: string[];     // npm package dependencies
  peerDependencies?: string[]; // npm peer dependencies
}
```

## Example Registry

```json
{
  "version": "1.0.0",
  "templates": {
    "react": [
      {
        "name": "react",
        "version": "1.0.0",
        "description": "React 18 starter with TypeScript and Vite",
        "framework": "react",
        "downloadUrl": "https://cdn.slyxup.online/templates/react-1.0.0.tar.gz",
        "sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        "size": 1024000
      }
    ],
    "vue": [
      {
        "name": "vue",
        "version": "1.0.0",
        "description": "Vue 3 starter with TypeScript and Vite",
        "framework": "vue",
        "downloadUrl": "https://cdn.slyxup.online/templates/vue-1.0.0.tar.gz",
        "sha256": "d7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592"
      }
    ]
  },
  "features": {
    "tailwind": [
      {
        "name": "tailwind",
        "version": "3.4.0",
        "description": "Tailwind CSS v3.4 with PostCSS",
        "frameworks": ["react", "vue", "nextjs"],
        "downloadUrl": "https://cdn.slyxup.online/features/tailwind-3.4.0.tar.gz",
        "sha256": "c3ab8ff13720e8ad9047dd39466b3c8974e592c2fa383d4a3960714caef0c4f2",
        "dependencies": ["tailwindcss", "postcss", "autoprefixer"]
      }
    ],
    "shadcn": [
      {
        "name": "shadcn",
        "version": "1.0.0",
        "description": "shadcn/ui component library",
        "frameworks": ["react", "nextjs"],
        "downloadUrl": "https://cdn.slyxup.online/features/shadcn-1.0.0.tar.gz",
        "sha256": "5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8"
      }
    ],
    "lucide": [
      {
        "name": "lucide",
        "version": "1.0.0",
        "description": "Lucide icon library",
        "frameworks": ["react", "vue", "nextjs"],
        "downloadUrl": "https://cdn.slyxup.online/features/lucide-1.0.0.tar.gz",
        "sha256": "098f6bcd4621d373cade4e832627b4f6"
      }
    ]
  }
}
```

## Creating Templates

### Template Structure

A template archive should contain:

```
template-name-version/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
├── public/
│   └── vite.svg
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   └── index.css
└── README.md
```

### Creating Archive

```bash
# Create archive
tar -czf react-1.0.0.tar.gz -C template-directory .

# Generate SHA-256 hash
sha256sum react-1.0.0.tar.gz
# or on macOS
shasum -a 256 react-1.0.0.tar.gz
```

### Upload to CDN

Upload the archive to your CDN and get the public URL.

## Creating Features

### Feature Structure

A feature archive should contain:

```
feature-name-version/
├── feature.json           # Required manifest
├── tailwind.config.js     # Files to create
├── postcss.config.js
└── patches/
    └── src/
        └── index.css      # Files to modify (patches)
```

### Feature Manifest (feature.json)

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
  },
  "devDependencies": {},
  "scripts": {
    "build:css": "tailwindcss -i ./src/index.css -o ./dist/output.css"
  }
}
```

### Creating Archive

```bash
# Create archive
tar -czf tailwind-3.4.0.tar.gz -C feature-directory .

# Generate SHA-256 hash
sha256sum tailwind-3.4.0.tar.gz
```

## Versioning

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

Examples:
- `1.0.0` - Initial release
- `1.1.0` - Added new feature
- `1.1.1` - Bug fix
- `2.0.0` - Breaking change

## Best Practices

### Security

1. **Always use HTTPS** for download URLs
2. **Generate accurate SHA-256 hashes** - This is critical for security
3. **Keep archives small** - Users download these files
4. **Validate all files** before creating archives

### Compatibility

1. **Test features** with all listed frameworks
2. **Document breaking changes** clearly
3. **Maintain backwards compatibility** when possible
4. **Use peer dependencies** wisely

### Maintenance

1. **Update regularly** to latest stable versions
2. **Deprecate old versions** gracefully
3. **Document migration paths** for major versions
4. **Monitor download statistics**

## Testing Registry Changes

### Local Testing

Create a local registry file:

```json
// local-registry.json
{
  "version": "1.0.0",
  "templates": {
    "react": [...]
  },
  "features": {
    "tailwind": [...]
  }
}
```

Modify the CLI to use local registry:

```typescript
// For testing only - don't commit
const REGISTRY_URL = 'http://localhost:3000/registry.json';
```

Serve locally:

```bash
npx http-server . -p 3000 --cors
```

Test installation:

```bash
slyxup init react test-app
```

### Validation

Before deploying to production:

1. ✅ All SHA-256 hashes are correct
2. ✅ All download URLs are accessible
3. ✅ Archives extract without errors
4. ✅ Features work with listed frameworks
5. ✅ No path traversal vulnerabilities
6. ✅ JSON schema is valid

## Deployment

### Production Checklist

- [ ] Update `version` field in registry
- [ ] Test all new templates locally
- [ ] Test all new features locally
- [ ] Verify all SHA-256 hashes
- [ ] Check all download URLs are accessible
- [ ] Validate JSON schema
- [ ] Deploy to CDN
- [ ] Update production registry.json
- [ ] Clear CDN cache
- [ ] Test production installation

### CDN Configuration

Recommended CDN settings:

- **Cache-Control**: `public, max-age=3600` (1 hour)
- **Content-Type**: `application/json` for registry.json
- **Content-Type**: `application/gzip` for .tar.gz files
- **CORS**: Enabled
- **HTTPS**: Required

## Support

For questions about the registry:

- Open an issue: https://github.com/slyxup/registry/issues
- Email: registry@slyxup.online
- Discord: https://discord.gg/slyxup

---

Last updated: 2024-01-01
