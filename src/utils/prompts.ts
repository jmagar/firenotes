/**
 * User prompt utilities for interactive confirmations
 */

import * as readline from 'node:readline';

/**
 * Prompt user for yes/no confirmation
 *
 * @param question - Question to ask the user
 * @param defaultNo - Default to 'no' if user just presses Enter (default: true)
 * @returns Promise that resolves to true if user confirms, false otherwise
 */
export function askForConfirmation(
  question: string,
  defaultNo = true
): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      rl.close();
      const normalized = answer.trim().toLowerCase();

      // Empty answer uses default
      if (normalized === '') {
        resolve(!defaultNo);
        return;
      }

      // Accept y, yes for confirmation
      const confirmed = normalized === 'y' || normalized === 'yes';
      resolve(confirmed);
    });
  });
}
