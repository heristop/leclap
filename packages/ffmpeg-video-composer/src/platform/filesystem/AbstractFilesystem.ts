import { assertSafeSegmentName } from '../../core/argGuard';

abstract class AbstractFilesystem {
  protected root: string | undefined;
  protected tempDir: string | undefined;
  protected segmentName: string | undefined;
  protected buildDir: string | undefined;
  protected assetsDir: string | undefined;

  abstract getAssetsPath(dir: string): Promise<string>;
  abstract getBuildPath(buildDir: string): Promise<string>;
  abstract getSource(segmentName?: string): string;
  abstract getDestination(): string;
  abstract stat(filePath: string): Promise<boolean>;
  abstract fetch(url: string): Promise<string>;
  abstract write(targetPath: string): Promise<void>;
  abstract writeFile(path: string, data: Uint8Array): Promise<void>;
  abstract append(targetPath: string, file: string): Promise<void>;
  abstract unlink(path: string): Promise<void>;
  abstract read(filePath: string): Promise<string>;
  abstract readFile(filePath: string): Promise<Uint8Array>;
  abstract copy(sourcePath: string, targetPath: string): Promise<void>;
  abstract move(sourcePath: string, targetPath: string): Promise<void>;
  abstract fetchAndRead(url: string): Promise<string>;

  // Resolve a font that ships with the package to an absolute local path, or null when the platform
  // doesn't bundle fonts locally. The browser/expo adapters seed fonts through their own asset
  // pipeline (public/ dir, expo assets), so they keep the null default; the Node adapter overrides
  // this to find the .ttf shipped in the package instead of downloading it from Google Fonts.
  resolveBundledFont(_fontFile: string): Promise<string | null> {
    return Promise.resolve(null);
  }

  // Resolve a music track that ships with the package to an absolute local path, or null when the
  // platform doesn't bundle tracks locally. Same role as resolveBundledFont: the Node adapter finds
  // the .mp3 shipped in the package so `global.music` works without a network download; browser/expo
  // keep the null default (they seed tracks through their own asset pipeline).
  resolveBundledMusic(_musicFile: string): Promise<string | null> {
    return Promise.resolve(null);
  }

  // Resolve a template asset URL to an already-present local file (under the configured assets dir),
  // or null when there's no local copy — in which case the caller downloads it. Lets renders run
  // offline when their media is staged locally while still fetching remote-only assets. The Node
  // adapter overrides this; browser/expo keep the null default (they seed media via their own
  // pipelines), so media fetching there is unchanged.
  resolveLocalAsset(_url: string): Promise<string | null> {
    return Promise.resolve(null);
  }

  setBuildDir = (buildDir: string) => {
    this.buildDir = buildDir;
  };

  getBuildDir = (): string | undefined => this.buildDir;

  setAssetsDir = (assetsDir: string) => {
    this.assetsDir = assetsDir;
  };

  getAssetsDir = (assetsType: string): string | undefined => `${this.assetsDir}/${assetsType}`;

  getRootDir = (): string | undefined => this.root;

  setSegment = (segmentName: string) => {
    this.segmentName = assertSafeSegmentName(segmentName);
  };

  // Scratch dir for the composers' transient files (tmp_normalize/tmp_video/tmp_anim). `tempDir` is
  // never set by any platform, so fall back to the build dir — always set by setBuildDir and writable
  // — otherwise the path is built as `undefined/tmp_*.mp4` and the step reads a non-existent file.
  getTempDir = () => {
    return this.tempDir ?? this.buildDir;
  };
}

export default AbstractFilesystem;
