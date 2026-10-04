// Kinetic block → drawtext / drawbox filters (docs/plans/motion-system-v2.md §4.1).

import type { Filter } from '@/core/types';
import type { KineticBlock } from '../../schemas/kinetic.schemas';
import { trackExpr, type TrackKey } from '@/core/motion/tracks';
import { fmt } from '@/core/motion/hermite';
import { layoutKinetic, type KineticUnit, type Layout, type LayoutPiece } from '@/core/kinetic/layout';
import {
  blockTop,
  resolveExit,
  resolveKinetic,
  staggerRanks,
  type KineticFrame,
  type ResolvedKinetic,
} from '@/core/kinetic/resolve';
import { unitTracks, type UnitTracks } from '@/core/kinetic/units';
import { caretBoxes, counterText, markerSweep, scrambleDecoys } from '@/core/kinetic/extras';
import { applyTextEffect } from './text';
import type { SugarContext } from './sugar-context';

/** Upper bound of independently animated units per block (each is a drawtext). */
export const MAX_KINETIC_UNITS = 64;
const COARSER: Record<KineticUnit, KineticUnit> = { glyph: 'word', word: 'line', line: 'line' };
const ACCENT_COLOR = '#FFF685';
const MARKER_COLOR = '#7C83FD@0.85';
/** Baseline below the line top, as a fraction of the font size. */
export const BASELINE = 0.8;

export interface KineticContext extends KineticFrame {
  /** The block's text, already resolved for locale, variables and case. */
  text: string;
}

/** The block's layout, stepping up to coarser units until it fits MAX_KINETIC_UNITS; null when unmeasurable. */
export function layoutWithin(settings: ResolvedKinetic, text: string): { layout: Layout; unit: KineticUnit } | null {
  let unit = settings.unit;

  for (;;) {
    const layout = layoutKinetic({ ...settings, unit, text, y: 0 });

    if (!layout) return null;

    if (layout.pieces.length <= MAX_KINETIC_UNITS || unit === 'line') return { layout, unit };

    unit = COARSER[unit];
  }
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

function pieceFilter(block: KineticBlock, settings: ResolvedKinetic, draw: PieceDraw): Filter {
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
    fontcolor: draw.color,
    // A scaled unit grows around its own centre: anchor x on the centre, y on the em box.
    x: scale
      ? quoted(`${fmt(piece.x + piece.width / 2)}+(${trackExpr(tracks.x, 0)})-text_w/2`)
      : offset(piece.x, tracks.x),
    y: quoted(y),
    alpha: quoted(`clip(${trackExpr(tracks.opacity, 0)},0,1)`),
  };
  applyTextEffect(values, block.effect);

  return { type: 'drawtext', values };
}

function counterFilters(block: KineticBlock, settings: ResolvedKinetic, ctx: KineticContext): Filter[] {
  const counter = block.counter ?? { from: 0, to: 100 };
  const window = { delay: settings.delay, duration: settings.duration };
  const anchor = { left: '', center: '-text_w/2', right: '-text_w' }[settings.align];
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

/** The filters for one kinetic block. Empty when there is nothing to draw. */
export function kineticToFilters(block: KineticBlock, ctx: KineticContext): Filter[] {
  const base = resolveKinetic(block, ctx);

  if (block.preset === 'counter') return counterFilters(block, base, ctx);

  const laid = ctx.text.trim() ? layoutWithin(base, ctx.text) : null;

  if (!laid) return [];

  const settings = { ...base, unit: laid.unit };
  const top = blockTop(block.y, laid.layout.height, ctx);
  const pieces = laid.layout.pieces.map((piece) => ({ ...piece, y: piece.y + top }));
  const ranks = staggerRanks(pieces, block.order, ctx.seed);
  const starts = ranks.map((rank) => settings.delay + rank * settings.stagger);
  const exit = resolveExit(block, settings, ctx, Math.max(0, ...ranks));
  const plan: Choreography = { settings, layout: laid.layout, pieces, ranks, starts, exit, fps: ctx.fps };
  const draws = pieceDraws(block, plan);

  return [
    ...markers(block, plan, draws),
    ...draws.map((draw) => pieceFilter(block, settings, draw)),
    ...extras(block, plan, ctx.seed),
  ];
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
    })
  );
}
