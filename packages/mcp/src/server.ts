import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

import type { McpConfig } from './config.js';
import { registerListTemplates } from './tools/listTemplates.js';
import { registerGetTemplate } from './tools/getTemplate.js';
import { registerGetTemplateSchema } from './tools/getTemplateSchema.js';
import { registerCompose } from './tools/composeVideo.js';

// Extension seam: each tool group is registered by a small `registerXxx(server, config)`
// function. Later tasks add the real registrars (catalog, compose, probe) and call them from
// `createServer`. For now only `registerPing` exists.
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
  const server = new McpServer({ name: 'leclap', version: '0.1.0' }, { capabilities: { tools: {} } });

  registerPing(server, config);
  registerListTemplates(server);
  registerGetTemplate(server);
  registerGetTemplateSchema(server);
  registerCompose(server, config);

  return server;
}
