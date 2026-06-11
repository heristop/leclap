import 'reflect-metadata';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

// Placeholder entry — later tasks replace the stub tool with the real tool surface
// (list_templates, get_template, get_template_schema, compose_video, probe_media).
async function main(): Promise<void> {
  const server = new McpServer({
    name: '@leclap/mcp',
    version: '0.1.0',
  });

  server.registerTool(
    'ping',
    {
      description: 'Health check — returns "pong".',
    },
    async () => ({
      content: [{ type: 'text', text: 'pong' }],
    })
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  process.stderr.write(`@leclap/mcp failed to start: ${String(error)}\n`);
  process.exit(1);
});
