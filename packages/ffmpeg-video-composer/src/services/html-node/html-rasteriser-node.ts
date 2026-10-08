// The Node rasteriser of HTML layers, in process: the shared Satori + resvg pipeline (core/html/satori-raster)
// over WebAssembly read from node_modules, loaded on the first layer only (dynamic imports), so a template
// without an HTML layer never pays for it.

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { container } from 'tsyringe';
import { HTML_RASTERISER, type HtmlRasteriser, type HtmlRasterRequest } from '@/core/html/html-rasteriser';
import type { HbSubset } from '@/core/html/font-instances';
import {
  createSatoriRasteriser,
  measureContent,
  type FontInstances,
  type RasterEngines,
} from '@/core/html/satori-raster';

export { HTML_RENDERER_VERSION } from '@/core/html/satori-raster';

const requireModule = createRequire(import.meta.url);

let engines: Promise<RasterEngines> | undefined;

async function loadEngines(): Promise<RasterEngines> {
  const [satori, resvg, resvgWasm, hbWasm] = await Promise.all([
    import('satori'),
    import('@resvg/resvg-wasm'),
    fs.readFile(requireModule.resolve('@resvg/resvg-wasm/index_bg.wasm')),
    fs.readFile(requireModule.resolve('harfbuzzjs/hb-subset.wasm')),
  ]);

  await resvg.initWasm(resvgWasm);
  const hb = await WebAssembly.instantiate(hbWasm);

  return { satori: satori.default, resvg, hb: hb.instance.exports as unknown as HbSubset };
}

// The WebAssembly modules are process-wide (resvg's initWasm may only run once), so they load once and
// stay; a failed load is retried on the next layer rather than pinned.
function sharedEngines(): Promise<RasterEngines> {
  engines ??= loadEngines().catch((error: unknown) => {
    engines = undefined;

    throw error;
  });

  return engines;
}

const MEASURE_INSTANCES: FontInstances = new Map();

/** The content's natural height in output pixels at the box width: a layout pass, nothing drawn. */
export async function measureHtmlContent(request: Omit<HtmlRasterRequest, 'density'>): Promise<number> {
  return measureContent(await sharedEngines(), request, MEASURE_INSTANCES);
}

/** A rasteriser with its own cache of instanced faces; the WebAssembly engines are shared. */
export function createNodeHtmlRasteriser(): HtmlRasteriser {
  return createSatoriRasteriser(sharedEngines);
}

/** Registers the in-process rasteriser the asset stage draws HTML layers with (the Node compile). */
export function registerHtmlRasteriser(): void {
  if (container.isRegistered(HTML_RASTERISER)) return;

  container.registerInstance<HtmlRasteriser>(HTML_RASTERISER, createNodeHtmlRasteriser());
}
