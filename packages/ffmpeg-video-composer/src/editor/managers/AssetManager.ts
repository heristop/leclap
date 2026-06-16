import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type { Media, MapAnimationInput, SectionOptions } from '@/core/types';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type VariableManager from './VariableManager';

// The shared TemplateAssets type declares `inputs` as string[] for legacy reasons,
// but it is used at runtime as a string-keyed cache of string or string[] values.
type InputsCache = Record<string, string | string[]>;

// A resolved Media with guaranteed name, url, and extension strings.
type ResolvedMedia = {
  name: string;
  url: string;
  extension: string;
};

@injectable()
class AssetManager {
  constructor(
    @inject('template') private readonly template: Template,
    @inject('VariableManager') private readonly variableManager: VariableManager,

    @inject('segment') public segment: Segment,

    @inject('logger') private readonly logger: AbstractLogger,
    @inject('filesystemAdapter') private readonly filesystemAdapter: AbstractFilesystem
  ) {}

  private get inputsCache(): InputsCache {
    return this.template.assets.inputs as unknown as InputsCache;
  }

  async setUpPaths(): Promise<void> {
    this.segment.assetsDir = await this.filesystemAdapter.getBuildPath('assets');
    this.segment.fontsDir = await this.filesystemAdapter.getBuildPath('fonts');
    this.segment.animationsDir = await this.filesystemAdapter.getBuildPath('animations');
  }

  prepareAssets = (): void => {
    const currentSection = this.segment.currentSection;

    if (!currentSection) {
      return;
    }

    const options = currentSection.options as SectionOptions & Record<string, string | undefined>;

    for (const key in options) {
      if (Object.hasOwnProperty.call(options, key) && key.endsWith('Url')) {
        currentSection.inputs = [
          ...(currentSection.inputs ?? []),
          {
            name: currentSection.name,
            url: options[key] ?? '',
          },
        ];
      }
    }
  };

  fetchAssets = async (): Promise<void> => {
    this.prepareAssets();

    const currentSection = this.segment.currentSection;

    if (!currentSection) {
      return;
    }

    try {
      await Promise.all(
        (currentSection.inputs ?? []).map(async (item) => {
          const animationItem = item as MapAnimationInput;
          await this.fetchSingleAsset(animationItem);
          this.logger.info(`[${currentSection.name}][Assets] ${animationItem.name}`);
        })
      );
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : String(error));

      throw error;
    }
  };

  private readonly resolveItemUrl = (item: MapAnimationInput): void => {
    if (!item.url) {
      // If no url filled, use variables
      item.url = `{{ ${item.name} }}`;
    }

    // Map variables
    item.url = this.variableManager.mapVariables(item.url);
  };

  private readonly fetchSingleAsset = async (item: MapAnimationInput): Promise<void> => {
    if (this.inputsCache[item.name]) {
      return;
    }

    this.resolveItemUrl(item);

    // A ref is an http(s) URL, an absolute staged path, or a path relative to assetsDir — all valid.
    // The only invalid case is a `{{ … }}` that never got mapped to a real value.
    if (item.url.includes('{{')) {
      throw new Error(`[${this.segment.currentSection?.name}][Assets] Url for ${item.name} is not valid: ${item.url}`);
    }

    const isZipAnimation = item.type === 'animation' && new RegExp('(.*?).(zip)$').test(item.url);

    if (isZipAnimation) {
      // Process zip animation
      await this.fetchAndUnzipAnimation(item);

      return;
    }

    // Process single media
    await this.fetchMedia(item);
  };

  fetchFonts = async (): Promise<void> => {
    await Promise.all(
      this.segment.tempFonts.map(async (fontFile) => {
        const fontFamily = fontFile.split('-')[0].split('.')[0];
        const targetPath = `${this.segment.fontsDir}/${fontFile}`;

        // Reuse an already-downloaded font instead of re-fetching it. This keeps the
        // same font family from being requested once per section, which is what gets
        // Google Fonts to rate-limit (and intermittently break the drawtext filter).
        if (await this.filesystemAdapter.stat(targetPath)) {
          this.logger.info(`[${this.segment.currentSection?.name}][Font] cached ${fontFile}`);

          return;
        }

        // Prefer the font shipped with the package over a network fetch — premium templates use
        // bundled fonts whose single-token family names Google Fonts can't resolve, and this keeps
        // Node/server/MCP renders working offline. Falls through to the download when not bundled.
        const bundled = await this.filesystemAdapter.resolveBundledFont(fontFile);

        if (bundled) {
          await this.filesystemAdapter.copy(bundled, targetPath);
          this.logger.info(`[${this.segment.currentSection?.name}][Font] bundled ${fontFile}`);

          return;
        }

        const url = `https://fonts.googleapis.com/css?family=${fontFamily}`;
        this.logger.info(`[${this.segment.currentSection?.name}][Font] fetching ${url}`);

        const cssContent = await this.filesystemAdapter.fetchAndRead(url);
        const fontUrl = this.extractFontUrlFromCSS(cssContent);

        if (!fontUrl) {
          this.logger.info(`[${this.segment.currentSection?.name}][Font] no font url found in CSS for ${fontFamily}`);

          return;
        }

        this.logger.info(`[${this.segment.currentSection?.name}][Font] fetching ${fontUrl}`);

        const path = await this.filesystemAdapter.fetch(fontUrl);

        await this.filesystemAdapter.move(path, targetPath);
      })
    );
  };

  private readonly extractFontUrlFromCSS = (cssContent: string): string | null => {
    const regex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/;
    const match = cssContent.match(regex);

    return match ? match[1] : null;
  };

  /**
   * Builds the image2 frame-sequence input for an unzipped animation: `-framerate <fps> -i <dir>/<pattern>`.
   *
   * The frame pattern is derived from the ACTUAL extracted filenames (e.g. `CADRE_BLANC-001.png` →
   * `CADRE_BLANC-%03d.png`) rather than assumed — the zip's naming convention is preserved by stripping
   * the trailing zero-padded counter and replacing it with a printf token of the matching width.
   * Returns undefined when no frames were extracted OR the filenames carry no trailing counter
   * (e.g. `frame.png` instead of `frame001.png`) — callers should treat that as a ZIP extraction
   * failure and fall back to single-media handling, with a warning.
   */
  resolveAnimationSequencePattern = (name: string): string | undefined => {
    const cache = this.inputsCache;
    const frames = cache[name];

    if (!Array.isArray(frames) || frames.length === 0) {
      return undefined;
    }

    const firstFrame = frames[0] ?? '';
    const fileName = firstFrame.substring(firstFrame.lastIndexOf('/') + 1);

    // Match a trailing zero-padded counter before the extension: <prefix><NNN>.<ext>.
    const counterMatch = /^(.*?)(\d+)(\.[^.]+)$/.exec(fileName);

    if (!counterMatch) {
      return undefined;
    }

    const [, prefix, counter, extension] = counterMatch;
    const pattern = `${prefix}%0${counter.length}d${extension}`;

    return `${this.segment.animationsDir}/${name}/${pattern}`;
  };

  fetchAndUnzipAnimation = async (media: Media): Promise<void> => {
    // Fetch zip file
    await this.fetchMedia(media);

    const targetPath = `${this.segment.animationsDir}/${media.name}`;
    const cache = this.inputsCache;

    if (cache[media.name]) {
      return;
    }

    const mediaUrl = media.url ?? '';
    const cachedUrl = mediaUrl === '' ? undefined : cache[mediaUrl];
    const url = typeof cachedUrl === 'string' ? cachedUrl : mediaUrl;

    const framesList = await this.filesystemAdapter.unzip(url, targetPath);

    cache[media.name] ??= [];

    const frames = cache[media.name];

    if (Array.isArray(frames)) {
      for (const frame of framesList) {
        frames.push(frame);
      }
    }
  };

  fetchMedia = async (media: Media, frame = 0): Promise<void> => {
    const { name, url, extension } = this.extractFromMedia(media, frame);
    const cache = this.inputsCache;

    if (cache[url]) {
      return;
    }

    // Offline-first: use a local copy staged under assetsDir when present, only download otherwise
    // (mirrors bundled fonts/music). Lets renders run without the network for locally-staged media.
    const local = await this.filesystemAdapter.resolveLocalAsset(url);

    if (local) {
      this.logger.info(`[${this.segment.currentSection?.name}][Media] local asset ${name}`);
      cache[url] = local;

      return;
    }

    this.logger.info(`[${this.segment.currentSection?.name}][Media] fetching asset ${name}`);

    const path = await this.filesystemAdapter.fetch(url);
    const targetPath = `${this.segment.assetsDir}/${name}.${extension}`;

    await this.filesystemAdapter.move(path, targetPath);

    cache[url] = targetPath;
    this.logger.info(`[${this.segment.currentSection?.name}][Media] fetched asset ${name}`);
  };

  fetchCachedMedia = (media: Media, frame = 0): string => {
    const { name, url } = this.extractFromMedia(media, frame);
    const cache = this.inputsCache;

    if (url in cache) {
      const byUrl = cache[url];

      return typeof byUrl === 'string' ? byUrl : (byUrl[0] ?? '');
    }

    if (name in cache) {
      const byName = cache[name];

      return typeof byName === 'string' ? byName : (byName[0] ?? '');
    }

    throw new Error(`No cache found for keys ${url}, ${name}`);
  };

  extractFromMedia = (media: Media, frame = 0): ResolvedMedia => {
    const mediaUrl = media.url ?? '';
    const extension = this.getExtensionFromUrl(mediaUrl);
    let url = this.variableManager.mapVariables(mediaUrl);
    let name = this.generateName(media, url, frame);

    url = this.replaceFrameInUrl(url, frame);
    name = this.replaceFrameInName(name, frame);

    return { name, url, extension };
  };

  private readonly getExtensionFromUrl = (url: string): string => {
    return url.split('.').pop() ?? '';
  };

  private readonly generateName = (media: Media, url: string, frame: number): string => {
    if (frame || !media.name) {
      return url
        .substring(url.lastIndexOf('/') + 1)
        .split('.')
        .slice(0, -1)
        .join('.');
    }

    return media.name;
  };

  private readonly replaceFrameInUrl = (url: string, frame: number): string => {
    if (frame && url.includes('%d')) {
      const framePattern = /-([0-9]{3}).([a-z]{3})$/;
      const frameString = `00${frame}`.slice(-3);

      return framePattern.test(url) ? url.replace('%d', frameString) : url.replace('%d', `${frame}`);
    }

    return url;
  };

  private readonly replaceFrameInName = (name: string, frame: number): string => {
    return frame ? name.replace('%d', `00${frame}`.slice(-3)) : name;
  };
}

export default AssetManager;
