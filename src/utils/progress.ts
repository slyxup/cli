import chalk from 'chalk';
import type { Ora } from 'ora';

export function trackPhase(spinner: Ora, text: string) {
  const start = Date.now();
  spinner.text = text;
  spinner.start(text);

  return (completedText?: string) => {
    const label = completedText ?? text;
    const duration = ((Date.now() - start) / 1000).toFixed(2);
    spinner.succeed(chalk.green(`✓ ${label} (${duration}s)`));
  };
}
