# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2024-01-01

### Added

#### Core Features
- **Registry-driven architecture** with remote registry support
- **Secure template installation** with SHA-256 integrity verification
- **Modular feature system** with framework compatibility validation
- **Transactional operations** with automatic rollback on failure
- **Smart cache management** with persistent caching and validation
- **Project metadata tracking** in `.slyxup/project.json`
- **Structured logging** to `~/.slyxup/logs/`

#### Commands
- `slyxup init <framework> <project-name>` - Initialize new projects
- `slyxup add <feature>` - Add features to existing projects
- `slyxup list templates` - List available templates
- `slyxup list features` - List available features
- `slyxup cache info` - Show cache information
- `slyxup cache clear` - Clear all cached files

#### Security
- Path traversal protection in archive extraction
- Sandboxed extraction to temporary workspace
- SHA-256 hash verification for all downloads
- Safe file modification with automatic backups
- Validation of all file paths before writing

#### Developer Experience
- TypeScript with strict mode
- Comprehensive error handling with custom error classes
- Progress indicators for long-running operations
- Colored terminal output with chalk
- Clear, actionable error messages

#### Documentation
- Complete README with usage examples
- Detailed architecture documentation
- Contributing guidelines
- Quick start guide
- Registry documentation

#### Testing & CI/CD
- Jest test framework setup
- GitHub Actions CI workflow
- GitHub Actions publish workflow
- ESLint and Prettier configuration
- Code coverage reporting

### Technical Details

#### Dependencies
- `commander` - CLI framework
- `chalk` - Terminal colors
- `ora` - Spinners and progress indicators
- `inquirer` - Interactive prompts
- `node-fetch` - HTTP requests
- `tar` - Archive extraction
- `zod` - Schema validation

#### Architecture
- Modular core system (registry, downloader, extractor, transaction)
- Utility layer (logger, hash, file operations, merge)
- Command layer (init, add, cache, list)
- Type-safe schemas with Zod validation
- Custom error hierarchy

#### Cache System
- Registry cache with 1-hour TTL
- Download cache with integrity validation
- Temporary extraction workspace
- Automatic log cleanup (7-day retention)

---

## [Unreleased]

### Planned Features
- Vue.js template support
- Next.js template support
- Svelte template support
- Angular template support
- Interactive template/feature selection
- Project upgrade command
- Plugin system for custom templates
- Web dashboard for registry management
- CI/CD integrations

---

## Release Notes

### Version 1.0.0 - Initial Release

This is the first production-ready release of SlyxUp CLI. It provides a secure, registry-driven architecture for project scaffolding with the following highlights:

**Security First**: Every file is verified with SHA-256 hashing, and all extractions are sandboxed with path traversal protection.

**Transactional Operations**: Installations are atomic - if anything fails, all changes are automatically rolled back.

**Registry-Driven**: Templates and features are defined in a remote registry, allowing updates without CLI changes.

**Production Grade**: Built with TypeScript, comprehensive error handling, structured logging, and extensive documentation.

**Developer Friendly**: Clear error messages, progress indicators, smart caching, and beginner-friendly documentation.

---

## Migration Guides

### From 0.x to 1.0.0

Version 1.0.0 is the initial release. No migration needed.

---

## Support

For questions or issues:
- GitHub Issues: https://github.com/slyxup/cli/issues
- Discord: https://discord.gg/slyxup
- Email: support@slyxup.online
