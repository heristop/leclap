import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { After, AfterAll, Before, setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// A real render through the forked worker takes a few seconds.
setDefaultTimeout(120_000);

// dist/index.js lives two levels up from features/support/.
const serverEntry = fileURLToPath(new URL('../../dist/index.js', import.meta.url));

// Per-tool latency, collected across all scenarios and printed as an efficiency table at the end.
export interface ToolTiming {
  tool: string;
  ms: number;
}
export const timings: ToolTiming[] = [];

export class AgentWorld extends World {
  client?: Client;
  transport?: StdioClientTransport;
  baseDir = '';
  outputPath = '';
  lastResult: unknown;
  // Duration (ms) of the most recent timed tool/prompt call — asserted by the efficiency step.
  lastDurationMs = 0;

  requireClient(): Client {
    if (!this.client) {
      throw new Error('MCP client is not connected');
    }

    return this.client;
  }

  // Wrap a call, record its wall-clock duration under `label`, and remember it for the timing step.
  async timed<T>(label: string, run: (client: Client) => Promise<T>): Promise<T> {
    const client = this.requireClient();
    const started = performance.now();
    const result = await run(client);
    this.lastDurationMs = performance.now() - started;
    timings.push({ tool: label, ms: this.lastDurationMs });

    return result;
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

// Print a per-tool efficiency table (slowest first) to stderr so it surfaces in CI logs.
AfterAll(function () {
  if (timings.length === 0) {
    return;
  }

  const rows = [...timings].sort((a, b) => b.ms - a.ms);
  const width = Math.max(...rows.map((r) => r.tool.length));
  const lines = rows.map((r) => `  ${r.tool.padEnd(width)}  ${r.ms.toFixed(1).padStart(8)} ms`);
  process.stderr.write(`\nTool efficiency (wall-clock per call):\n${lines.join('\n')}\n`);
});
