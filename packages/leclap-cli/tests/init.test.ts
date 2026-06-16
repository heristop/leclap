import { describe, it, expect } from 'vitest';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { starterFiles } from '../src/commands/init';

describe('starterFiles (base)', () => {
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

describe('starterFiles (mcp + remotion)', () => {
  const files = starterFiles('demo', { mcp: true, remotion: true, projectDir: '/abs/demo' });

  it('adds the .mcp.json and the remotion starter', () => {
    expect(Object.keys(files).sort()).toEqual([
      '.mcp.json',
      'README.md',
      'assets/.gitkeep',
      'package.json',
      'remotion/Intro.tsx',
      'remotion/Root.tsx',
      'remotion/index.ts',
      'template.json',
    ]);
  });

  it('adds @leclap/mcp + remotion devDependencies', () => {
    const pkg = JSON.parse(files['package.json']) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies).toMatchObject({
      '@leclap/mcp': expect.any(String),
      '@remotion/bundler': expect.any(String),
      '@remotion/renderer': expect.any(String),
      remotion: expect.any(String),
      react: expect.any(String),
    });
  });

  it('points the MCP at the project dirs + the remotion entry, and runs the local install', () => {
    const config = JSON.parse(files['.mcp.json']) as {
      mcpServers: { leclap: { args: string[]; env: Record<string, string> } };
    };
    const { args, env } = config.mcpServers.leclap;
    expect(env.LECLAP_MCP_MEDIA_DIR).toBe('/abs/demo');
    expect(env.LECLAP_MCP_OUTPUT_DIR).toBe('/abs/demo/build');
    expect(env.LECLAP_MCP_REMOTION_ENTRY).toBe('/abs/demo/remotion/index.ts');
    // With Remotion the MCP must run from the local devDep (no `-y`) so it resolves @remotion.
    expect(args).toEqual(['@leclap/mcp']);
  });

  it('leads the template with a project_video intro and stays compile-valid', () => {
    const descriptor = JSON.parse(files['template.json']) as { sections: { name: string; type: string }[] };
    expect(descriptor.sections[0]).toMatchObject({ name: 'intro', type: 'project_video' });
    expect(TemplateDescriptorSchema.safeParse(descriptor).success).toBe(true);
  });

  it('registers an "Intro" Remotion composition', () => {
    expect(files['remotion/Root.tsx']).toContain('id="Intro"');
    expect(files['remotion/index.ts']).toContain('registerRoot');
  });
});

describe('starterFiles (mcp only, no remotion)', () => {
  const files = starterFiles('demo', { mcp: true, projectDir: '/abs/demo' });

  it('writes .mcp.json without a remotion entry and no remotion files', () => {
    const config = JSON.parse(files['.mcp.json']) as { mcpServers: { leclap: { env: Record<string, string> } } };
    expect(config.mcpServers.leclap.env.LECLAP_MCP_REMOTION_ENTRY).toBeUndefined();
    expect(Object.keys(files)).not.toContain('remotion/index.ts');
  });

  it('runs the MCP zero-install (`npx -y`) and adds no @leclap/mcp devDependency', () => {
    const config = JSON.parse(files['.mcp.json']) as { mcpServers: { leclap: { args: string[] } } };
    expect(config.mcpServers.leclap.args).toEqual(['-y', '@leclap/mcp']);

    const pkg = JSON.parse(files['package.json']) as { devDependencies: Record<string, string> };
    expect(pkg.devDependencies['@leclap/mcp']).toBeUndefined();
    expect(pkg.devDependencies['@leclap/cli']).toBeDefined();
  });
});
