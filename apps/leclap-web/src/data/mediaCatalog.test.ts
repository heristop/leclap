import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY, type MediaCredit } from './mediaCatalog';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '../../public');

function checkCatalog(name: string, entries: MediaCredit[]) {
  describe(name, () => {
    it('has unique ids', () => {
      const ids = entries.map((e) => e.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it.each(entries)('$id has complete credit fields and an existing file', (entry) => {
      expect(entry.title.length).toBeGreaterThan(0);
      expect(entry.author.length).toBeGreaterThan(0);
      expect(entry.license.length).toBeGreaterThan(0);
      expect(entry.sourceUrl.length).toBeGreaterThan(0);
      expect(entry.url.startsWith('/')).toBe(true);
      const filePath = resolve(publicDir, `.${entry.url}`);
      expect(existsSync(filePath), `missing file: ${filePath}`).toBe(true);
      expect(readFileSync(filePath).length).toBeGreaterThan(0);
    });
  });
}

checkCatalog('MUSIC_LIBRARY', MUSIC_LIBRARY);
checkCatalog('BACKGROUND_LIBRARY', BACKGROUND_LIBRARY);
