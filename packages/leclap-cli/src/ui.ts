import pc from 'picocolors';

// Output formatters for the CLI. Each returns a styled string; callers console.log the result.
// One symbol per intent: ✓ success, ✗ failure, › step, dimmed hint, bold heading.

export const success = (text: string): string => `${pc.green('✓')} ${text}`;

export const fail = (text: string): string => `${pc.red('✗')} ${text}`;

export const step = (text: string): string => `  ${pc.cyan('›')} ${text}`;

export const hint = (text: string): string => pc.dim(text);

export const heading = (text: string): string => pc.bold(text);
