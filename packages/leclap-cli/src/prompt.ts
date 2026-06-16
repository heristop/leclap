import { createInterface } from 'node:readline/promises';

// A minimal yes/no prompt — no prompt-library dependency. In a non-interactive context (CI, piped
// stdin) there's no one to answer, so it returns the default instead of hanging.
export async function confirm(message: string, defaultYes = true): Promise<boolean> {
  if (!process.stdin.isTTY) {
    return defaultYes;
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });

  try {
    const answer = (await rl.question(`${message} ${defaultYes ? '(Y/n)' : '(y/N)'} `)).trim().toLowerCase();

    if (answer === '') {
      return defaultYes;
    }

    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}
