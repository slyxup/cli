import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import { templateInstaller } from '../core/template-installer.js';
import { registryLoader } from '../core/registry.js';
import { logger } from '../utils/logger.js';
import { pathExists } from '../utils/file.js';
import path from 'path';

export function createInitCommand(): Command {
  const command = new Command('init');

  command
    .description('Initialize a new project from a template')
    .argument('[project-name]', 'Name of the project')
    .option('-t, --template <template>', 'Template to use (react, vue, nextjs)')
    .option('-v, --version <version>', 'Specific template version')
    .option('-y, --yes', 'Skip confirmation prompts')
    .action(async (projectName?: string, options?: { template?: string; version?: string; yes?: boolean }) => {
      try {
        // Interactive mode if no project name
        let finalProjectName = projectName;
        let finalTemplate = options?.template;

        if (!finalProjectName || !finalTemplate) {
          // Load registry for template list
          await registryLoader.load();
          const templates = registryLoader.listTemplates();

          const answers = await inquirer.prompt([
            {
              type: 'input',
              name: 'projectName',
              message: 'Project name:',
              default: 'my-app',
              when: !finalProjectName,
              validate: (input: string) => {
                if (!input.trim()) return 'Project name is required';
                if (!/^[a-z0-9-_]+$/i.test(input)) return 'Invalid project name (use alphanumeric, dash, underscore)';
                return true;
              },
            },
            {
              type: 'list',
              name: 'template',
              message: 'Select a template:',
              when: !finalTemplate,
              choices: templates.map((t) => ({
                name: `${t.name} - ${t.description}`,
                value: t.name,
              })),
            },
          ]);

          finalProjectName = finalProjectName || answers.projectName;
          finalTemplate = finalTemplate || answers.template;
        }

        // Check if directory exists
        const projectPath = path.resolve(process.cwd(), finalProjectName!);
        if (await pathExists(projectPath)) {
          if (!options?.yes) {
            const { overwrite } = await inquirer.prompt([
              {
                type: 'confirm',
                name: 'overwrite',
                message: `Directory "${finalProjectName}" already exists. Continue anyway?`,
                default: false,
              },
            ]);
            if (!overwrite) {
              console.log(chalk.yellow('Aborted.'));
              return;
            }
          }
        }

        // Install template
        await templateInstaller.install({
          framework: finalTemplate!,
          projectName: finalProjectName!,
          version: options?.version,
        });

      } catch (error) {
        logger.error('Init command failed', error);

        if (error instanceof Error) {
          console.error(chalk.red(`\nError: ${error.message}`));
        } else {
          console.error(chalk.red('\nAn unexpected error occurred'));
        }

        process.exit(1);
      }
    });

  return command;
}
