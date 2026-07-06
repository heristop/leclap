import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// Guard for the on-device engine build config (scripts/ffmpeg/common.sh). The editor emits
// `-f lavfi -i <source>=...` inputs, and lavfi sources are filters: any source missing from
// FF_COMMON's --enable-filter list fails ONLY on device (host/WASM builds enable everything),
// which is exactly how gradient background layers broke. This test pins the coverage so a new
// lavfi source in the editor cannot ship without its device-side enable.
const COMMON_SH = resolve(dirname(fileURLToPath(import.meta.url)), '../../../scripts/ffmpeg/common.sh');

/** The lavfi source names the editor emits, with the emit sites they cover. */
const EMITTED_LAVFI_SOURCES = [
  'color', // SegmentBuilder: solid background layers
  'anullsrc', // SegmentBuilder: silent audio bed
  'aevalsrc', // VideoEditor: per-segment silent-audio padding
  'gradients', // inputSources.buildGradientSource: gradient background layers
];

// The build is --disable-gpl: configure silently drops any requested filter whose deps include
// `gpl` (boxblur_filter_deps="gpl", configure:3926 in n8.0). Listing such a filter is dead config
// that reads as "available on device" when it never was — keep the list honest.
const GPL_GATED_FILTERS = ['boxblur', 'eq'];

function enabledFilters(): string[] {
  // Bash continues double-quoted strings across `\`-newline; join them before matching the flag.
  const script = readFileSync(COMMON_SH, 'utf8').replace(/\\\n/g, '');
  const match = script.match(/--enable-filter=([^\s"]+)/);

  if (!match) {
    throw new Error('FF_COMMON --enable-filter list not found in scripts/ffmpeg/common.sh');
  }

  return match[1].split(',');
}

describe('on-device FFmpeg build filter list', () => {
  it('enables every lavfi source the editor emits', () => {
    const filters = enabledFilters();

    for (const source of EMITTED_LAVFI_SOURCES) {
      expect(filters, `lavfi source "${source}" must be in FF_COMMON --enable-filter`).toContain(source);
    }
  });

  it('does not list GPL-gated filters the --disable-gpl build silently drops', () => {
    const filters = enabledFilters();

    for (const gated of GPL_GATED_FILTERS) {
      expect(filters, `"${gated}" is GPL-gated and never built; listing it is dead config`).not.toContain(gated);
    }
  });
});
