import path from 'node:path';

// Where `@leclap/creative-kit`'s library might sit relative to this module, checked at every ancestor
// directory so the answer is the same whether this file is running from `src/platform/filesystem/`
// (tests) or from a bundled `dist/` (the CLI, the MCP server, any installed consumer). Bounded by the
// filesystem root, which `path.dirname` reaches as a fixed point.
export function creativeKitCandidates(moduleDir: string, kind: string, file: string): string[] {
  const candidates: string[] = [];
  let dir = moduleDir;

  for (let hop = 0; hop < 8; hop++) {
    candidates.push(path.join(dir, 'leclap-creative-kit', 'src', 'library', kind, file));

    const parent = path.dirname(dir);

    if (parent === dir) {
      break;
    }

    dir = parent;
  }

  return candidates;
}

// The one candidate the library had before the walk-up: four hops up is the creative kit from
// `src/platform/filesystem/` (vitest), and somewhere outside the repo from a built `dist/`. Music keeps
// exactly this. Library tracks are Git-LFS objects — 132-byte pointer stubs in a checkout without LFS
// content, such as a fresh clone or a worktree — and MusicComposer uses a resolved track IN PLACE,
// which MusicNodeAdapter.loopMusic then unlinks and replaces with the loop. Walking a built CLI or MCP
// render into the tracked library therefore fed ffprobe a pointer, or rewrote a repo file, where it
// used to download the track. Fonts are plain blobs that are only ever read, so they alone walk up.
export function sourceLayoutCandidates(moduleDir: string, kind: string, file: string): string[] {
  return [path.join(moduleDir, '..', '..', '..', '..', 'leclap-creative-kit', 'src', 'library', kind, file)];
}

// A bundled asset is addressed by BARE FILENAME — `Oswald.ttf`, `lofi-chill.mp3` — so anything
// carrying a separator is not naming one. `path.join` normalises `..` away silently, and the name
// reaching here is descriptor-controlled: `resolveFontFile` hands back `caption.font` verbatim
// whenever it ends in `.ttf`, so a font of `'../'.repeat(20) + 'etc/passwd.ttf'` resolved and its
// bytes were read (verified). That was only the render path before; geometry validation now stats
// and reads the same name from `leclap validate` and from the MCP `validate_template` tool, both of
// which advertise themselves as render-free dry runs. The walk-up multiplies the roots it is joined
// against, so the guard belongs here rather than at any one call site.
export function isBundledAssetName(file: string): boolean {
  return file.length > 0 && !file.startsWith('.') && !file.includes('/') && !file.includes('\\');
}
