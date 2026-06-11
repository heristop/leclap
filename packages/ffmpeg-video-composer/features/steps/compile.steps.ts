import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { Given, Then, When } from '@cucumber/cucumber';
import { compile, TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import type { CompileWorld } from '../support/world.ts';

const execFileAsync = promisify(execFile);

const fixturePath = fileURLToPath(new URL('../fixtures/color-card.json', import.meta.url));

async function probeDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'quiet', '-print_format', 'json', '-show_format', file]);
  const parsed = JSON.parse(stdout) as { format?: { duration?: string } };
  const raw = parsed.format?.duration ?? '0';

  return Number.parseFloat(raw);
}

Given('the color-card template', async function (this: CompileWorld) {
  const raw = await readFile(fixturePath, 'utf8');
  this.descriptor = JSON.parse(raw);

  const result = TemplateDescriptorSchema.safeParse(this.descriptor);
  assert.equal(result.success, true, 'fixture must satisfy TemplateDescriptorSchema');
});

Given('a template missing required fields', function (this: CompileWorld) {
  this.invalidDescriptor = { sections: 'nope' };
});

When('I compile it to a temp build dir', async function (this: CompileWorld) {
  this.outputPath = await compile(
    { buildDir: this.buildDir, assetsDir: this.buildDir, currentLocale: 'en' },
    this.asDescriptor()
  );
});

When('I compile the invalid template', async function (this: CompileWorld) {
  this.outputPath = await compile({ buildDir: this.buildDir }, this.invalidDescriptor as never);
});

Then('an mp4 file is produced', async function (this: CompileWorld) {
  assert.ok(this.outputPath, 'compile should return an output path');

  const { size } = await stat(this.outputPath);
  assert.ok(size > 0, 'output mp4 must be larger than 0 bytes');
});

Then('its probed duration is greater than 0', async function (this: CompileWorld) {
  assert.ok(this.outputPath, 'compile should return an output path');

  const duration = await probeDuration(this.outputPath);
  assert.ok(duration > 0, `expected duration > 0, got ${duration}`);
});

Then('compilation fails without throwing', function (this: CompileWorld) {
  assert.equal(this.outputPath, null, 'invalid template must compile to null');
});
