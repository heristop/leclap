// Must precede any import that reaches the core (`ffmpeg-video-composer`): the core uses tsyringe,
// which requires a reflect-metadata polyfill at load time. `get_template_schema` imports the core's
// TemplateDescriptorSchema value, so the polyfill has to be installed before the server module loads.
import 'reflect-metadata';
// MUST stay above ./server.js (and anything pulling in ffmpeg-video-composer): importing this runs
// installStdoutGuard() before the core's import graph is evaluated, so a load-time stdout write from
// the core can't corrupt the JSON-RPC framing. `out` is the genuine fd-1 writer for the transport.
import { out } from './stdout-guard-install.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

import { loadConfig } from './config.js';
import { createServer } from './server.js';

// The tool surface is authoring-only (get_template_schema, validate_template, compose_video,
// probe_media, the Remotion authoring helpers, ping). All diagnostics go to stderr — never
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
