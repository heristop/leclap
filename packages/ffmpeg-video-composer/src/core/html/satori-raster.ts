// The HTML layer pipeline every platform runs: Satori lays the element tree out (Yoga, flexbox) and writes
// text as vector paths, resvg draws that SVG to a transparent PNG at the requested density, HarfBuzz pins
// variable faces to static weights first. The engines are WebAssembly handed in by the host (Node reads
// them from node_modules, the phone's WebView page from its inlined bundle), so the same request gives
// the same bytes wherever this code runs.

import type satoriFunction from 'satori';
import type * as ResvgWasm from '@resvg/resvg-wasm';
import type { LayerElement } from './html-element';
import type { HtmlRaster, HtmlRasteriser, HtmlRasterRequest, RasterFont } from './html-rasteriser';
import { faceWeight, instanceFont, isVariableFont, type HbSubset } from './font-instances';

/** The engines a layer is drawn with; part of its cache key. Checked against the installed packages. */
export const HTML_RENDERER_VERSION = 'satori@0.33.5+resvg@2.6.2+harfbuzz@0.10.0';

type Satori = typeof satoriFunction;
type SatoriFont = Parameters<Satori>[1]['fonts'][number];
type SatoriNode = Parameters<Satori>[0];

export interface RasterEngines {
  satori: Satori;
  /** resvg's module after `initWasm`. */
  resvg: Pick<typeof ResvgWasm, 'Resvg'>;
  /** hb-subset.wasm's exports. */
  hb: HbSubset;
}

/** Instanced faces by file, weight and size: a variable face is pinned once per weight. */
export type FontInstances = Map<string, Uint8Array>;

function satoriFonts(fonts: RasterFont[], hb: HbSubset, instances: FontInstances): SatoriFont[] {
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

async function naturalHeight(satori: Satori, request: HtmlRasterRequest, fonts: SatoriFont[]): Promise<number> {
  const svg = await satori(withoutHeight(request.element) as unknown as SatoriNode, { width: request.width, fonts });

  return svgHeight(svg);
}

async function render(engines: RasterEngines, request: HtmlRasterRequest, instances: FontInstances) {
  const { satori, resvg, hb } = engines;
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

  return { png, contentHeight: natural } satisfies HtmlRaster;
}

/** The content's natural height in output pixels at the box width: a layout pass, nothing drawn. */
export async function measureContent(
  engines: RasterEngines,
  request: Omit<HtmlRasterRequest, 'density'>,
  instances: FontInstances
): Promise<number> {
  return naturalHeight(engines.satori, { ...request, density: 1 }, satoriFonts(request.fonts, engines.hb, instances));
}

/** A rasteriser with its own cache of instanced faces, over engines the host loads (once, lazily). */
export function createSatoriRasteriser(engines: () => Promise<RasterEngines>): HtmlRasteriser {
  const instances: FontInstances = new Map();

  return {
    version: HTML_RENDERER_VERSION,
    render: async (request) => render(await engines(), request, instances),
  };
}
