import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpConfig } from './config.js';
import { registerGetTemplateSchema } from './tools/getTemplateSchema.js';
import { registerCompose } from './tools/composeVideo.js';
import { registerProbe } from './tools/probeMedia.js';
import { registerValidateTemplate } from './tools/validateTemplate.js';
import { registerRenderRemotionClip } from './tools/renderRemotionClip.js';
import { registerComposeGuide } from './prompts/composeGuide.js';

// Each tool group is registered by a small `registerXxx(server, config)` function, called from
// `createServer`. The surface is authoring-only: schema, validate, compose, probe, the Remotion
// authoring helpers, and a health-check ping.
function registerPing(server: McpServer, _config: McpConfig): void {
  server.registerTool(
    'ping',
    {
      title: 'Ping',
      description: 'Health check — returns a fixed readiness string.',
    },
    () => ({
      content: [{ type: 'text', text: 'leclap mcp ok' }],
    })
  );
}

// Side-effect-free: builds and configures the server but does NOT connect a transport, so it
// stays unit-testable. The caller (index.ts) owns transport wiring.
export function createServer(config: McpConfig): McpServer {
  const server = new McpServer({ name: 'leclap', version: '0.1.0' }, { capabilities: { tools: {}, prompts: {} } });

  registerPing(server, config);
  registerGetTemplateSchema(server);
  registerValidateTemplate(server);
  registerCompose(server, config);
  registerProbe(server, config);
  registerRenderRemotionClip(server, config);
  registerComposeGuide(server);

  return server;
}
