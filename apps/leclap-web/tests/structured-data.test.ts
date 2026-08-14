import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const html = readFileSync(join(repoRoot, 'apps/leclap-web/index.html'), 'utf8');
const llmsTxt = readFileSync(join(repoRoot, 'apps/leclap-web/public/llms.txt'), 'utf8');

// The MCP tool names llms.txt advertises are read back out of the server source, so a rename in
// packages/leclap-mcp turns this suite red instead of shipping a name no agent can call.
const mcpSrc = join(repoRoot, 'packages/leclap-mcp/src');
const REGISTERED_TOOLS = [join(mcpSrc, 'server.ts'), ...listToolModules()]
  .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/registerTool\(\s*'([a-z][a-z_]*)'/g)])
  .map(([, name]) => name)
  .sort();

function listToolModules(): string[] {
  const dir = join(mcpSrc, 'tools');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}

// What llms.txt is expected to advertise: the authoring surface, whole names, no substrings.
const DOCUMENTED_TOOLS = ['get_template_schema', 'validate_template', 'compose_video', 'probe_media'];

const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(([, json]) =>
  JSON.parse(json)
);

describe('structured data', () => {
  it('declares both the app and the source project', () => {
    const types = blocks.map((b) => b['@type']);
    expect(types).toContain('WebApplication');
    expect(types).toContain('SoftwareSourceCode');
  });

  it('every block is valid JSON with a schema.org context', () => {
    expect(blocks.length).toBeGreaterThan(0);
    for (const block of blocks) {
      expect(block['@context']).toBe('https://schema.org');
    }
  });

  // The one-line pitch must be identical wherever a machine reads it, or an LLM summarising the
  // project gets three different answers depending on which surface it crawled.
  it('reuses the canonical description from the repo metadata manifest', () => {
    const canonical = JSON.parse(readFileSync(join(repoRoot, '.github/repo-metadata.json'), 'utf8')).description;
    const source = blocks.find((b) => b['@type'] === 'SoftwareSourceCode');
    expect(source.description).toBe(canonical);
  });

  it('names the runtimes and the license on the source block', () => {
    const source = blocks.find((b) => b['@type'] === 'SoftwareSourceCode');
    expect(source.programmingLanguage).toContain('TypeScript');
    expect(source.license).toBe('https://opensource.org/licenses/MIT');
    expect(source.codeRepository).toBe('https://github.com/heristop/leclap');
  });

  // Two unlinked top-level entities leave the page's primary subject ambiguous, so the source
  // block has to resolve to the app it builds rather than float beside it.
  it('links the source block to the web application it produces', () => {
    const app = blocks.find((b) => b['@type'] === 'WebApplication');
    const source = blocks.find((b) => b['@type'] === 'SoftwareSourceCode');
    expect(app['@id'], 'WebApplication needs an @id to be referenced').toBeTruthy();
    expect(source['@id'], 'SoftwareSourceCode needs its own @id').toBeTruthy();
    expect(source['@id']).not.toBe(app['@id']);
    expect(source.targetProduct['@id']).toBe(app['@id']);
  });
});

describe('llms.txt', () => {
  // The engine does not produce identical bytes on every target: Node and the browser take the
  // libx264 software path, Android encodes with libopenh264, iOS with h264_videotoolbox, and the
  // LGPL on-device build drops boxblur / rewrites eq to lutyuv. An LLM repeats whatever this file
  // claims, so the claim has to be the one README stands behind: reproducible *per platform*.
  it('does not claim identical output across platforms', () => {
    const overclaims = [/\bidentical(ly)?\b/i, /same\s+(?:\w+\s+){0,3}output\s+everywhere/i];
    for (const pattern of overclaims) {
      expect(llmsTxt, `llms.txt overclaims cross-platform determinism: ${pattern}`).not.toMatch(pattern);
    }
  });

  it('scopes reproducibility to a platform', () => {
    expect(llmsTxt).toMatch(/reproducible per platform/i);
  });

  it('says what to use LeClap instead of, and how to wire it to an agent', () => {
    expect(llmsTxt).toContain('## When to choose LeClap');
    expect(llmsTxt).toContain('## Use it from an AI agent');
    expect(llmsTxt).toContain('@leclap/mcp');
  });

  // An agent copies these names straight out of this file and calls them. A `toContain` check is
  // useless here — 'get_schema' is a substring of 'get_template_schema', so it passes on a wrong
  // name. Compare whole names against what the server actually registers instead.
  it('lists MCP tool names that the server really registers', () => {
    const section = llmsTxt.slice(llmsTxt.indexOf('## Use it from an AI agent'));
    const listed = [...section.matchAll(/`([a-z][a-z_]*[a-z])`/g)].map(([, name]) => name).sort();

    expect(listed, 'the agent section lists no tools at all').not.toHaveLength(0);
    expect(listed).toEqual([...DOCUMENTED_TOOLS].sort());
    for (const name of listed) {
      expect(REGISTERED_TOOLS, `llms.txt names a tool the server never registers: ${name}`).toContain(name);
    }
  });

  // The other direction: a tool added to the server must be documented here or explicitly excused,
  // so the file cannot silently fall behind the surface it claims to describe.
  it('documents every registered tool except the deliberately undocumented ones', () => {
    // `ping` is a health check, not an authoring tool; `render_remotion_clip` is registered only
    // when the operator opts in (it executes caller-supplied JS), so it is not advertised.
    const excused = ['ping', 'render_remotion_clip'];
    const undocumented = REGISTERED_TOOLS.filter((name) => !DOCUMENTED_TOOLS.includes(name) && !excused.includes(name));
    expect(undocumented, 'new MCP tool is missing from llms.txt').toEqual([]);
  });

  // The prose shorthand in the Packages list drifted too — it used to advertise a `list` tool that
  // has never existed. Every shorthand has to be traceable to a real registered name.
  it('describes the MCP surface with shorthands that map to real tools', () => {
    const bullet = llmsTxt.split('\n').find((line) => line.includes('@leclap/mcp —'));
    expect(bullet, '@leclap/mcp bullet missing').toBeDefined();

    // the markdown link target is parenthesised too, so read the shorthand out of the prose that
    // follows "): ", never out of the URL
    const prose = (bullet as string).split('): ').slice(1).join('): ');
    const shorthands = /\(([^)]*\/[^)]*)\)/.exec(prose)?.[1].split('/') ?? [];
    expect(shorthands.length, 'no shorthand tool list found in the bullet').toBeGreaterThan(0);
    for (const shorthand of shorthands.map((s) => s.trim())) {
      expect(
        REGISTERED_TOOLS.some((name) => name.includes(shorthand)),
        `"${shorthand}" matches no registered MCP tool`
      ).toBe(true);
    }
  });

  // README concedes Remotion "reaches by a different route" and scores it ✅ on running with no
  // server. llms.txt must not re-open a claim the README already gave up.
  it('stays consistent with the README positioning', () => {
    expect(llmsTxt, 'README concedes the corner is contested').not.toMatch(/uncontested/i);
    const bullet = llmsTxt.split('\n').find((line) => line.includes('Instead of a React-based renderer'));
    expect(bullet, 'React-renderer bullet missing').toBeDefined();
    // the differentiator is the browser engine, not the server
    expect(bullet as string).toMatch(/browser/i);
    expect(bullet as string).not.toMatch(/no server/i);
  });

  it('spells the brand LeClap everywhere', () => {
    expect(llmsTxt).not.toMatch(/\bLeclap\b|\bleClap\b|\bLECLAP\b/);
  });
});
