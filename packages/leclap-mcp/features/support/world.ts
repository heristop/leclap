import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { After, Before, setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// A real render through the forked worker takes a few seconds.
setDefaultTimeout(120_000);

// dist/index.js lives two levels up from features/support/.
const serverEntry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

export class AgentWorld extends World {
  client?: Client;
  transport?: StdioClientTransport;
  baseDir = '';
  outputPath = '';
  lastResult: unknown;

  requireClient(): Client {
    if (!this.client) {
      throw new Error('MCP client is not connected');
    }

    return this.client;
  }
}

setWorldConstructor(AgentWorld);

Before(async function (this: AgentWorld) {
  // Output and media dir share one temp root so a rendered file lands under the
  // media dir and stays probe-able by the path guard.
  this.baseDir = await mkdtemp(path.join(os.tmpdir(), 'leclap-mcp-'));

  this.transport = new StdioClientTransport({
    command: 'node',
    args: [serverEntry],
    env: {
      ...(process.env as Record<string, string>),
      LECLAP_MCP_OUTPUT_DIR: this.baseDir,
      LECLAP_MCP_MEDIA_DIR: this.baseDir,
    },
  });

  this.client = new Client({ name: 'leclap-cucumber', version: '0.0.0' });
  await this.client.connect(this.transport);
});

After(async function (this: AgentWorld) {
  await this.client?.close();

  if (!this.baseDir) {
    return;
  }

  await rm(this.baseDir, { recursive: true, force: true });
});
