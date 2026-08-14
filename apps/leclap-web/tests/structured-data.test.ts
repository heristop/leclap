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
// Any quote style the server source might use — prettier could switch the repo to double quotes, or
// a codemod could leave a template literal behind. Matching only `'…'` used to make this scrape
// return nothing, which turned every assertion derived from it into a vacuous pass.
const REGISTERED_TOOLS = [join(mcpSrc, 'server.ts'), ...listToolModules()]
  .flatMap((file) => [...readFileSync(file, 'utf8').matchAll(/registerTool\(\s*['"`]([a-z][a-z0-9_]*)['"`]/g)])
  .map(([, name]) => name)
  .sort();

function listToolModules(): string[] {
  const dir = join(mcpSrc, 'tools');
  return readdirSync(dir)
    .filter((file) => file.endsWith('.ts'))
    .map((file) => join(dir, file));
}

// `ping` is a health check, not an authoring tool; `render_remotion_clip` is registered only when
// the operator opts in (it executes caller-supplied JS), so it is not advertised.
const EXCUSED_TOOLS = ['ping', 'render_remotion_clip'];

// What llms.txt is expected to advertise: the authoring surface, whole names, no substrings. Derived
// from what the server registers rather than written out by hand, so a fifth tool is documented by
// editing llms.txt alone. The previous hardcoded literal pinned llms.txt to exactly four names while
// a second test demanded every registered tool be documented — two assertions no edit to llms.txt
// could satisfy at once.
const DOCUMENTED_TOOLS = REGISTERED_TOOLS.filter((name) => !EXCUSED_TOOLS.includes(name));

// Every assertion about tool names below is derived from REGISTERED_TOOLS, so a scrape that comes
// back empty would make all of them pass while checking nothing. Anchor it: the four authoring tools
// are the surface llms.txt exists to describe, and a genuine rename should be a deliberate edit here.
const SCRAPE_ANCHORS = ['compose_video', 'get_template_schema', 'probe_media', 'validate_template'];

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

  // The scrape that every tool-name assertion here rests on. Kept as its own test so an empty
  // REGISTERED_TOOLS fails loudly instead of quietly satisfying the checks below.
  it('scrapes the registered tool names out of the MCP server source', () => {
    expect(REGISTERED_TOOLS, 'the registerTool scrape found nothing — its regex has drifted').not.toHaveLength(0);
    for (const anchor of SCRAPE_ANCHORS) {
      expect(REGISTERED_TOOLS, `the server no longer registers ${anchor}`).toContain(anchor);
    }
  });

  // An agent copies these names straight out of this file and calls them. A `toContain` check is
  // useless here — 'get_schema' is a substring of 'get_template_schema', so it passes on a wrong
  // name. Compare whole names against what the server actually registers instead.
  //
  // One equality, both directions: llms.txt cannot invent a tool the server never registers, and it
  // cannot fall behind a tool the server gained — a new tool is documented by editing llms.txt, and
  // deliberately hiding one means adding it to EXCUSED_TOOLS.
  it('lists exactly the MCP tools the server registers and does not excuse', () => {
    const section = llmsTxt.slice(llmsTxt.indexOf('## Use it from an AI agent'));
    const listed = [...section.matchAll(/`([a-z][a-z0-9_]*[a-z0-9])`/g)].map(([, name]) => name).sort();

    expect(listed, 'the agent section lists no tools at all').not.toHaveLength(0);
    expect(DOCUMENTED_TOOLS, 'every registered tool is excused — nothing left to advertise').not.toHaveLength(0);
    expect(listed).toEqual([...DOCUMENTED_TOOLS].sort());
  });

  // The excuse list is the one hand-written escape hatch above, so it needs its own guard: a renamed
  // or deleted tool would otherwise leave a stale entry that silently widens what llms.txt may omit.
  it('excuses only tools the server actually registers', () => {
    const stale = EXCUSED_TOOLS.filter((name) => !REGISTERED_TOOLS.includes(name));
    expect(stale, 'EXCUSED_TOOLS names a tool the server no longer registers').toEqual([]);
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
