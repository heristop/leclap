import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.js';
import { createServer } from './server.js';
import { installStdoutGuard } from './stdoutGuard.js';

// Install the stdout guard as the FIRST statement, before any tool can log. `out` is the
// genuine fd-1 writer handed to the transport; every other stdout write is diverted to stderr
// so stray `console.log` can't corrupt the JSON-RPC framing. (ESM imports hoist, but none of
// the imported modules write to stdout on load, so installing here is safe.)
const out = installStdoutGuard();

// Later tasks replace `ping` with the real tool surface (list_templates, get_template,
// get_template_schema, compose_video, probe_media). All diagnostics go to stderr — never
// `console.log`, which the guard would divert anyway.
async function main(): Promise<void> {
  const config = loadConfig();
  const server = createServer(config);
  const transport = new StdioServerTransport(process.stdin, out);
  await server.connect(transport);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
