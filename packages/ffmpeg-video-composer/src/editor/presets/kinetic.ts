// Kinetic block → drawtext / drawbox filters (docs/plans/motion-system-v2.md §4.1).

import type { Filter } from '@/core/types';
import type { KineticBlock } from '../../schemas/kinetic.schemas';
import { trackExpr, type TrackKey } from '@/core/motion/tracks';
import { fmt } from '@/core/motion/hermite';
import type { Layout, LayoutPiece } from '@/core/kinetic/layout';
import {
  blockTop,
  resolveExit,
  resolveKinetic,
  staggerRanks,
  type KineticFrame,
  type ResolvedKinetic,
} from '@/core/kinetic/resolve';
import { layoutWithin, type FittedLayout } from '@/core/kinetic/fit';
import { unitTracks, type UnitTracks } from '@/core/kinetic/units';
import { caretBoxes, counterText, markerSweep, scrambleDecoys } from '@/core/kinetic/extras';
import { applyTextEffect } from './text';
import { fillGraph, type FillBox, type FillEnv } from './kinetic-fill';
import type { SugarContext } from './sugar-context';

export { MAX_KINETIC_UNITS } from '@/core/kinetic/fit';
const ACCENT_COLOR = '#FFF685';
const MARKER_COLOR = '#7C83FD@0.85';
/** Baseline below the line top, as a fraction of the font size. */
export const BASELINE = 0.8;

export interface KineticContext extends KineticFrame {
  /** The block's text, already resolved for locale, variables and case. */
  text: string;
  /** Where a `fill` draws (mask sub-graph); absent = the build can't, so the block stays solid. */
  fill?: FillEnv;
}

function accentWords(block: KineticBlock, layout: Layout): Set<number> {
  const lastWord = Math.max(0, ...layout.pieces.map((piece) => piece.word));
  const words = block.accent?.words ?? (block.preset === 'highlight' ? 'last' : []);

  if (words === 'last') return new Set([lastWord]);

  if (words === 'first') return new Set([0]);

  return new Set(words);
}

function quoted(expr: string): string {
  return `'${expr}'`;
}

function offset(base: number, keys: TrackKey[]): string {
  const expr = trackExpr(keys, 0);

  return expr === '0' ? fmt(base) : quoted(`${fmt(base)}+(${expr})`);
}

interface PieceDraw {
  piece: LayoutPiece;
  tracks: UnitTracks;
  arrive: number;
  index: number;
  color: string;
}

function waveTerm(block: KineticBlock, settings: ResolvedKinetic, draw: PieceDraw): string {
  if (settings.preset !== 'wave') return '';

  const amplitude = (block.amplitude ?? settings.size * 0.06) * (settings.distance > 0 ? 1 : 0);
  const frequency = block.frequency ?? 1.2;

  return `+${fmt(amplitude)}*sin(6.283185*(${fmt(frequency)}*t-${fmt(draw.index * 0.08)}))*clip((t-${fmt(draw.arrive)})/0.4,0,1)`;
}

/** x-anchor suffix per alignment for a string placed by its own drawn width. */
const ALIGN_ANCHOR = { left: '', center: '-text_w/2', right: '-text_w' } as const;

// How a unit is painted: its colour and effect (the visible copy), or white without effect (a fill's
// mask), or an invisible face that still casts its effect (under a fill). `anchored` places whole lines
// by drawtext's own text_w (shaped or unmeasurable copy; see core/kinetic/fit.ts).
interface PieceStyle {
  color: string;
  effect: KineticBlock['effect'];
  anchored: boolean;
}

function pieceX(settings: ResolvedKinetic, draw: PieceDraw, scale: string | null, anchored: boolean): unknown {
  const { piece, tracks } = draw;

  if (anchored) return quoted(`${fmt(settings.x)}+(${trackExpr(tracks.x, 0)})${ALIGN_ANCHOR[settings.align]}`);

  // A scaled unit grows around its own centre: anchor x on the centre, y on the em box.
  if (scale) return quoted(`${fmt(piece.x + piece.width / 2)}+(${trackExpr(tracks.x, 0)})-text_w/2`);

  return offset(piece.x, tracks.x);
}

function pieceFilter(block: KineticBlock, settings: ResolvedKinetic, draw: PieceDraw, style: PieceStyle): Filter {
  const { piece, tracks } = draw;
  const scale = tracks.scale ? trackExpr(tracks.scale, 0) : null;
  const size = settings.size;
  // Every piece sits on the line's shared baseline: drawtext places a string by its own glyph box, so
  // `baseline - max_glyph_a` keeps a lone comma or lowercase glyph from floating. A scaled piece keeps
  // its em box centred, so its baseline moves with the scale.
  const baseline = scale
    ? `${fmt(piece.y + size / 2)}+${fmt(size * (BASELINE - 0.5))}*(${scale})`
    : fmt(piece.y + size * BASELINE);
  const y = `${baseline}-max_glyph_a+(${trackExpr(tracks.y, 0)})${waveTerm(block, settings, draw)}`;
  const values: Record<string, unknown> = {
    text: piece.text,
    fontfile: settings.font,
    fontsize: scale ? quoted(`${fmt(settings.size)}*(${scale})`) : settings.size,
    fontcolor: style.color,
    x: pieceX(settings, draw, scale, style.anchored),
    y: quoted(y),
    alpha: quoted(`clip(${trackExpr(tracks.opacity, 0)},0,1)`),
  };
  applyTextEffect(values, style.effect);

  return { type: 'drawtext', values };
}

function counterFilters(block: KineticBlock, settings: ResolvedKinetic, ctx: KineticContext): Filter[] {
  const counter = block.counter ?? { from: 0, to: 100 };
  const window = { delay: settings.delay, duration: settings.duration };
  const anchor = ALIGN_ANCHOR[settings.align];
  const top = blockTop(block.y, settings.lineHeight, ctx);
  const values: Record<string, unknown> = {
    textExpr: counterText(counter, window, settings.ease),
    fontfile: settings.font,
    fontsize: settings.size,
    fontcolor: settings.color,
    x: quoted(`${fmt(settings.x)}${anchor}`),
    y: fmt(top),
    alpha: quoted(`clip((t-${fmt(settings.delay)})/0.18,0,1)`),
  };
  applyTextEffect(values, block.effect);

  return [{ type: 'drawtext', values }];
}

interface Choreography {
  settings: ResolvedKinetic;
  layout: Layout;
  pieces: LayoutPiece[];
  ranks: number[];
  starts: number[];
  exit: ReturnType<typeof resolveExit>;
  fps: number;
  anchored: boolean;
}

function pieceDraws(block: KineticBlock, plan: Choreography): PieceDraw[] {
  const { settings, layout, exit } = plan;
  const accents = accentWords(block, layout);
  const accentColor = block.accent?.color ?? (block.preset === 'highlight' ? settings.color : ACCENT_COLOR);

  return plan.pieces.map((piece, index) => {
    const start = plan.starts[index];
    const arrive = start + settings.duration;
    const leave = exit ? Math.max(exit.at + plan.ranks[index] * exit.stagger, arrive + 1 / plan.fps) : null;
    const line = layout.lines[piece.line];
    const tracks = unitTracks(settings, piece, line.x + line.width / 2, { start, arrive, leave }, exit);

    return { piece, tracks, arrive, index, color: accents.has(piece.word) ? accentColor : settings.color };
  });
}

// highlight: a marker per accent word, held until the word has mostly faded out.
function markers(block: KineticBlock, plan: Choreography, draws: PieceDraw[]): Filter[] {
  if (plan.settings.preset !== 'highlight' || plan.settings.unit !== 'word') return [];

  const accents = accentWords(block, plan.layout);
  const { exit } = plan;

  return draws
    .filter((draw) => accents.has(draw.piece.word))
    .flatMap((draw) => {
      const leave = exit ? Math.max(exit.at + plan.ranks[draw.index] * exit.stagger, draw.arrive) : null;
      const end = leave === null || !exit ? null : leave + exit.duration * 0.6;
      const color = block.accent?.marker ?? MARKER_COLOR;

      return markerSweep(plan.settings, { piece: draw.piece, start: draw.arrive + 0.05, end, color, fps: plan.fps });
    });
}

function extras(block: KineticBlock, plan: Choreography, seed: number): Filter[] {
  const { settings, pieces, starts } = plan;

  if (settings.preset === 'typewriter' && block.caret !== false) {
    return caretBoxes(settings, pieces, starts, plan.exit?.at ?? null);
  }

  return settings.preset === 'scramble' ? scrambleDecoys(settings, pieces, starts, block.charset, seed) : [];
}

function choreograph(block: KineticBlock, ctx: KineticContext, base: ResolvedKinetic, laid: FittedLayout) {
  const settings = { ...base, unit: laid.unit };
  const top = blockTop(block.y, laid.layout.height, ctx);
  const pieces = laid.layout.pieces.map((piece) => ({ ...piece, y: piece.y + top }));
  const ranks = staggerRanks(pieces, block.order, ctx.seed);
  const starts = ranks.map((rank) => settings.delay + rank * settings.stagger);
  const exit = resolveExit(block, settings, ctx, Math.max(0, ...ranks));

  return { settings, layout: laid.layout, pieces, ranks, starts, exit, fps: ctx.fps, anchored: laid.anchored };
}

function blockBox(plan: Choreography): FillBox {
  const x = Math.min(...plan.pieces.map((piece) => piece.x));
  const y = Math.min(...plan.pieces.map((piece) => piece.y));
  const right = Math.max(...plan.pieces.map((piece) => piece.x + piece.width));

  return { x, y, w: Math.max(1, right - x), h: Math.max(1, plan.layout.height) };
}

// The block drawn through a fill (kinetic-fill.ts): the same draws as white mask units, plus an
// invisible-faced copy under the fill when the block casts a shadow or outline.
function filledBlock(block: KineticBlock, plan: Choreography, draws: PieceDraw[], env: FillEnv, seed: number): Filter {
  const { settings, anchored } = plan;
  const mask = draws.map((draw) => pieceFilter(block, settings, draw, { color: 'white', effect: undefined, anchored }));
  const clear = `${settings.color.split('@')[0]}@0`;
  const casts = block.effect
    ? draws.map((draw) => pieceFilter(block, settings, draw, { color: clear, effect: block.effect, anchored }))
    : [];
  const base = [...markers(block, plan, draws), ...casts, ...extras(block, plan, seed)];
  const landed = Math.max(0, ...draws.map((draw) => draw.arrive));

  return fillGraph(block.fill ?? {}, { base, mask, box: blockBox(plan), landed, solid: settings.color }, env);
}

/** The filters for one kinetic block. Empty when there is nothing to draw. */
export function kineticToFilters(block: KineticBlock, ctx: KineticContext): Filter[] {
  const base = resolveKinetic(block, ctx, ctx.text);

  if (block.preset === 'counter') return counterFilters(block, base, ctx);

  const laid = ctx.text.trim() ? layoutWithin(base, ctx.text) : null;

  if (!laid) return [];

  const plan: Choreography = choreograph(block, ctx, base, laid);
  const draws = pieceDraws(block, plan);

  if (block.fill && ctx.fill) return [filledBlock(block, plan, draws, ctx.fill, ctx.seed)];

  const style = { effect: block.effect, anchored: plan.anchored };

  return [
    ...markers(block, plan, draws),
    ...draws.map((draw) => pieceFilter(block, plan.settings, draw, { ...style, color: draw.color })),
    ...extras(block, plan, ctx.seed),
  ];
}

export const MASK_UNAVAILABLE_WARNING =
  '[mask_unavailable] kinetic fill needs the alphamerge filter, absent from this FFmpeg build: the block is ' +
  'drawn in its solid colour';

// The fill environment for block `index`, or undefined (solid text) when the build can't draw masks.
function fillEnv(block: KineticBlock, index: number, ctx: SugarContext): FillEnv | undefined {
  const masks = ctx.masks;

  if (!block.fill || !masks) return undefined;

  if (!masks.available) {
    masks.warn(MASK_UNAVAILABLE_WARNING);

    return undefined;
  }

  const [width, height] = ctx.scale.split(':').map(Number);
  const key = `kinetic${index}_texture`;

  return {
    width,
    height,
    fps: ctx.fps,
    duration: ctx.duration,
    prefix: `kin${index}_`,
    texture: (url) => masks.input(key, { url, still: true }),
    color: masks.color,
  };
}

/** Every kinetic block of a section, through the sugar registry. Needs the motion context. */
export function kineticBlocksToFilters(blocks: KineticBlock[] | undefined, ctx: SugarContext): Filter[] {
  const motion = ctx.motion;

  if (!blocks || !motion) return [];

  const [width, height] = ctx.scale.split(':').map(Number);

  return blocks.flatMap((block, index) =>
    kineticToFilters(block, {
      width,
      height,
      fps: ctx.fps,
      duration: ctx.duration,
      energy: motion.energy,
      seed: motion.seedFor(`kinetic[${index}]`),
      text: block.preset === 'counter' ? '' : motion.resolveText(block.text),
      fill: fillEnv(block, index, ctx),
    })
  );
}
