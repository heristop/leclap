import { createRequire } from 'node:module';
import { McpServer } from '@modelcontextprotocol/server';

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

// The tool/prompt surface is fixed for the process lifetime (only `allowRemotion`, a start-up
// config, changes it), so the 2026-07-28 `CacheableResult` fields can advertise a real freshness
// window instead of the SDK's conservative `ttlMs: 0`. `private` because the listing depends on this
// server's configuration — no shared intermediary should serve it to another client.
const LIST_CACHE_HINT = { ttlMs: 300_000, cacheScope: 'private' } as const;

// `serverInfo.version` is what every MCP client displays and what the registry listing shows, so it
// has to be the real package version. It was a hardcoded '0.1.0' and had drifted three minor
// releases behind before a pre-release handshake caught it. Read at runtime via createRequire rather
// than imported: tsdown bundles this file into dist/index.js, and a static import would inline the
// version at build time (drifting again the moment changesets bumps it) or make the bundler try to
// resolve the manifest as a module. From dist/, '../package.json' is the published manifest.
const SERVER_VERSION: string = createRequire(import.meta.url)('../package.json').version;

// Side-effect-free: builds and configures the server but does NOT connect a transport, so it
// stays unit-testable. The caller (index.ts) hands it to `serveStdio` as a per-connection factory.
export function createServer(config: McpConfig): McpServer {
  const server = new McpServer(
    { name: 'leclap', version: SERVER_VERSION },
    {
      capabilities: { tools: {}, prompts: {} },
      cacheHints: {
        'tools/list': LIST_CACHE_HINT,
        'prompts/list': LIST_CACHE_HINT,
        'server/discover': LIST_CACHE_HINT,
      },
    }
  );

  registerPing(server, config);
  registerGetTemplateSchema(server);
  registerValidateTemplate(server);
  registerCompose(server, config);
  registerProbe(server, config);

  // render_remotion_clip bundles + executes a caller-supplied entry (arbitrary local JS) — an RCE
  // surface. Register it only when the operator explicitly opted in for trusted local design-time use.
  if (config.allowRemotion) {
    registerRenderRemotionClip(server, config);
  }

  registerComposeGuide(server);

  return server;
}
