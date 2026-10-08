// The engines HTML layers are drawn with, pinned once for every host: Satori lays out (its Yoga build is
// inlined in its JS), resvg rasterises and HarfBuzz instances variable fonts, the last two from WebAssembly
// files a host loads its own way (Node reads them from node_modules, the web app serves them itself, any
// other page falls back to unpkg). Checked against the installed packages by the rasteriser tests.

const SATORI_VERSION = '0.33.5';
const RESVG_WASM_VERSION = '2.6.2';
const HARFBUZZJS_VERSION = '0.10.0';

/** The engines a layer is drawn with; part of every layer's cache key. */
export const HTML_RENDERER_VERSION = `satori@${SATORI_VERSION}+resvg@${RESVG_WASM_VERSION}+harfbuzz@${HARFBUZZJS_VERSION}`;

/** The WebAssembly files of the HTML rasteriser, as package-relative paths. */
export const HTML_WASM_FILES = {
  resvg: { package: '@resvg/resvg-wasm', version: RESVG_WASM_VERSION, file: 'index_bg.wasm' },
  harfbuzz: { package: 'harfbuzzjs', version: HARFBUZZJS_VERSION, file: 'hb-subset.wasm' },
} as const;

export type HtmlWasmName = keyof typeof HTML_WASM_FILES;

/** The pinned files on unpkg, for a browser host that serves none itself. */
export const HTML_WASM_CDN: Readonly<Record<HtmlWasmName, string>> = {
  resvg: `https://unpkg.com/${HTML_WASM_FILES.resvg.package}@${RESVG_WASM_VERSION}/${HTML_WASM_FILES.resvg.file}`,
  harfbuzz: `https://unpkg.com/${HTML_WASM_FILES.harfbuzz.package}@${HARFBUZZJS_VERSION}/${HTML_WASM_FILES.harfbuzz.file}`,
};

/** The bytes of both WebAssembly modules. */
export type HtmlWasm = Record<HtmlWasmName, BufferSource>;

/** Loads the rasteriser's WebAssembly: where it comes from is the host's call. */
export type HtmlWasmLoader = () => Promise<HtmlWasm>;
