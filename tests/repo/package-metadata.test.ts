import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

// The three packages that reach npm. The rest of the workspace is private and exempt.
const PUBLISHED = ['packages/ffmpeg-video-composer', 'packages/leclap-cli', 'packages/leclap-mcp'];

const readPkg = (dir: string) => JSON.parse(readFileSync(join(repoRoot, dir, 'package.json'), 'utf8'));

// The dependency fields that ship inside a published tarball. devDependencies are stripped on
// publish, so a workspace protocol there is harmless.
const SHIPPED_DEP_FIELDS = ['dependencies', 'peerDependencies', 'optionalDependencies'] as const;

// pnpm's `workspace:*` protocol is rewritten to a real version only when *pnpm* packs. Both
// A hand-run `npm publish` shells out to npm, which ships the literal string
// to the registry: @leclap/cli 0.2.2 and 0.2.3 and @leclap/mcp 0.3.0 and 0.3.1 all went out that way
// and cannot be installed at all — `npm i @leclap/cli` dies with EUNSUPPORTEDPROTOCOL.
//
// A plain semver range cannot be published wrong by any packer, which is why the published packages
// use one and this test keeps them that way. Local development still resolves to the copy in this
// repo via `linkWorkspacePackages` in pnpm-workspace.yaml.
describe.each(PUBLISHED)('%s shipped dependencies', (dir) => {
  const pkg = readPkg(dir);

  it('declares no workspace-protocol ranges', () => {
    const offenders = SHIPPED_DEP_FIELDS.flatMap((field) =>
      Object.entries(pkg[field] ?? {})
        .filter(([, range]) => String(range).startsWith('workspace:'))
        .map(([name, range]) => `${field}.${name}=${String(range)}`)
    );

    expect(offenders, 'npm publishes these verbatim; installs then fail EUNSUPPORTEDPROTOCOL').toEqual([]);
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

// `server.json` is the MCP registry manifest. It is a second, hand-maintained copy of facts that
// already live in package.json, and nothing rebuilt it when the package moved: it sat pinned at
// 0.3.0 — one of the two releases published with a `workspace:*` range, so uninstallable — while
// the package went to 0.3.2. Submitting that would have put a broken `npx` line on a public
// listing. These assertions are what stop the two files drifting again.
describe('@leclap/mcp registry manifest', () => {
  const pkg = readPkg('packages/leclap-mcp');
  const server = JSON.parse(readFileSync(join(repoRoot, 'packages/leclap-mcp/server.json'), 'utf8'));
  const npmPackage = server.packages?.find((entry: { registryType: string }) => entry.registryType === 'npm');

  it('points at the version this repo publishes', () => {
    expect(server.version, 'server.json version').toBe(pkg.version);
    expect(npmPackage?.version, 'npm package version').toBe(pkg.version);
  });

  it('matches the ownership marker the registry validates', () => {
    // The registry reads `mcpName` out of the published tarball and refuses the submission unless
    // it equals the name being claimed. A mismatch is only discoverable at publish time.
    expect(server.name, 'server.json name').toBe(pkg.mcpName);
    expect(npmPackage?.identifier, 'npm identifier').toBe(pkg.name);
  });

  it('keeps the description inside the registry ceiling', () => {
    // server.schema.json caps it at 100 and rejects rather than truncating.
    expect(server.description.length).toBeLessThanOrEqual(100);
  });

  it('declares every environment variable the server reads', () => {
    const source = readFileSync(join(repoRoot, 'packages/leclap-mcp/src/config.ts'), 'utf8');
    const read = [...new Set([...source.matchAll(/LECLAP_MCP_[A-Z_]+/g)].map(([name]) => name))].sort();
    const declared = (npmPackage?.environmentVariables ?? []).map((v: { name: string }) => v.name).sort();

    expect(declared, 'the listing renders these as the server’s configuration').toEqual(read);
  });

  it('lists every tool the server registers', () => {
    const publisher = server._meta?.['io.modelcontextprotocol.registry/publisher-provided'] ?? {};
    const entries = Object.values(publisher) as { tools?: { name: string }[] }[];
    const listed = entries.flatMap((entry) => entry.tools ?? []).map((tool) => tool.name);

    // Read the registrations out of the source rather than restating them here — a hand-kept list
    // would be a third copy to drift. The manifest shipped naming four of the six: `ping` and the
    // gated Remotion renderer were both absent.
    const srcDir = join(repoRoot, 'packages/leclap-mcp/src');
    const sources = [
      join(srcDir, 'server.ts'),
      ...readdirSync(join(srcDir, 'tools')).map((f) => join(srcDir, 'tools', f)),
    ];
    const registered = sources.flatMap((file) =>
      [...readFileSync(file, 'utf8').matchAll(/registerTool\(\s*'([a-z_]+)'/g)].map(([, name]) => name)
    );

    expect(registered.length, 'found no registrations — the regex has drifted from the source').toBeGreaterThan(0);
    expect(listed.sort()).toEqual(registered.sort());
  });
});
