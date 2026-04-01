import { Command } from 'commander';
import chalk from 'chalk';
import { execSync } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

import { logger } from '../utils/logger.js';

interface Check {
  name: string;
  status: 'pass' | 'warn' | 'fail';
  message: string;
}

async function findSlyxUpProjectRoot(): Promise<string | null> {
  let current = process.cwd();

  while (current !== path.dirname(current)) {
    const metadataPath = path.join(current, '.slyxup', 'project.json');
    try {
      await fs.access(metadataPath);
      return current;
    } catch {
      current = path.dirname(current);
    }
  }

  return null;
}

interface DoctorOptions {
  json?: boolean;
}

export function createDoctorCommand(): Command {
  const command = new Command('doctor');

  command
    .description('Check environment and project health')
    .option('--json', 'Output as JSON')
    .action(async (options?: DoctorOptions) => {
      const checks: Check[] = [];

      console.log();
      console.log(chalk.bold('SlyxUp Doctor'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log();

      console.log(chalk.yellow('Environment:'));

      const nodeVersion = process.version;
      const major = parseInt(nodeVersion.slice(1).split('.')[0]);
      if (major >= 18) {
        checks.push({ name: 'node', status: 'pass', message: `Node.js ${nodeVersion}` });
        console.log(chalk.green(`  ✓ Node.js ${nodeVersion}`));
      } else {
        checks.push({ name: 'node', status: 'fail', message: `Node.js ${nodeVersion} (>=18 required)` });
        console.log(chalk.red(`  ✗ Node.js ${nodeVersion} (>=18.0.0 required)`));
      }

      const packageManagers = [
        { cmd: 'npm --version', name: 'npm' },
        { cmd: 'yarn --version', name: 'yarn' },
        { cmd: 'pnpm --version', name: 'pnpm' },
        { cmd: 'bun --version', name: 'bun' },
      ];

      let pmFound = false;
      for (const pm of packageManagers) {
        try {
          const version = execSync(pm.cmd, {
            encoding: 'utf-8',
            stdio: ['pipe', 'pipe', 'ignore'],
          }).trim();
          checks.push({ name: pm.name, status: 'pass', message: `${pm.name} v${version}` });
          console.log(chalk.green(`  ✓ ${pm.name} v${version}`));
          pmFound = true;
        } catch {
          // Not installed
        }
      }

      if (!pmFound) {
        checks.push({ name: 'pm', status: 'fail', message: 'No package manager found' });
        console.log(chalk.red('  ✗ No package manager found'));
      }

      try {
        const gitVersion = execSync('git --version', { encoding: 'utf-8' }).trim();
        checks.push({ name: 'git', status: 'pass', message: gitVersion });
        console.log(chalk.green(`  ✓ ${gitVersion}`));
      } catch {
        checks.push({ name: 'git', status: 'warn', message: 'Git not found' });
        console.log(chalk.yellow('  ⚠ Git not found (optional)'));
      }

      console.log();

      const projectRoot = await findSlyxUpProjectRoot();

      console.log(chalk.yellow('Project:'));

      if (!projectRoot) {
        checks.push({ name: 'project', status: 'warn', message: 'Not in a SlyxUp project' });
        console.log(chalk.gray('  ○ Not in a SlyxUp project'));
      } else {
        checks.push({ name: 'project', status: 'pass', message: 'SlyxUp project detected' });
        console.log(chalk.green('  ✓ SlyxUp project detected'));

        try {
          const metadataPath = path.join(projectRoot, '.slyxup', 'project.json');
          const metadataContent = await fs.readFile(metadataPath, 'utf-8');
          const metadata = JSON.parse(metadataContent);

          if (metadata.template) {
            checks.push({
              name: 'template',
              status: 'pass',
              message: `Template: ${metadata.template}`,
            });
            console.log(chalk.green(`  ✓ Template: ${metadata.template}`));
          }

          const featureCount = metadata.features?.length || 0;
          checks.push({
            name: 'features',
            status: 'pass',
            message: `${featureCount} features`,
          });
          console.log(chalk.green(`  ✓ ${featureCount} features installed`));
        } catch {
          checks.push({
            name: 'metadata',
            status: 'warn',
            message: 'Could not read project metadata',
          });
          console.log(chalk.yellow('  ⚠ Could not read project metadata'));
        }

        console.log();

        console.log(chalk.yellow('Dependencies:'));

        const pkgPath = path.join(projectRoot, 'package.json');
        try {
          await fs.access(pkgPath);
          checks.push({
            name: 'package.json',
            status: 'pass',
            message: 'package.json exists',
          });
          console.log(chalk.green('  ✓ package.json exists'));
        } catch {
          checks.push({
            name: 'package.json',
            status: 'fail',
            message: 'package.json missing',
          });
          console.log(chalk.red('  ✗ package.json missing'));
        }

        const nodeModulesPath = path.join(projectRoot, 'node_modules');
        try {
          await fs.access(nodeModulesPath);
          checks.push({
            name: 'node_modules',
            status: 'pass',
            message: 'node_modules exists',
          });
          console.log(chalk.green('  ✓ node_modules exists'));
        } catch {
          checks.push({
            name: 'node_modules',
            status: 'warn',
            message: 'node_modules missing - run npm install',
          });
          console.log(
            chalk.yellow('  ⚠ node_modules missing (run npm install)')
          );
        }

        console.log();

        console.log(chalk.yellow('Configs:'));

        const configFiles = [
          { file: 'tsconfig.json', required: false },
          { file: '.gitignore', required: false },
          { file: 'tailwind.config.js', required: false },
          { file: 'tailwind.config.ts', required: false },
        ];

        for (const config of configFiles) {
          const configPath = path.join(projectRoot, config.file);
          try {
            await fs.access(configPath);
            checks.push({
              name: config.file,
              status: 'pass',
              message: `${config.file} exists`,
            });
            console.log(chalk.green(`  ✓ ${config.file}`));
          } catch {
            if (config.file === '.gitignore') {
              checks.push({
                name: config.file,
                status: 'warn',
                message: `${config.file} missing`,
              });
              console.log(chalk.yellow(`  ⚠ Missing ${config.file}`));
            }
          }
        }
      }

      console.log();
      console.log(chalk.gray('─'.repeat(40)));

      const passed = checks.filter((c) => c.status === 'pass').length;
      const warnings = checks.filter((c) => c.status === 'warn').length;
      const failed = checks.filter((c) => c.status === 'fail').length;

      const summaryParts = [];
      if (passed > 0) summaryParts.push(chalk.green(`${passed} passed`));
      if (warnings > 0) summaryParts.push(chalk.yellow(`${warnings} warnings`));
      if (failed > 0) summaryParts.push(chalk.red(`${failed} errors`));

      console.log(summaryParts.join(', '));

      if (options?.json) {
        console.log(
          JSON.stringify({ checks, summary: { passed, warnings, failed } }, null, 2)
        );
      }

      logger.info('Doctor completed', { passed, warnings, failed });

      if (failed > 0) {
        process.exit(1);
      }
    });

  return command;
}
