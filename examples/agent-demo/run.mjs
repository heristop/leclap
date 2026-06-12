#!/usr/bin/env node
// Headless proof of the agent → deterministic video loop. No SDK dependency: this speaks the MCP
// stdio protocol (newline-delimited JSON-RPC 2.0) directly, so it runs anywhere `node` does and is
// safe to drop into CI. It drives the built @leclap/mcp server the same way an AI agent (Claude
// Desktop, Cursor) would: list → validate → compose → read the output path.
//
// Prereq: build the engine + server first (from the repo root):
//   pnpm --filter ffmpeg-video-composer build && pnpm --filter @leclap/mcp build
// Run:
//   node examples/agent-demo/run.mjs            # composes the premium_quote card (no clips needed)
//   node examples/agent-demo/run.mjs premium_titles
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..');
const serverEntry = path.join(repoRoot, 'packages', 'mcp', 'dist', 'index.js');
const outputDir = path.join(here, 'out');
const templateName = process.argv[2] ?? 'premium_quote';

// --- a tiny newline-delimited JSON-RPC client over the child's stdio ---------------------------
function createClient(child) {
  let nextId = 1;
  const pending = new Map();
  let buffer = '';

  child.stdout.on('data', (chunk) => {
    buffer += chunk.toString();
    let newline = buffer.indexOf('\n');

    while (newline !== -1) {
      const line = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      newline = buffer.indexOf('\n');

      if (line.length === 0) continue;

      const msg = JSON.parse(line);

      if (msg.id !== undefined && pending.has(msg.id)) {
        const { resolve, reject } = pending.get(msg.id);
        pending.delete(msg.id);

        if (msg.error) {
          reject(new Error(msg.error.message ?? JSON.stringify(msg.error)));
          continue;
        }

        resolve(msg.result);
      }
    }
  });

  const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`);
  const request = (method, params) =>
    new Promise((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      send({ jsonrpc: '2.0', id, method, params });
    });
  const notify = (method, params) => send({ jsonrpc: '2.0', method, params });

  return { request, notify };
}

async function main() {
  const child = spawn('node', [serverEntry], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: { ...process.env, LECLAP_MCP_OUTPUT_DIR: outputDir },
  });
  child.on('error', (error) => {
    console.error(`Failed to start the MCP server (${serverEntry}). Did you build it?\n`, error);
    process.exit(1);
  });

  const { request, notify } = createClient(child);

  await request('initialize', {
    protocolVersion: '2025-06-18',
    capabilities: {},
    clientInfo: { name: 'agent-demo', version: '1.0.0' },
  });
  notify('notifications/initialized', {});

  console.log(`▸ Asking the engine to validate "${templateName}" (instant, no render)…`);
  const validate = await request('tools/call', { name: 'validate_template', arguments: { templateName } });
  console.log(`   ${JSON.stringify(validate.structuredContent)}`);

  console.log(`▸ Composing "${templateName}" → deterministic mp4 (on your machine, no upload)…`);
  const compose = await request('tools/call', { name: 'compose_video', arguments: { templateName } });

  if (compose.isError) {
    console.error('✖ compose_video failed:\n', compose.content?.[0]?.text);
    child.kill();
    process.exit(1);
  }

  const out = compose.structuredContent;
  console.log('✔ Done.');
  console.log(`  output : ${out.outputPath}`);
  console.log(`  format : ${out.videoCodec}/${out.audioCodec}, ${out.durationSeconds ?? '?'}s, ${out.sizeBytes} bytes`);

  child.kill();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
