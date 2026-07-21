import pc from 'picocolors';

// Output formatters for the CLI. Each returns a styled string; callers console.log the result.
// One symbol per intent: ✓ success, ✗ failure, › step, dimmed hint, bold heading.

export function success(text: string): string {
  return `${pc.green('✓')} ${text}`;
}

export function fail(text: string): string {
  return `${pc.red('✗')} ${text}`;
}

export function step(text: string): string {
  return `  ${pc.dim('›')} ${text}`;
}

export function hint(text: string): string {
  return pc.dim(text);
}

export function heading(text: string): string {
  return pc.bold(text);
}
