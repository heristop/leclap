import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { Given, Then, When } from '@cucumber/cucumber';
import type { AgentWorld } from '../support/world.ts';

const fixturePath = fileURLToPath(new URL('../fixtures/color-card.json', import.meta.url));

interface ListTemplatesOutput {
  templates: unknown[];
}

interface ComposeOutput {
  outputPath: string;
  durationSeconds: number | null;
  sizeBytes: number;
  videoCodec: string | null;
}

interface ProbeOutput {
  videoCodec: string | null;
}

interface ToolResult {
  structuredContent?: unknown;
  content?: { type: string; text?: string }[];
  isError?: boolean;
}

async function loadFixture(): Promise<Record<string, unknown>> {
  const raw = await readFile(fixturePath, 'utf8');

  return JSON.parse(raw) as Record<string, unknown>;
}

async function compose(world: AgentWorld): Promise<ComposeOutput> {
  const template = await loadFixture();
  const result = (await world.requireClient().callTool({
    name: 'compose_video',
    arguments: { template, locale: 'en' },
  })) as ToolResult;

  assert.ok(!result.isError, `compose_video failed: ${JSON.stringify(result.content)}`);

  return result.structuredContent as ComposeOutput;
}

// The Before hook spawns the server and connects the client; this step just asserts it is live.
Given('a running leclap MCP server', function (this: AgentWorld) {
  this.requireClient();
});

When('the agent lists templates', async function (this: AgentWorld) {
  this.lastResult = await this.requireClient().callTool({ name: 'list_templates', arguments: {} });
});

Then('it receives {int} templates', function (this: AgentWorld, count: number) {
  const result = this.lastResult as ToolResult;
  const structured = result.structuredContent as ListTemplatesOutput;

  assert.equal(structured.templates.length, count);
});

When('the agent requests the template schema', async function (this: AgentWorld) {
  this.lastResult = await this.requireClient().callTool({ name: 'get_template_schema', arguments: {} });
});

Then('the schema includes sections', function (this: AgentWorld) {
  const result = this.lastResult as ToolResult;
  const text = result.content?.map((part) => part.text ?? '').join('\n') ?? '';

  assert.ok(text.includes('sections'), 'schema text should mention sections');
});

When('the agent composes the color-card template', async function (this: AgentWorld) {
  const output = await compose(this);
  this.outputPath = output.outputPath;
  this.lastResult = { structuredContent: output };
});

Then('it receives an output path that exists', async function (this: AgentWorld) {
  assert.ok(this.outputPath, 'compose should return an output path');

  const { size } = await stat(this.outputPath);
  assert.ok(size > 0, 'output mp4 must be larger than 0 bytes');
});

Then('the render has a positive duration and non-zero size', function (this: AgentWorld) {
  const result = this.lastResult as ToolResult;
  const output = result.structuredContent as ComposeOutput;

  assert.ok((output.durationSeconds ?? 0) > 0, 'duration must be positive');
  assert.ok(output.sizeBytes > 0, 'size must be non-zero');
});

When('the agent probes the rendered file', async function (this: AgentWorld) {
  assert.ok(this.outputPath, 'a rendered file is required before probing');

  this.lastResult = await this.requireClient().callTool({
    name: 'probe_media',
    arguments: { path: this.outputPath },
  });
});

Then('it reports a video codec', function (this: AgentWorld) {
  const result = this.lastResult as ToolResult;

  assert.ok(!result.isError, `probe_media failed: ${JSON.stringify(result.content)}`);

  const output = result.structuredContent as ProbeOutput;
  assert.ok(output.videoCodec, 'probe should report a video codec');
});
