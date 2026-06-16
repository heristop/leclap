import { describe, it, expect } from 'vitest';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { starterFiles } from '../src/commands/init';

describe('starterFiles', () => {
  const files = starterFiles('demo');

  it('includes the core starter files', () => {
    expect(Object.keys(files).sort()).toEqual(['README.md', 'assets/.gitkeep', 'package.json', 'template.json']);
  });

  it('produces a compile-valid template descriptor', () => {
    const descriptor: unknown = JSON.parse(files['template.json']);
    expect(TemplateDescriptorSchema.safeParse(descriptor).success).toBe(true);
  });

  it('wires a render script + the project name into package.json', () => {
    const pkg = JSON.parse(files['package.json']) as { name: string; scripts: { render: string } };
    expect(pkg.name).toBe('demo');
    expect(pkg.scripts.render).toContain('leclap render template.json');
  });

  it('keeps every path inside the project (no escape)', () => {
    for (const rel of Object.keys(files)) {
      expect(rel.startsWith('/')).toBe(false);
      expect(rel.includes('..')).toBe(false);
    }
  });
});
