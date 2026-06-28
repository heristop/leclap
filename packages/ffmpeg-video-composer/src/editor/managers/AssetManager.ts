import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type { Media, MapAnimationInput, SectionOptions } from '@/core/types';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type VariableManager from './VariableManager';
import { cubeFor } from '../presets/lut-library';
import { findFontByFile } from '@/core/fonts';
import { fontAssetUrl } from '@/core/asset-source';

// The shared TemplateAssets type declares `inputs` as string[] for legacy reasons,
// but it is used at runtime as a string-keyed cache of staged media paths.
type InputsCache = Record<string, string>;

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
    this.segment.lutsDir = await this.filesystemAdapter.getBuildPath('luts');
  }

  prepareAssets = (): void => {
    const currentSection = this.segment.currentSection;

    if (!currentSection) {
      return;
    }

    const options = currentSection.options as SectionOptions & Record<string, string | undefined>;

    for (const key in options) {
      if (Object.hasOwnProperty.call(options, key) && key.endsWith('Url')) {
        // The section background (e.g. image_background's pictureUrl) is the base layer and must be the
        // first input: image_background loops it with `-loop 1`, which binds to the first `-i`. If an
        // animation overlay precedes it, `-loop 1` lands on an animation `.apng` (whose demuxer has no
        // `loop` option) and the overlays composite onto the wrong base stream.
        currentSection.inputs = [
          {
            name: currentSection.name,
            url: options[key] ?? '',
          },
          ...(currentSection.inputs ?? []),
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

    // Single-file media — animations (.apng/.webp/.gif/.webm) are fetched like any other asset.
    await this.fetchMedia(item);
  };

  fetchFonts = async (): Promise<void> => {
    await Promise.all(this.segment.tempFonts.map((fontFile) => this.stageFont(fontFile)));
  };

  private async stageFont(fontFile: string): Promise<void> {
    const targetPath = `${this.segment.fontsDir}/${fontFile}`;

    // Reuse an already-downloaded font instead of re-fetching it. This keeps the same font family
    // from being requested once per section, which is what gets Google Fonts to rate-limit.
    if (await this.filesystemAdapter.stat(targetPath)) {
      this.logger.info(`[${this.segment.currentSection?.name}][Font] cached ${fontFile}`);

      return;
    }

    // Prefer a font shipped/staged alongside the package (resolved locally on Node) over a network
    // fetch, so renders work offline when assets are pre-staged. Falls through when not present.
    const bundled = await this.filesystemAdapter.resolveBundledFont(fontFile);

    if (bundled) {
      await this.filesystemAdapter.copy(bundled, targetPath);
      this.logger.info(`[${this.segment.currentSection?.name}][Font] bundled ${fontFile}`);

      return;
    }

    // Catalog fonts (premium single-token families Google Fonts can't resolve) are fetched by file
    // name from the asset source (GitHub by default, see asset-source.ts) instead of being bundled.
    if (findFontByFile(fontFile)) {
      const assetUrl = fontAssetUrl(fontFile);
      this.logger.info(`[${this.segment.currentSection?.name}][Font] fetching ${assetUrl}`);

      const downloaded = await this.filesystemAdapter.fetch(assetUrl);
      await this.filesystemAdapter.move(downloaded, targetPath);

      return;
    }

    await this.fetchGoogleFont(fontFile, targetPath);
  }

  // Fall back to Google Fonts for standard families (a single-segment `family` derived from the file).
  private async fetchGoogleFont(fontFile: string, targetPath: string): Promise<void> {
    const fontFamily = fontFile.split('-')[0].split('.')[0];
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
  }

  // Stage every LUT referenced by a lut3d look (collected into tempLuts by the FormatterManager).
  // The `.cube` text is generated on the fly and written to the build FS — uniform on Node, Expo and
  // the browser/WASM virtual FS — so there are no bundled binary assets to ship per platform.
  fetchLuts = async (): Promise<void> => {
    await Promise.all(
      this.segment.tempLuts.map(async (name) => {
        const targetPath = `${this.segment.lutsDir}/${name}.cube`;

        if (await this.filesystemAdapter.stat(targetPath)) {
          this.logger.info(`[${this.segment.currentSection?.name}][LUT] cached ${name}.cube`);

          return;
        }

        const cube = cubeFor(name);

        if (!cube) {
          this.logger.error(`[${this.segment.currentSection?.name}][LUT] unknown LUT ${name}`);

          return;
        }

        await this.filesystemAdapter.writeFile(targetPath, new TextEncoder().encode(cube));
        this.logger.info(`[${this.segment.currentSection?.name}][LUT] staged ${name}.cube`);
      })
    );
  };

  private readonly extractFontUrlFromCSS = (cssContent: string): string | null => {
    const regex = /url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/;
    const match = cssContent.match(regex);

    return match ? match[1] : null;
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
      return cache[url];
    }

    if (name in cache) {
      return cache[name];
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
