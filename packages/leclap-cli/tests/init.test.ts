import { describe, it, expect } from 'vitest';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer';
import { starterFiles, detectPackageManager } from '../src/commands/init';

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

describe('detectPackageManager', () => {
  it('reads the package manager from npm_config_user_agent', () => {
    expect(detectPackageManager('pnpm/9.0.0 npm/? node/v22')).toBe('pnpm');
    expect(detectPackageManager('yarn/4.1.0 npm/?')).toBe('yarn');
    expect(detectPackageManager('bun/1.1.0')).toBe('bun');
    expect(detectPackageManager('npm/10.0.0 node/v22')).toBe('npm');
  });

  it('defaults to npm for an unknown or empty agent', () => {
    // Pass an explicit value: a bare `undefined` would fall through to the default param
    // (`process.env.npm_config_user_agent`), which is set by whatever pm runs the test.
    expect(detectPackageManager('')).toBe('npm');
    expect(detectPackageManager('deno/2.0.0')).toBe('npm');
  });
});

describe('starterFiles — versions + package manager', () => {
  const pkgOf = (opts?: Parameters<typeof starterFiles>[1]) =>
    JSON.parse(starterFiles('demo', opts)['package.json']) as {
      devDependencies: Record<string, string>;
      pnpm: { onlyBuiltDependencies: string[] };
    };

  it('pins @leclap/cli to a caret on the given cli version', () => {
    expect(pkgOf({ cliVersion: '0.2.0' }).devDependencies['@leclap/cli']).toBe('^0.2.0');
  });

  it('falls back to `latest` when no cli version is given', () => {
    expect(pkgOf().devDependencies['@leclap/cli']).toBe('latest');
  });

  it('tracks @leclap/mcp at `latest`', () => {
    expect(pkgOf({ mcp: true, remotion: true }).devDependencies['@leclap/mcp']).toBe('latest');
  });

  it('approves pnpm native builds so ffmpeg-static unpacks', () => {
    expect(pkgOf().pnpm.onlyBuiltDependencies).toContain('ffmpeg-static');
  });

  it('renders the detected package manager in the README install steps', () => {
    const readme = (pm: 'npm' | 'pnpm' | 'yarn' | 'bun') => starterFiles('demo', { packageManager: pm })['README.md'];
    expect(readme('pnpm')).toContain('pnpm install');
    expect(readme('pnpm')).toContain('pnpm render');
    expect(readme('bun')).toContain('bun install');
    expect(readme('npm')).not.toContain('pnpm install');
  });
});
