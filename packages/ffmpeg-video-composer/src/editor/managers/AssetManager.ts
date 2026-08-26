import { inject, injectable } from 'tsyringe';
import type AbstractLogger from '../../platform/logging/AbstractLogger';
import type AbstractFilesystem from '../../platform/filesystem/AbstractFilesystem';
import type { Media, MapAnimationInput, SectionOptions } from '@/core/types';
import type Template from '../../core/models/Template';
import type Segment from '../../core/models/Segment';
import type VariableManager from './VariableManager';
import { cubeFor } from '../presets/lut-library';
import { parsePanelUrl, panelFileName, roundedPanelPng } from '../presets/rounded-panel';
import { findFontByFile, DEFAULT_FONT_WEIGHT, type FontRef } from '@/core/fonts';
import { googleCssUrl, extractTtfUrl, GOOGLE_FONTS_USER_AGENT } from '@/core/google-fonts';
import { fontAssetUrl } from '@/core/asset-source';
import type { FontRequest } from '../../core/models/Segment';

// Back-compat for a raw `.ttf` filename that is neither bundled nor in the catalog: the family is
// guessed from the file stem, as it always was. The guess only holds for single-word families
// (`Roboto-Bold.ttf` → "Roboto", and the weight in the name is ignored) — which is exactly why
// `FontRef` exists. Authoring a font by family should always be preferred over relying on this.
function legacyRefFromFileName(file: string): FontRef {
  return { family: file.split('-')[0].split('.')[0] };
}

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
    this.segment.panelsDir = await this.filesystemAdapter.getBuildPath('panels');
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
    await Promise.all(this.segment.tempFonts.map((request) => this.stageFont(request)));
  };

  // Stages one font, trying the cheapest source first. Every rung is a real fallback except the last:
  // a font that cannot be staged throws, because a missing font does not stop the render — drawtext
  // simply draws with the wrong face, and the failure only shows up as a visibly wrong video.
  private async stageFont({ file, ref }: FontRequest): Promise<void> {
    const targetPath = `${this.segment.fontsDir}/${file}`;

    if (await this.stageFontLocally(file, targetPath)) {
      return;
    }

    await this.fetchRemoteFont(file, ref ?? legacyRefFromFileName(file), targetPath);
  }

  // The rungs that need no Google lookup, cheapest first. Returns true once the font is in place.
  private async stageFontLocally(file: string, targetPath: string): Promise<boolean> {
    const section = this.segment.currentSection?.name;

    // Reuse an already-downloaded font instead of re-fetching it. This keeps the same font family
    // from being requested once per section, which is what gets Google Fonts to rate-limit.
    if (await this.filesystemAdapter.stat(targetPath)) {
      this.logger.info(`[${section}][Font] cached ${file}`);

      return true;
    }

    // Prefer a font shipped/staged alongside the package (resolved locally on Node) over a network
    // fetch, so renders work offline when assets are pre-staged. Falls through when not present.
    const bundled = await this.filesystemAdapter.resolveBundledFont(file);

    if (bundled) {
      await this.filesystemAdapter.copy(bundled, targetPath);
      this.logger.info(`[${section}][Font] bundled ${file}`);

      return true;
    }

    // A font downloaded by an earlier render. The build dir is wiped between runs, so this cache is
    // what keeps a repeat render of the same resolved font offline.
    const cached = await this.filesystemAdapter.resolveCachedFont(file);

    if (cached) {
      await this.filesystemAdapter.copy(cached, targetPath);
      this.logger.info(`[${section}][Font] cache hit ${file}`);

      return true;
    }

    return this.stageCatalogFont(file, targetPath);
  }

  // Catalog fonts (premium single-token families Google Fonts can't resolve) are fetched by file
  // name from the asset source (GitHub by default, see asset-source.ts) instead of being bundled.
  private async stageCatalogFont(file: string, targetPath: string): Promise<boolean> {
    if (!findFontByFile(file)) {
      return false;
    }

    const assetUrl = fontAssetUrl(file);
    this.logger.info(`[${this.segment.currentSection?.name}][Font] fetching ${assetUrl}`);

    const downloaded = await this.filesystemAdapter.fetch(assetUrl);
    await this.filesystemAdapter.move(downloaded, targetPath);

    return true;
  }

  // Downloads the face named by `ref` from Google Fonts and stages it, then seeds the persistent
  // cache so the next render skips the network entirely.
  private async fetchRemoteFont(file: string, ref: FontRef, targetPath: string): Promise<void> {
    const section = this.segment.currentSection?.name;

    if (!this.filesystemAdapter.supportsRemoteFonts) {
      throw new Error(
        `[${section}][Font] cannot resolve "${ref.family}" on this platform: it cannot request a TrueType face ` +
          `(Google returns woff2, which drawtext cannot read). Bundle the font with the app instead.`
      );
    }

    const url = googleCssUrl(ref);
    this.logger.info(`[${section}][Font] fetching ${url}`);

    const cssContent = await this.filesystemAdapter.fetchAndRead(url, {
      'User-Agent': GOOGLE_FONTS_USER_AGENT,
    });
    const fontUrl = extractTtfUrl(cssContent);

    if (!fontUrl) {
      throw new Error(
        `[${section}][Font] no TrueType face for "${ref.family}" weight ${ref.weight ?? DEFAULT_FONT_WEIGHT}` +
          `${ref.style === 'italic' ? ' italic' : ''} (staged as ${file}). Check the family name exists on Google Fonts.`
      );
    }

    this.logger.info(`[${section}][Font] fetching ${fontUrl}`);

    const path = await this.filesystemAdapter.fetch(fontUrl);
    await this.filesystemAdapter.move(path, targetPath);
    await this.filesystemAdapter.cacheFont(file, targetPath);
  }

  // Write `produce()` to `targetPath` unless it is already staged, logging cached/staged under `label`.
  // Returns false only when `produce` yields null (nothing to write). Shared by the LUT and panel
  // generators — both synthesise a build-FS asset on the fly (uniform on Node, Expo and browser/WASM)
  // rather than fetching one, so there are no bundled binary assets to ship per platform.
  private readonly stageGenerated = async (
    targetPath: string,
    name: string,
    label: string,
    produce: () => Uint8Array | null
  ): Promise<boolean> => {
    const section = this.segment.currentSection?.name;

    if (await this.filesystemAdapter.stat(targetPath)) {
      this.logger.info(`[${section}][${label}] cached ${name}`);

      return true;
    }

    const bytes = produce();

    if (!bytes) {
      return false;
    }

    await this.filesystemAdapter.writeFile(targetPath, bytes);
    this.logger.info(`[${section}][${label}] staged ${name}`);

    return true;
  };

  // Stage every LUT referenced by a lut3d look (collected into tempLuts by the FormatterManager).
  fetchLuts = async (): Promise<void> => {
    await Promise.all(
      this.segment.tempLuts.map(async (name) => {
        const staged = await this.stageGenerated(`${this.segment.lutsDir}/${name}.cube`, `${name}.cube`, 'LUT', () => {
          const cube = cubeFor(name);

          return cube ? new TextEncoder().encode(cube) : null;
        });

        if (!staged) {
          this.logger.error(`[${this.segment.currentSection?.name}][LUT] unknown LUT ${name}`);
        }
      })
    );
  };

  fetchMedia = async (media: Media, frame = 0): Promise<void> => {
    const { name, url, extension } = this.extractFromMedia(media, frame);
    const cache = this.inputsCache;

    if (cache[url]) {
      return;
    }

    // A `panel:` URL is a generated rounded-rect overlay, not a fetchable asset: build the PNG on the
    // fly and stage it to the build FS (uniform on Node, Expo and browser/WASM), mirroring fetchLuts.
    const panelSpec = parsePanelUrl(url);

    if (panelSpec) {
      const panelPath = `${this.segment.panelsDir}/${panelFileName(panelSpec)}`;

      await this.stageGenerated(panelPath, panelFileName(panelSpec), 'Panel', () => roundedPanelPng(panelSpec));
      cache[url] = panelPath;

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

    await this.downloadMedia(name, url, extension);
  };

  private readonly downloadMedia = async (name: string, url: string, extension: string): Promise<void> => {
    this.logger.info(`[${this.segment.currentSection?.name}][Media] fetching asset ${name}`);

    const path = await this.filesystemAdapter.fetch(url);
    const targetPath = `${this.segment.assetsDir}/${name}.${extension}`;

    await this.filesystemAdapter.move(path, targetPath);

    this.inputsCache[url] = targetPath;
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
