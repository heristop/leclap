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
  abstract unzip(url: string, targetPath: string): Promise<string[]>;
  abstract fetchAndRead(url: string): Promise<string>;

  // Resolve a font that ships with the package to an absolute local path, or null when the platform
  // doesn't bundle fonts locally. The browser/expo adapters seed fonts through their own asset
  // pipeline (public/ dir, expo assets), so they keep the null default; the Node adapter overrides
  // this to find the .ttf shipped in the package instead of downloading it from Google Fonts.
  resolveBundledFont(_fontFile: string): Promise<string | null> {
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
    this.segmentName = segmentName;
  };

  getTempDir = () => {
    return this.tempDir;
  };
}

export default AbstractFilesystem;
