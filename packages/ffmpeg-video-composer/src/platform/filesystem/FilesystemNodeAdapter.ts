import { inject, injectable } from 'tsyringe';
import { promises as fs, createWriteStream } from 'node:fs';
import { fileURLToPath } from 'node:url';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import axios, { type AxiosResponse, type ResponseType } from 'axios';
import AbstractFilesystem from './AbstractFilesystem';
import { assertSafeRemoteUrl } from './urlGuard';
import { catalogAssetUrl } from '../../core/asset-source';
import type AbstractLogger from '../../platform/logging/AbstractLogger';

// Cap on redirect hops the guarded follower will chase before giving up. Bounds
// redirect loops and long chains; legitimate media/font URLs resolve in 0-1 hops.
const MAX_REDIRECT_HOPS = 5;

// Close each download connection when its response ends. Node 19+ defaults the global agent to
// keepAlive:true, which pools these sockets open ~25s after a render and keeps the event loop alive —
// the CLI/MCP process appears to hang well after the output is printed. One-shot media fetches gain
// nothing from connection reuse, so opt out explicitly.
const httpAgent = new http.Agent({ keepAlive: false });
const httpsAgent = new https.Agent({ keepAlive: false });

// Follow HTTP redirects manually so the async SSRF guard runs on *every* hop, not
// just the first URL. axios' built-in redirect handling (maxRedirects > 0) would
// chase a 302 with no re-check, letting a public bait URL bounce to a private/
// metadata host. Here we keep maxRedirects: 0 and, on each 3xx Location, resolve the
// target against the current URL, re-run assertSafeRemoteUrl, then re-request — so a
// redirect to 169.254.169.254 (or any RFC1918/loopback host) is rejected, while a
// legitimate redirect to another public host is followed.
const requestWithGuardedRedirects = async (
  url: string,
  responseType: ResponseType,
  origin: string = url,
  hop = 0
): Promise<AxiosResponse> => {
  if (hop > MAX_REDIRECT_HOPS) {
    throw new Error(`Too many redirects (more than ${MAX_REDIRECT_HOPS}) while fetching ${origin}`);
  }

  // Guard this URL (including the very first one) before issuing the request.
  await assertSafeRemoteUrl(url);

  const response = await axios({
    method: 'get',
    url,
    responseType,
    maxRedirects: 0,
    httpAgent,
    httpsAgent,
    // Accept 3xx as a non-error response so we can read Location and re-validate the
    // next hop ourselves; without this axios rejects 3xx when maxRedirects is 0.
    validateStatus: (status) => (status >= 200 && status < 300) || (status >= 300 && status < 400),
  });

  if (response.status < 300 || response.status >= 400) {
    return response;
  }

  const location = response.headers.location as string | undefined;

  if (!location) {
    return response;
  }

  // Resolve relative Locations against the current URL (absolute ones pass through),
  // then recurse so the destination is guarded before the next request.
  const next = new URL(location, url).toString();

  return requestWithGuardedRedirects(next, responseType, origin, hop + 1);
};

@injectable()
class FilesystemNodeAdapter extends AbstractFilesystem {
  protected override root: string = globalThis.process.cwd();
  protected override tempDir: string = os.tmpdir();

  constructor(@inject('logger') private readonly logger: AbstractLogger) {
    super();
  }

  override getAssetsPath = async (dir: string): Promise<string> => {
    // Resolve under the configured assets directory (set from ProjectConfig.assetsDir by the
    // director), consistent with getSource() for videos. This keeps asset resolution independent
    // of process.cwd(). Fall back to the monorepo source layout only when nothing is configured.
    if (this.assetsDir) {
      return path.join(this.assetsDir, dir);
    }

    return path.join(this.root, 'packages', 'leclap-creative-kit', 'src', 'assets', dir);
  };

  override getBuildPath = async (dir: string): Promise<string> => {
    const fullPath = path.join(this.buildDir ?? '', dir);
    await fs.mkdir(fullPath, { recursive: true });

    return fullPath;
  };

  override getSource = (segmentName: string | undefined): string => {
    const resolvedName = segmentName ?? this.segmentName;

    return resolvedName ? path.join(this.assetsDir ?? '', 'videos', `${resolvedName}.mp4`) : '';
  };

  override getDestination = (): string => path.join(this.buildDir ?? '', `${this.segmentName}_output.mp4`);

  // Allow copying a local file only when it resolves under a known staging dir (assetsDir/tempDir/
  // buildDir). Symlinks are resolved first so a template descriptor can't traverse out of tree
  // (e.g. point pictureUrl/music at /etc/passwd or an ssh key).
  private readonly resolveStagedPath = async (url: string): Promise<string> => {
    const roots = [this.assetsDir, this.tempDir, this.buildDir].filter((r): r is string => Boolean(r));
    // Resolve the source and every staging root in parallel; roots that don't exist yet resolve to ''.
    const [real, ...realRoots] = await Promise.all([
      fs.realpath(url),
      ...roots.map((root) => fs.realpath(root).catch(() => '')),
    ]);

    if (realRoots.some((root) => root !== '' && (real === root || real.startsWith(root + path.sep)))) {
      return real;
    }

    throw new Error(`Refusing to read a file outside the staged media directories: ${url}`);
  };

  // Decide how fetch() satisfies a reference. Returns null when it was served from a local staged copy
  // (already written to `dest`), otherwise the remote URL to download. An http(s) URL passes through; a
  // reference with no staged copy is resolved against the public asset library when it's a bare
  // catalog-relative path (videos/…, pictures/…), while absolute/schemed paths re-raise the staging
  // rejection (never silently remapped to a remote).
  private readonly resolveFetchUrl = async (url: string, dest: string): Promise<string | null> => {
    if (/^https?:\/\//i.test(url)) {
      return url;
    }

    const local = await this.resolveStagedPath(this.localCandidate(url)).catch(() => null);

    if (local) {
      await fs.copyFile(local, dest);

      return null;
    }

    if (url.startsWith('/') || url.includes('://')) {
      await this.resolveStagedPath(this.localCandidate(url));
    }

    return catalogAssetUrl(url);
  };

  override fetch = async (url: string): Promise<string> => {
    const dest = path.join(this.tempDir, path.basename(url));
    const remote = await this.resolveFetchUrl(url, dest);

    if (remote === null) {
      return dest;
    }

    // SSRF guard: reject non-http(s) schemes and private/reserved destinations
    // (cloud metadata, loopback, RFC1918, ...) — re-checked on every redirect hop.
    const response = await requestWithGuardedRedirects(remote, 'stream');

    const writer = createWriteStream(dest);

    try {
      await new Promise<void>((resolve, reject) => {
        // Without listening on the source stream a mid-download failure (e.g. a
        // throttled connection) would leave a truncated file on disk that still
        // looks like a successful fetch.
        response.data.on('error', reject);
        writer.on('error', reject);
        writer.on('finish', () => {
          resolve();
        });
        response.data.pipe(writer);
      });
    } catch (error) {
      writer.destroy();
      // Drop the partial file so a later read can't pick up corrupt content.
      await fs.unlink(dest).catch(() => {});

      throw error;
    }

    return dest;
  };

  // Resolve a template asset to an already-present local file under the configured assetsDir, so a
  // render whose media is staged locally runs offline. A descriptor may reference the asset as a
  // local path or as a URL whose path mirrors the assets layout (…/assets/<subdir>/<file>); both map
  // to a candidate under assetsDir. Returns null (→ caller downloads) when nothing's configured or
  // present. resolveStagedPath enforces the result stays under a staging root (no path traversal).
  override resolveLocalAsset = async (url: string): Promise<string | null> => {
    if (!this.assetsDir && !url.startsWith('/')) return null;

    try {
      return await this.resolveStagedPath(this.localCandidate(url));
    } catch {
      return null;
    }
  };

  // The local path a descriptor asset reference maps to. A `/assets/...` reference is a web-rooted
  // asset path (what the web builder emits) and maps under assetsDir; a `/...` path WITHOUT the
  // `/assets/` marker is a real absolute device path, used as-is; a relative path is assets-relative.
  // Mirrors the Expo and Browser adapters.
  private readonly localCandidate = (url: string): string => {
    const isDevicePath = url.startsWith('/') && !url.includes('/assets/');

    return isDevicePath ? url : path.join(this.assetsDir ?? '', this.assetsRelativeFromUrl(url));
  };

  // Path after the last `/assets/` segment of a URL (…/assets/pictures/logo.png → pictures/logo.png),
  // falling back to the bare basename so a flat assets dir still resolves.
  private readonly assetsRelativeFromUrl = (url: string): string => {
    const marker = '/assets/';
    const index = url.lastIndexOf(marker);

    if (index !== -1) return url.slice(index + marker.length);

    // A bare relative path (no URL scheme) is already assets-relative — keep its subdirs intact.
    if (!url.includes('://')) return url;

    return url.slice(url.lastIndexOf('/') + 1);
  };

  override stat = async (filePath: string): Promise<boolean> => {
    try {
      await fs.stat(filePath);

      return true;
    } catch {
      return false;
    }
  };

  override read = async (filePath: string): Promise<string> => {
    return await fs.readFile(filePath, 'utf-8');
  };

  override readFile = async (filePath: string): Promise<Uint8Array> => {
    return await fs.readFile(filePath);
  };

  override copy = async (sourcePath: string, targetPath: string): Promise<void> => {
    await fs.copyFile(sourcePath, targetPath);
  };

  // Resolve a file shipped with the package (under `library/<kind>`) to an absolute local path.
  // Candidates cover both the bundled build (dist/<kind>, next to the entry) and running from
  // source/tests (packages/leclap-creative-kit/src/library/<kind>). Returns null when it isn't bundled.
  private async resolveBundledAsset(kind: string, file: string): Promise<string | null> {
    let moduleDir: string;

    try {
      moduleDir = path.dirname(fileURLToPath(import.meta.url));
    } catch {
      return null;
    }

    const candidates = [
      path.join(moduleDir, kind, file),
      path.join(moduleDir, '..', '..', '..', '..', 'leclap-creative-kit', 'src', 'library', kind, file),
    ];
    const present = await Promise.all(candidates.map((candidate) => this.stat(candidate)));
    const index = present.findIndex(Boolean);

    return index === -1 ? null : candidates[index];
  }

  // Find a bundled font so drawtext works offline and out-of-the-box on Node (server/MCP/library) —
  // the previous behaviour downloaded from Google Fonts, which fails for the bundled single-token
  // family names (BebasNeue, PlayfairDisplay, …).
  override resolveBundledFont = (fontFile: string): Promise<string | null> =>
    this.resolveBundledAsset('fonts', fontFile);

  // Find a bundled music track so `global.music` resolves offline on Node (server/MCP/library)
  // instead of requiring a network download.
  override resolveBundledMusic = (musicFile: string): Promise<string | null> =>
    this.resolveBundledAsset('musics', musicFile);

  override move = async (sourcePath: string, targetPath: string): Promise<void> => {
    const exists = await fs
      .access(sourcePath)
      .then(() => true)
      .catch(() => false);

    if (!exists) {
      throw new Error(`${sourcePath} not found`);
    }

    // Stage into a not-yet-existing dir (e.g. a fresh assets/videos/) and tolerate a cross-device
    // rename (tempDir on a different volume than the target): mkdir -p, then rename, then copy+unlink.
    await fs.mkdir(path.dirname(targetPath), { recursive: true });

    try {
      await fs.rename(sourcePath, targetPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EXDEV') {
        throw error;
      }

      await fs.copyFile(sourcePath, targetPath);
      await fs.unlink(sourcePath);
    }
  };

  override unlink = (filePath: string): Promise<void> => {
    this.write(filePath).catch(() => {});

    return fs.unlink(filePath);
  };

  override write = (targetPath: string): Promise<void> => fs.writeFile(targetPath, '');

  override writeFile = async (path: string, data: Uint8Array): Promise<void> => {
    await fs.writeFile(path, data);
  };

  append = async (targetPath: string, content: string): Promise<void> => {
    if (
      !(await fs
        .access(targetPath)
        .then(() => true)
        .catch(() => false))
    ) {
      throw new Error(`${targetPath} doesn't exist`);
    }

    return fs.appendFile(targetPath, content);
  };

  fetchAndRead = async (url: string): Promise<string> => {
    try {
      // SSRF guard: same class as fetch() — a template-supplied font URL must not be able to
      // reach cloud metadata, loopback, or RFC1918 hosts, on the first request or any redirect.
      // Google Fonts CSS can answer 302, so redirects are followed but re-validated per hop.
      const response = await requestWithGuardedRedirects(url, 'text');

      return response.data;
    } catch (error) {
      const params = error instanceof Error ? { message: error.message } : undefined;
      this.logger.error(`Error downloading from ${url}:`, params);

      throw error;
    }
  };
}

export default FilesystemNodeAdapter;
