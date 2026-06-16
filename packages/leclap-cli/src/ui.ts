import pc from 'picocolors';

export function printTitle(title: string): void {
  console.log(`\n${pc.bold(pc.cyan(title))}\n`);
}

export function printBox(content: string, label: string): void {
  console.log(pc.dim(`── ${label} ──`));
  console.log(content);
}
