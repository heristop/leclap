// Media a template link cannot carry: references only the author's machine (or browser) can read. A link
// travels as text, so a clip at /Users/me/take.mp4 or an upload keyed media://abc in another browser's
// store reaches the builder as a dangling path. These are listed so the agent can say so and the builder
// can turn them into empty slots the user fills again. Library names, served /assets/ paths, http(s)
// and data: URLs and {{ variables }} resolve wherever the template opens.

export type MediaRebindReason = 'local_path' | 'browser_blob' | 'device_upload';

export interface MediaToRebind {
  /** RFC 6901 JSON Pointer to the field. */
  pointer: string;
  value: string;
  reason: MediaRebindReason;
}

// The descriptor fields that hold a media path or URL (sections, inputs, global music/watermark/animations,
// LUTs, cutaways, drawtext fonts). Effect `assets` values are media too, whatever their key.
const MEDIA_KEYS = new Set(['url', 'videoUrl', 'pictureUrl', 'logoUrl', 'backgroundUrl', 'fontfile']);
// Absolute paths the web app serves itself (public/ and the staged creative-kit library).
const SERVED_ROOTS = ['/assets/', '/musics/', '/backgrounds/', '/fonts/', '/videos/', '/images/'];
const SCHEME = /^([a-z][a-z0-9+.-]*):/i;
const WINDOWS_PATH = /^[a-z]:[\\/]/i;

function schemeReason(scheme: string): MediaRebindReason | null {
  if (scheme === 'media') return 'device_upload';

  if (scheme === 'blob') return 'browser_blob';

  return scheme === 'file' ? 'local_path' : null;
}

/** Why `value` cannot resolve where the link opens, or null when it can. */
export function classifyMediaRef(raw: string): MediaRebindReason | null {
  const value = raw.trim();

  if (value === '' || value.includes('{{')) return null;

  if (WINDOWS_PATH.test(value) || value.startsWith(String.raw`\\`)) return 'local_path';

  const scheme = SCHEME.exec(value)?.[1].toLowerCase();

  if (scheme) return schemeReason(scheme);

  if (value.startsWith('~') || value.startsWith('./') || value.startsWith('../')) return 'local_path';

  if (!value.startsWith('/')) return null;

  return SERVED_ROOTS.some((root) => value.startsWith(root)) ? null : 'local_path';
}

function escapeSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function visit(node: unknown, pointer: string, inAssets: boolean, out: MediaToRebind[]): void {
  if (Array.isArray(node)) {
    for (const [index, item] of node.entries()) visit(item, `${pointer}/${String(index)}`, false, out);

    return;
  }

  if (!node || typeof node !== 'object') return;

  for (const [key, child] of Object.entries(node)) {
    const at = `${pointer}/${escapeSegment(key)}`;

    if (typeof child !== 'string') {
      visit(child, at, key === 'assets', out);
      continue;
    }

    const reason = inAssets || MEDIA_KEYS.has(key) ? classifyMediaRef(child) : null;

    if (reason) out.push({ pointer: at, value: child, reason });
  }
}

/** Every media field of `template` that must be re-bound after opening it from a link, in document order. */
export function mediaToRebind(template: unknown): MediaToRebind[] {
  const out: MediaToRebind[] = [];
  visit(template, '', false, out);

  return out;
}
