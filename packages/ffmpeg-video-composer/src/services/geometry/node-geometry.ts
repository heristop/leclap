import { fontAssetUrl } from '@/core/asset-source';
import { findFontByFile } from '@/core/fonts';
import FilesystemNodeAdapter from '../../platform/filesystem/FilesystemNodeAdapter';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import PinoLogAdapter from '../../platform/logging/PinoLogAdapter';
import type { TemplateDescriptor } from '../../schemas/template.schemas';
import { TemplateValidator } from '../TemplateValidator';
import { createBundledFontLoader, type FontLoader } from './bundled-font-loader';
import type { GeometryWarning } from './rules';

// Node-only: the one place the geometry check is allowed to reach disk and network. Exported from
// the Node entry alone, so the geometry module itself stays reachable from the browser and
// React-Native builds. The CLI and the MCP server both call `nodeGeometryWarnings` rather than
// wiring the loader themselves — two hand-rolled copies had already drifted apart.

// Appended to a finding measured from an estimate. Agents parse it out of the MCP `geometry` array,
// so the CLI and the MCP server must print the same string.
export const GEOMETRY_APPROX_MARKER = ' (approx: estimated, not measured)';

// Bundled first, then the catalog URL the renderer stages from (AssetManager.stageFont). A published
// install ships no fonts, so without the fetch every `pnpm dlx @leclap/cli validate` measured the
// estimate while the render used the real typeface. Offline, or a file the catalog does not know,
// degrades to null — the caller measures approximately and flags it.
export function createNodeFontLoader(filesystem: AbstractFilesystem): FontLoader {
  const bundled = createBundledFontLoader(filesystem);

  return async (fontFile: string): Promise<Uint8Array | null> => {
    const local = await bundled(fontFile);

    if (local || !findFontByFile(fontFile)) {
      return local;
    }

    try {
      const downloaded = await filesystem.fetch(fontAssetUrl(fontFile));
      const bytes = await filesystem.readFile(downloaded);
      await filesystem.unlink(downloaded).catch(() => {});

      return bytes;
    } catch {
      return null;
    }
  };
}

// Only a SUCCESSFUL read is kept for the life of the process. A null or a rejection evicts: caching
// one transient failure — an EMFILE under load, a dropped connection — would pin a long-lived MCP
// server to approximate measurements until restart, with nothing in the output to say why.
export function cachedFontLoader(loader: FontLoader): FontLoader {
  const cache = new Map<string, Promise<Uint8Array | null>>();

  return (fontFile: string): Promise<Uint8Array | null> => {
    const cached = cache.get(fontFile);

    if (cached) {
      return cached;
    }

    const pending = loader(fontFile).then(
      (bytes) => {
        if (!bytes) {
          cache.delete(fontFile);
        }

        return bytes;
      },
      (error: unknown) => {
        cache.delete(fontFile);

        throw error;
      }
    );

    cache.set(fontFile, pending);

    return pending;
  };
}

let defaultLoader: FontLoader | undefined;

// Built on first use rather than at import: the logger binds to stdout, which is the MCP server's
// JSON-RPC channel, so nothing should construct one merely by importing the engine.
function nodeFontLoader(): FontLoader {
  defaultLoader ??= cachedFontLoader(createNodeFontLoader(new FilesystemNodeAdapter(new PinoLogAdapter())));

  return defaultLoader;
}

interface NodeGeometryOptions {
  validator?: Pick<TemplateValidator, 'getGeometryWarnings'>;
  loadFont?: FontLoader;
}

// Advisory, so it must never fail the caller: a throw degrades to no findings. Not in silence —
// every expected failure is already absorbed by the loader and the parser, so anything landing here
// is a bug, and stderr keeps it visible without corrupting `--json` or the MCP protocol on stdout.
export async function nodeGeometryWarnings(
  descriptor: TemplateDescriptor,
  options: NodeGeometryOptions = {}
): Promise<GeometryWarning[]> {
  try {
    const validator = options.validator ?? new TemplateValidator();

    return await validator.getGeometryWarnings(descriptor, options.loadFont ?? nodeFontLoader());
  } catch (error) {
    process.stderr.write(`geometry checks skipped: ${error instanceof Error ? error.message : String(error)}\n`);

    return [];
  }
}
