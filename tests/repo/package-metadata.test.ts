import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

// The three packages that reach npm. The rest of the workspace is private and exempt.
const PUBLISHED = ['packages/ffmpeg-video-composer', 'packages/leclap-cli', 'packages/leclap-mcp'];

const readPkg = (dir: string) => JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));

// @leclap/cli and @leclap/mcp depend on ffmpeg-video-composer via `workspace:*`, which only pnpm
// knows how to rewrite at pack time. The release used `changeset publish`, which shells out to
// `npm publish` — npm shipped the literal string "workspace:*" to the registry, so 0.2.2 and 0.3.0
// installed straight into EUNSUPPORTEDPROTOCOL and nobody could run `npx @leclap/cli`.
//
// The fix is to let pnpm do the packing. This pins that: if the release script ever goes back to an
// npm-based publisher while any published package still uses the workspace protocol, it fails here
// rather than on the registry.
describe('release pipeline', () => {
  const root = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  const usesWorkspaceProtocol = PUBLISHED.some((dir) =>
    Object.values(readPkg(dir).dependencies ?? {}).some((range) => String(range).startsWith('workspace:'))
  );

  it('publishes with pnpm, the only packer that rewrites workspace: ranges', () => {
    expect(usesWorkspaceProtocol, 'precondition: a published package still uses workspace:').toBe(true);
    expect(root.scripts.release, 'npm publish ships "workspace:*" verbatim').toContain('pnpm publish');
    expect(root.scripts.release, 'changeset publish shells out to npm publish').not.toContain('changeset publish');
  });
});

// Every way the brand can be written, correct or not: `Leclap`, `leclap`, `LECLAP`, `leClap`,
// `Le Clap`, `le-clap`. Matches are returned with their original casing so the spellings can be
// compared, not merely counted.
const brandMentions = (text: string): string[] => [...text.matchAll(/le[\s._-]*clap/gi)].map(([match]) => match);

// npm rejects uppercase in package names, so identifiers carry the brand lowercased. Anywhere a
// human reads it — a description, the README, the npm page blurb — it is `LeClap`.
const IDENTIFIER_SPELLING = 'leclap';
const PROSE_SPELLING = 'LeClap';

// How many times each surface mentions the brand today, recorded per package.
//
// This table is what makes the spelling assertions real. A bare negative regex over a description
// passes for free whenever the description never mentions the brand at all — true for
// `ffmpeg-video-composer` (deliberately unbranded, it is the generic engine package) and for
// `@leclap/mcp` (its description leads with the MCP protocol, not the brand). Pinning the expected
// count first means an absent brand is asserted, not assumed, and a newly introduced mention has to
// be spelled correctly and recorded here before the suite goes green again.
const BRAND_MENTIONS: Record<string, { name: number; keywords: number; description: number }> = {
  'packages/ffmpeg-video-composer': { name: 0, keywords: 0, description: 0 },
  'packages/leclap-cli': { name: 1, keywords: 1, description: 1 },
  'packages/leclap-mcp': { name: 1, keywords: 1, description: 0 },
};

const majorOf = (range: string) => range.replace(/^[\^~]/, '').split('.')[0];

describe.each(PUBLISHED)('%s', (dir) => {
  const pkg = readPkg(dir);

  // Each of these renders as a distinct element on the npm package page. A missing one is a
  // missing link, and npm gives no warning about it.
  it('carries every field npm renders on the package page', () => {
    expect(pkg.description, 'description').toBeTruthy();
    expect(pkg.license, 'license').toBe('MIT');
    expect(pkg.homepage, 'homepage').toBe('https://leclap.dev');
    expect(pkg.repository?.url, 'repository.url').toBe('git+https://github.com/heristop/leclap.git');
    expect(pkg.repository?.directory, 'repository.directory').toBe(dir);
  });

  it('carries enough keywords to be found by search', () => {
    expect(pkg.keywords?.length ?? 0).toBeGreaterThanOrEqual(5);
  });

  it('spells the brand LeClap wherever npm shows it', () => {
    const expected = BRAND_MENTIONS[dir];
    const inName = brandMentions(pkg.name);
    const inKeywords = brandMentions((pkg.keywords ?? []).join(' '));
    const inDescription = brandMentions(pkg.description ?? '');

    // Counts first. Without them a package that simply never says "LeClap" would satisfy every
    // spelling check below by default.
    expect(inName.length, 'brand mentions in name').toBe(expected.name);
    expect(inKeywords.length, 'brand mentions in keywords').toBe(expected.keywords);
    expect(inDescription.length, 'brand mentions in description').toBe(expected.description);

    // Then the spelling of each mention. Expectations are built from the two constants above, so a
    // misspelling cannot be waved through by editing the table.
    expect(inName, 'name').toEqual(Array(expected.name).fill(IDENTIFIER_SPELLING));
    expect(inKeywords, 'keywords').toEqual(Array(expected.keywords).fill(IDENTIFIER_SPELLING));
    expect(inDescription, 'description').toEqual(Array(expected.description).fill(PROSE_SPELLING));
  });

  it('pins the same typescript major as the workspace root', () => {
    const rootTs = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).devDependencies.typescript;
    const ownTs = pkg.devDependencies?.typescript;
    // Each published package builds its own dist, so each owns a typescript devDependency.
    // Asserting that outright stops the major-version check from vanishing into a silent pass if
    // the field is ever dropped.
    expect(ownTs, 'devDependencies.typescript').toBeDefined();
    expect(majorOf(ownTs), 'typescript major').toBe(majorOf(rootTs));
  });
});

describe('@leclap/mcp discoverability', () => {
  it('claims the keywords an agent developer would search', () => {
    const pkg = readPkg('packages/leclap-mcp');
    for (const required of ['mcp', 'model-context-protocol', 'ai-agent']) {
      expect(pkg.keywords).toContain(required);
    }
  });
});
