import 'reflect-metadata';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { After, Before, setDefaultTimeout, setWorldConstructor, World } from '@cucumber/cucumber';
import type { TemplateDescriptor } from 'ffmpeg-video-composer';

// A real render takes a few seconds; give every step room.
setDefaultTimeout(120_000);

export class CompileWorld extends World {
  buildDir = '';
  descriptor: unknown;
  invalidDescriptor: unknown;
  outputPath: string | null = null;

  asDescriptor(): TemplateDescriptor {
    return this.descriptor as TemplateDescriptor;
  }
}

setWorldConstructor(CompileWorld);

Before(async function (this: CompileWorld) {
  this.buildDir = await mkdtemp(path.join(os.tmpdir(), 'leclap-compile-'));
});

After(async function (this: CompileWorld) {
  if (!this.buildDir) {
    return;
  }

  await rm(this.buildDir, { recursive: true, force: true });
});
