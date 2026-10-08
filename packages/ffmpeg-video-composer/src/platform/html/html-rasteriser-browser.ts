// The browser rasteriser of HTML layers: the shared Satori + resvg pipeline (services/html-raster) with its
// WebAssembly fetched by the host's loader, the pinned files from unpkg when it brings none. Loaded by the
// compile chunk and by renderHtmlLayerPreview, never by the entry a page imports: Satori, resvg and
// HarfBuzz come in on the first HTML layer.

import { container } from 'tsyringe';
import { HTML_RASTERISER, type HtmlRasteriser } from '@/core/html/html-rasteriser';
import { HTML_WASM_CDN, type HtmlWasm, type HtmlWasmLoader } from '@/core/html/html-engine';
import { createSatoriRasteriser } from '../../services/html-raster/satori-rasteriser';
import { provideHarfbuzzShaper } from './harfbuzz-shaper';
import {
  previewHtmlLayer,
  type HtmlLayerPreview,
  type HtmlLayerPreviewRequest,
} from '../../services/html-raster/html-layer-preview';

async function fetchWasm(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);

  if (!response.ok) throw new Error(`html rasteriser unavailable: ${url} answered ${response.status}`);

  return response.arrayBuffer();
}

/** The default loader: the pinned WebAssembly files from unpkg. */
export async function loadHtmlWasmFromCdn(): Promise<HtmlWasm> {
  const [resvg, harfbuzz, shaper] = await Promise.all([
    fetchWasm(HTML_WASM_CDN.resvg),
    fetchWasm(HTML_WASM_CDN.harfbuzz),
    fetchWasm(HTML_WASM_CDN.shaper),
  ]);

  return { resvg, harfbuzz, shaper };
}

// Satori shapes text with HarfBuzz, which a page cannot locate on its own (harfbuzz-shaper.ts).
function handingTheShaper(loadWasm: HtmlWasmLoader): HtmlWasmLoader {
  return async () => {
    const wasm = await loadWasm();

    if (!wasm.shaper) throw new Error('html rasteriser unavailable: the loader brought no HarfBuzz shaper (hb.wasm)');

    provideHarfbuzzShaper(wasm.shaper);

    return wasm;
  };
}

export function createBrowserHtmlRasteriser(loadWasm: HtmlWasmLoader = loadHtmlWasmFromCdn): HtmlRasteriser {
  return createSatoriRasteriser(handingTheShaper(loadWasm));
}

// One per page: the preview and the compile share the instanced faces (the WebAssembly is shared anyway).
let pageRasteriser: HtmlRasteriser | undefined;

function sharedRasteriser(loadWasm?: HtmlWasmLoader): HtmlRasteriser {
  pageRasteriser ??= createBrowserHtmlRasteriser(loadWasm);

  return pageRasteriser;
}

/** Registers the rasteriser the asset stage draws HTML layers with (the browser compile). */
export function registerBrowserHtmlRasteriser(loadWasm?: HtmlWasmLoader): void {
  if (container.isRegistered(HTML_RASTERISER)) return;

  container.registerInstance<HtmlRasteriser>(HTML_RASTERISER, sharedRasteriser(loadWasm));
}

/** Draws one layer as the render would, with what it would report. */
export function previewHtmlLayerInBrowser(
  request: HtmlLayerPreviewRequest,
  loadWasm?: HtmlWasmLoader
): Promise<HtmlLayerPreview> {
  return previewHtmlLayer(request, sharedRasteriser(loadWasm));
}
