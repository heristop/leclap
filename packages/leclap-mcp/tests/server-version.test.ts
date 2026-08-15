import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

// `serverInfo.version` is the version every MCP client displays and the one the registry listing
// carries. It used to be the literal '0.1.0' in createServer and had drifted three minor releases
// behind the package before a pre-release stdio handshake caught it — silent, because nothing reads
// it in the unit suite and no client complains about a wrong-but-valid version.
//
// A static check rather than a runtime one: reading the manifest back and comparing it to itself
// would pass no matter what the source did. This asserts the source derives the version instead of
// stating it, which is the thing that actually regressed.
describe('server version', () => {
  const source = readFileSync(join(packageRoot, 'src/server.ts'), 'utf8');

  it('derives serverInfo.version from the package manifest', () => {
    expect(source).toMatch(/version:\s*SERVER_VERSION/);
    expect(source).toMatch(/createRequire\(import\.meta\.url\)\('\.\.\/package\.json'\)/);
  });

  it('states no hardcoded version literal in the server identity', () => {
    const identity = source.match(/\{\s*name:\s*'leclap',[^}]*\}/)?.[0] ?? '';
    expect(identity, 'server identity block not found').not.toBe('');
    expect(identity, 'a literal here drifts the moment changesets bumps the package').not.toMatch(
      /version:\s*['"]\d+\.\d+\.\d+['"]/
    );
  });
});
