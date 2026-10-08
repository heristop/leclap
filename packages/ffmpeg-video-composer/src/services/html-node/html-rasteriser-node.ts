// The Node rasteriser of HTML layers, in process: Satori lays the element tree out (Yoga, flexbox) and
// writes text as vector paths, resvg draws that SVG to a transparent PNG at the requested density. Both run
// as WebAssembly, loaded on the first layer only (dynamic imports), so a template without an HTML layer
// never pays for them. Same request, same bytes.

import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { container } from 'tsyringe';
import {
  HTML_RASTERISER,
  type HtmlRaster,
  type HtmlRasteriser,
  type HtmlRasterRequest,
  type RasterFont,
} from '@/core/html/html-rasteriser';
import type { LayerElement } from '@/core/html/html-element';
import type satoriFunction from 'satori';
import type * as ResvgWasm from '@resvg/resvg-wasm';
import { faceWeight, instanceFont, isVariableFont, type HbSubset } from './font-instances';

/** The engines a layer is drawn with; part of its cache key. Checked against the installed packages. */
export const HTML_RENDERER_VERSION = 'satori@0.33.5+resvg@2.6.2+harfbuzz@0.10.0';

type Satori = typeof satoriFunction;
type SatoriFont = Parameters<Satori>[1]['fonts'][number];
type SatoriNode = Parameters<Satori>[0];
type ResvgModule = typeof ResvgWasm;

interface Engines {
  satori: Satori;
  resvg: ResvgModule;
  hb: HbSubset;
}

const requireModule = createRequire(import.meta.url);

let engines: Promise<Engines> | undefined;

async function loadEngines(): Promise<Engines> {
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
function sharedEngines(): Promise<Engines> {
  engines ??= loadEngines().catch((error: unknown) => {
    engines = undefined;

    throw error;
  });

  return engines;
}

function satoriFonts(fonts: RasterFont[], hb: HbSubset, instances: Map<string, Uint8Array>): SatoriFont[] {
  return fonts.flatMap((font) => {
    if (!isVariableFont(font.data)) {
      const weight = faceWeight(font.data) as SatoriFont['weight'];

      return [{ name: font.family, data: font.data.buffer as ArrayBuffer, weight, style: 'normal' as const }];
    }

    return font.weights.map((weight) => {
      const key = `${font.file}@${weight}:${font.data.byteLength}`;
      const data = instances.get(key) ?? instanceFont(hb, font.data, weight);
      instances.set(key, data);

      return {
        name: font.family,
        data: data.buffer as ArrayBuffer,
        weight: weight as SatoriFont['weight'],
        style: 'normal' as const,
      };
    });
  });
}

function withoutHeight(element: LayerElement): LayerElement {
  const style = Object.fromEntries(Object.entries(element.props.style).filter(([key]) => key !== 'height'));

  return { ...element, props: { ...element.props, style } };
}

function svgHeight(svg: string): number {
  const match = /<svg[^>]*\sheight="([\d.]+)"/.exec(svg);

  return match ? Number(match[1]) : 0;
}

async function render(request: HtmlRasterRequest, instances: Map<string, Uint8Array>): Promise<HtmlRaster> {
  const { satori, resvg, hb } = await sharedEngines();
  const fonts = satoriFonts(request.fonts, hb, instances);
  const svg = await satori(request.element as unknown as SatoriNode, {
    width: request.width,
    height: request.height,
    fonts,
  });
  // Laid out again without the box height: the content's natural height, for the overflow advisory.
  const natural = await naturalHeight(satori, request, fonts);
  const image = new resvg.Resvg(svg, { fitTo: { mode: 'zoom', value: request.density } }).render();
  const png = image.asPng();

  image.free();

  return { png, contentHeight: natural };
}

async function naturalHeight(satori: Satori, request: HtmlRasterRequest, fonts: SatoriFont[]): Promise<number> {
  const svg = await satori(withoutHeight(request.element) as unknown as SatoriNode, { width: request.width, fonts });

  return svgHeight(svg);
}

const MEASURE_INSTANCES = new Map<string, Uint8Array>();

/** The content's natural height in output pixels at the box width: a layout pass, nothing drawn. */
export async function measureHtmlContent(request: Omit<HtmlRasterRequest, 'density'>): Promise<number> {
  const { satori, hb } = await sharedEngines();

  return naturalHeight(satori, { ...request, density: 1 }, satoriFonts(request.fonts, hb, MEASURE_INSTANCES));
}

/** A rasteriser with its own cache of instanced faces; the WebAssembly engines are shared. */
export function createNodeHtmlRasteriser(): HtmlRasteriser {
  const instances = new Map<string, Uint8Array>();

  return { version: HTML_RENDERER_VERSION, render: (request) => render(request, instances) };
}

/** Registers the in-process rasteriser the asset stage draws HTML layers with (the Node compile). */
export function registerHtmlRasteriser(): void {
  if (container.isRegistered(HTML_RASTERISER)) return;

  container.registerInstance<HtmlRasteriser>(HTML_RASTERISER, createNodeHtmlRasteriser());
}
