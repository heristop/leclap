// @leclap/cli entry point, built by tsdown into dist/index.js (shebang added via the `banner` option).
// `leclap` is an umbrella dev tool — subcommands (render / diagnose / …) plus a bare-path shorthand
// so `leclap my-template.json` still renders.

import 'reflect-metadata';
import { readFileSync } from 'node:fs';
import { defineCommand, runMain } from 'citty';
import { rewriteArgv, KNOWN_COMMANDS } from './args.js';
import { render } from './commands/render.js';
import { diagnose } from './commands/diagnose.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const main = defineCommand({
  meta: { name: 'leclap', version, description: 'LeClap — create videos from JSON templates' },
  subCommands: { render, diagnose },
});

runMain(main, { rawArgs: rewriteArgv(process.argv.slice(2), KNOWN_COMMANDS) }).catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
