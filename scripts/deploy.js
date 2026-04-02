#!/usr/bin/env node

/**
 * SlyxUp CLI Deploy Script
 * Cross-platform deployment for Mac, Windows, Linux, Ubuntu
 * Works for both local testing and production deployment
 * 
 * Usage:
 *   node scripts/deploy.js          # Interactive mode
 *   node scripts/deploy.js local    # Local testing
 *   node scripts/deploy.js prod     # Production npm publish
 *   node scripts/deploy.js build    # Build only
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..');
const SLYXUP_ROOT = path.resolve(__dirname, '../..');

// Colors for terminal output (works on all platforms)
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  gray: '\x1b[90m',
};

function log(msg, color = 'reset') {
  console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(step, msg) {
  console.log(`${colors.cyan}[${step}]${colors.reset} ${msg}`);
}

function logSuccess(msg) {
  console.log(`${colors.green}✓${colors.reset} ${msg}`);
}

function logError(msg) {
  console.log(`${colors.red}✗${colors.reset} ${msg}`);
}

function logWarning(msg) {
  console.log(`${colors.yellow}⚠${colors.reset} ${msg}`);
}

// Cross-platform command execution
function runCommand(cmd, options = {}) {
  const { cwd = ROOT_DIR, silent = false, ignoreError = false } = options;
  
  try {
    if (!silent) {
      log(`  $ ${cmd}`, 'gray');
    }
    
    const result = execSync(cmd, {
      cwd,
      encoding: 'utf-8',
      stdio: silent ? 'pipe' : 'inherit',
      shell: process.platform === 'win32' ? 'cmd.exe' : '/bin/sh',
    });
    
    return { success: true, output: result };
  } catch (error) {
    if (ignoreError) {
      return { success: false, error: error.message };
    }
    throw error;
  }
}

// Get package.json data
function getPackageJson(dir = ROOT_DIR) {
  const pkgPath = path.join(dir, 'package.json');
  return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
}

// Update package.json
function updatePackageJson(dir, updates) {
  const pkgPath = path.join(dir, 'package.json');
  const pkg = getPackageJson(dir);
  const updated = { ...pkg, ...updates };
  fs.writeFileSync(pkgPath, JSON.stringify(updated, null, 2) + '\n');
  return updated;
}

// Check if npm is logged in
function isNpmLoggedIn() {
  try {
    execSync('npm whoami', { encoding: 'utf-8', stdio: 'pipe' });
    return true;
  } catch {
    return false;
  }
}

// Get current npm user
function getNpmUser() {
  try {
    return execSync('npm whoami', { encoding: 'utf-8', stdio: 'pipe' }).trim();
  } catch {
    return null;
  }
}

// Check versions across CLI, Registry, and Templates
async function checkVersionSync() {
  logStep('SYNC', 'Checking version synchronization...');
  
  const cliPkg = getPackageJson(ROOT_DIR);
  const registryPkg = getPackageJson(path.join(SLYXUP_ROOT, 'registry'));
  const templatesPkg = getPackageJson(path.join(SLYXUP_ROOT, 'templates'));
  
  // Read registry.json version
  const registryJsonPath = path.join(SLYXUP_ROOT, 'registry', 'registry.json');
  let registryVersion = 'N/A';
  if (fs.existsSync(registryJsonPath)) {
    const registryJson = JSON.parse(fs.readFileSync(registryJsonPath, 'utf-8'));
    registryVersion = registryJson.version;
  }
  
  console.log(`
  ${colors.cyan}Component Versions:${colors.reset}
  ├── CLI:             ${colors.bright}${cliPkg.version}${colors.reset}
  ├── Registry (pkg):  ${colors.bright}${registryPkg.version}${colors.reset}
  ├── Registry (json): ${colors.bright}${registryVersion}${colors.reset}
  └── Templates:       ${colors.bright}${templatesPkg.version}${colors.reset}
  `);
  
  return {
    cli: cliPkg.version,
    registry: registryPkg.version,
    registryJson: registryVersion,
    templates: templatesPkg.version,
  };
}

// Clean build artifacts
function clean() {
  logStep('CLEAN', 'Cleaning build artifacts...');
  
  const distDir = path.join(ROOT_DIR, 'dist');
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true, force: true });
    logSuccess('Removed dist/ directory');
  }
  
  // Clean node_modules/.cache if exists
  const cacheDir = path.join(ROOT_DIR, 'node_modules', '.cache');
  if (fs.existsSync(cacheDir)) {
    fs.rmSync(cacheDir, { recursive: true, force: true });
    logSuccess('Cleared node_modules cache');
  }
}

// Build the CLI
function build() {
  logStep('BUILD', 'Compiling TypeScript...');
  runCommand('npm run build');
  logSuccess('Build completed');
  
  // Verify dist directory
  const distDir = path.join(ROOT_DIR, 'dist');
  if (!fs.existsSync(distDir)) {
    throw new Error('Build failed: dist directory not created');
  }
  
  const files = fs.readdirSync(distDir);
  log(`  Built ${files.length} files`, 'gray');
}

// Run tests
function test() {
  logStep('TEST', 'Running tests...');
  const result = runCommand('npm test', { ignoreError: true });
  
  if (!result.success) {
    logWarning('Tests failed or skipped');
    return false;
  }
  
  logSuccess('Tests passed');
  return true;
}

// Lint the code
function lint() {
  logStep('LINT', 'Running ESLint...');
  const result = runCommand('npm run lint', { ignoreError: true });
  
  if (!result.success) {
    logWarning('Linting issues found');
    return false;
  }
  
  logSuccess('Linting passed');
  return true;
}

// Link for local testing
function linkLocal() {
  logStep('LINK', 'Linking CLI globally for local testing...');
  
  // Unlink first if already linked
  runCommand('npm unlink -g @slyxup/cli', { ignoreError: true, silent: true });
  
  // Link the package
  runCommand('npm link');
  
  logSuccess('CLI linked globally');
  log('  You can now run: slyxup --help', 'gray');
}

// Unlink local
function unlinkLocal() {
  logStep('UNLINK', 'Unlinking CLI from global...');
  runCommand('npm unlink -g @slyxup/cli', { ignoreError: true });
  logSuccess('CLI unlinked');
}

// Set registry URL for testing
function setLocalRegistry() {
  logStep('CONFIG', 'Configuring local registry...');
  
  const localRegistryPath = path.join(SLYXUP_ROOT, 'registry', 'local-registry.json');
  
  if (!fs.existsSync(localRegistryPath)) {
    // Create local registry from main registry
    const mainRegistryPath = path.join(SLYXUP_ROOT, 'registry', 'registry.json');
    if (fs.existsSync(mainRegistryPath)) {
      fs.copyFileSync(mainRegistryPath, localRegistryPath);
      logSuccess('Created local-registry.json from registry.json');
    } else {
      logWarning('No registry.json found to copy');
    }
  }
  
  const registryUrl = `file://${localRegistryPath}`;
  
  log(`
  To use local registry, set environment variable:
  
  ${colors.cyan}# Linux/Mac:${colors.reset}
  export SLYXUP_REGISTRY_URL="${registryUrl}"
  
  ${colors.cyan}# Windows (PowerShell):${colors.reset}
  $env:SLYXUP_REGISTRY_URL="${registryUrl}"
  
  ${colors.cyan}# Windows (CMD):${colors.reset}
  set SLYXUP_REGISTRY_URL=${registryUrl}
  `, 'gray');
  
  logSuccess('Local registry configured');
}

// Bump version
function bumpVersion(type = 'patch') {
  logStep('VERSION', `Bumping ${type} version...`);
  
  const pkg = getPackageJson();
  const [major, minor, patch] = pkg.version.split('.').map(Number);
  
  let newVersion;
  switch (type) {
    case 'major':
      newVersion = `${major + 1}.0.0`;
      break;
    case 'minor':
      newVersion = `${major}.${minor + 1}.0`;
      break;
    case 'patch':
    default:
      newVersion = `${major}.${minor}.${patch + 1}`;
  }
  
  updatePackageJson(ROOT_DIR, { version: newVersion });
  logSuccess(`Version bumped: ${pkg.version} → ${newVersion}`);
  
  return newVersion;
}

// Publish to npm
async function publishNpm(dryRun = false) {
  logStep('PUBLISH', dryRun ? 'Dry run publish...' : 'Publishing to npm...');
  
  // Check npm login
  const user = getNpmUser();
  if (!user) {
    logError('Not logged in to npm. Run: npm login');
    return false;
  }
  
  log(`  Publishing as: ${user}`, 'gray');
  
  const pkg = getPackageJson();
  
  // Verify package name
  if (!pkg.name.startsWith('@slyxup/')) {
    logWarning(`Package name should start with @slyxup/: ${pkg.name}`);
  }
  
  // Check if version already exists
  try {
    const published = execSync(`npm view ${pkg.name}@${pkg.version} version`, {
      encoding: 'utf-8',
      stdio: 'pipe',
    }).trim();
    
    if (published === pkg.version) {
      logError(`Version ${pkg.version} already published`);
      return false;
    }
  } catch {
    // Version doesn't exist, good to publish
  }
  
  const cmd = dryRun ? 'npm publish --dry-run --access public' : 'npm publish --access public';
  runCommand(cmd);
  
  if (!dryRun) {
    logSuccess(`Published @slyxup/cli@${pkg.version} to npm`);
  }
  
  return true;
}

// Interactive prompt
function prompt(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

// Interactive menu
async function interactiveMenu() {
  console.log(`
${colors.cyan}╔═══════════════════════════════════════════╗
║     ${colors.bright}SlyxUp CLI Deploy Script${colors.reset}${colors.cyan}              ║
╚═══════════════════════════════════════════╝${colors.reset}

Select deployment mode:

  ${colors.green}1)${colors.reset} Local Testing  - Build and link for local development
  ${colors.yellow}2)${colors.reset} Production     - Build, test, and publish to npm
  ${colors.blue}3)${colors.reset} Build Only     - Just compile TypeScript
  ${colors.cyan}4)${colors.reset} Check Sync     - Verify version sync across packages
  ${colors.gray}5)${colors.reset} Clean          - Remove build artifacts
  ${colors.gray}6)${colors.reset} Exit
`);

  const choice = await prompt('Enter choice (1-6): ');
  
  switch (choice) {
    case '1':
    case 'local':
      await runLocalDeploy();
      break;
    case '2':
    case 'prod':
    case 'production':
      await runProductionDeploy();
      break;
    case '3':
    case 'build':
      clean();
      build();
      break;
    case '4':
    case 'sync':
      await checkVersionSync();
      break;
    case '5':
    case 'clean':
      clean();
      break;
    case '6':
    case 'exit':
    case 'q':
      log('Bye!', 'gray');
      process.exit(0);
    default:
      logError('Invalid choice');
      await interactiveMenu();
  }
}

// Local deployment workflow
async function runLocalDeploy() {
  console.log(`\n${colors.cyan}═══ Local Testing Deployment ═══${colors.reset}\n`);
  
  await checkVersionSync();
  clean();
  build();
  linkLocal();
  setLocalRegistry();
  
  console.log(`
${colors.green}═══ Local Setup Complete ═══${colors.reset}

${colors.bright}Test commands:${colors.reset}
  slyxup --version
  slyxup list templates
  slyxup list features
  slyxup init react test-app
  slyxup add tailwind

${colors.bright}To cleanup:${colors.reset}
  npm unlink -g @slyxup/cli
  unset SLYXUP_REGISTRY_URL
`);
}

// Production deployment workflow
async function runProductionDeploy() {
  console.log(`\n${colors.yellow}═══ Production Deployment ═══${colors.reset}\n`);
  
  // Check versions
  const versions = await checkVersionSync();
  
  // Confirm
  const proceed = await prompt(`\nPublish CLI v${versions.cli} to npm? (y/n): `);
  if (proceed !== 'y' && proceed !== 'yes') {
    log('Aborted.', 'gray');
    return;
  }
  
  // Ask for version bump
  const bump = await prompt('Bump version? (patch/minor/major/no): ');
  if (['patch', 'minor', 'major'].includes(bump)) {
    bumpVersion(bump);
  }
  
  clean();
  lint();
  build();
  test();
  
  // Dry run first
  log('\nDoing dry run first...', 'gray');
  await publishNpm(true);
  
  const confirm = await prompt('\nProceed with actual publish? (y/n): ');
  if (confirm === 'y' || confirm === 'yes') {
    await publishNpm(false);
    
    console.log(`
${colors.green}═══ Production Deployment Complete ═══${colors.reset}

${colors.bright}Published:${colors.reset} @slyxup/cli@${getPackageJson().version}

${colors.bright}Verify:${colors.reset}
  npm view @slyxup/cli
  npm info @slyxup/cli version

${colors.bright}Users can install with:${colors.reset}
  npm install -g @slyxup/cli
`);
  } else {
    log('Publish cancelled.', 'gray');
  }
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'local':
      await runLocalDeploy();
      break;
    case 'prod':
    case 'production':
      await runProductionDeploy();
      break;
    case 'build':
      clean();
      build();
      break;
    case 'clean':
      clean();
      break;
    case 'link':
      linkLocal();
      break;
    case 'unlink':
      unlinkLocal();
      break;
    case 'sync':
    case 'check':
      await checkVersionSync();
      break;
    case 'publish':
      await publishNpm(args.includes('--dry-run'));
      break;
    default:
      await interactiveMenu();
  }
}

main().catch((error) => {
  logError(`Deploy failed: ${error.message}`);
  process.exit(1);
});
