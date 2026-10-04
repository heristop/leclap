// Where time references may appear inside a section, and the elements they can name. Both walk a plain
// section object; the slots write back in place, so callers walk a clone.

type Bag = Record<string, unknown>;

/** A time field holding a string that may be a reference. */
export interface TimeSlot {
  path: string;
  value: string;
  /** Id of the element this field starts, so a self-reference reads as a cycle. */
  owner?: string;
  write: (seconds: number) => void;
}

/** An element other fields can reference as "<id>.start" / "<id>.end". */
export interface ElementEntry {
  id: string;
  kind: 'kinetic' | 'graphic' | 'drawtext';
  /** Path of the field that sets its start. */
  path: string;
  /** The raw start (seconds, a reference, or undefined for the default). */
  start: unknown;
  node: Bag;
}

function bag(value: unknown): Bag | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Bag) : undefined;
}

function list(value: unknown): Bag[] {
  return Array.isArray(value) ? value.map((item) => bag(item) ?? {}) : [];
}

function slot(owner: Bag | undefined, key: string, path: string, id?: string): TimeSlot[] {
  const value = owner?.[key];

  if (typeof value !== 'string' || !owner) return [];

  return [{ path: `${path}.${key}`, value, owner: id, write: (seconds) => (owner[key] = seconds) }];
}

function idOf(node: Bag): string | undefined {
  return typeof node.id === 'string' ? node.id : undefined;
}

function trackSlots(tracks: Bag | undefined, keys: readonly string[], path: string): TimeSlot[] {
  return keys.flatMap((axis) => list(tracks?.[axis]).flatMap((key, k) => slot(key, 't', `${path}.${axis}[${k}]`)));
}

function cameraSlots(camera: Bag | undefined): TimeSlot[] {
  if (!camera) return [];

  const hits = Array.isArray(camera.hits) ? (camera.hits as unknown[]) : [];
  const hitSlots = hits.flatMap((hit, k) => {
    const path = `camera.hits[${k}]`;

    return typeof hit === 'string'
      ? [{ path, value: hit, write: (seconds: number) => (hits[k] = seconds) }]
      : slot(bag(hit), 'at', path);
  });

  return [
    ...slot(camera, 'delay', 'camera'),
    ...hitSlots,
    ...trackSlots(camera, ['zoom', 'x', 'y', 'rotate'], 'camera'),
  ];
}

function filterSlots(filter: Bag, path: string): TimeSlot[] {
  const owner = filter.type === 'drawtext' ? idOf(filter) : undefined;

  return [
    ...slot(bag(filter.reveal), 'delay', `${path}.reveal`, owner),
    ...slot(bag(filter.exit), 'after', `${path}.exit`),
    ...trackSlots(bag(filter.animate), ['x', 'y', 'opacity', 'scale'], `${path}.animate`),
  ];
}

// Footage edits (options.speedRamp keys, freeze frames, focus keyframes): section-time fields. A preset
// ramp or an anchor focus is a string that is not a list, so it holds no slot.
function footageSlots(options: Bag | undefined): TimeSlot[] {
  return [
    ...list(options?.speedRamp).flatMap((key, k) => slot(key, 'at', `options.speedRamp[${k}]`)),
    ...list(options?.freeze).flatMap((freeze, k) => slot(freeze, 'at', `options.freeze[${k}]`)),
    ...list(options?.focus).flatMap((key, k) => slot(key, 't', `options.focus[${k}]`)),
  ];
}

/** Every time field of the section that holds a string. */
export function timeSlots(section: Bag): TimeSlot[] {
  return [
    ...footageSlots(bag(section.options)),
    ...list(section.kinetic).flatMap((block, i) => [
      ...slot(block, 'delay', `kinetic[${i}]`, idOf(block)),
      ...slot(bag(block.exit), 'at', `kinetic[${i}].exit`),
    ]),
    ...list(section.graphics).flatMap((g, i) => [
      ...slot(g, 'at', `graphics[${i}]`, idOf(g)),
      ...slot(g, 'until', `graphics[${i}]`),
    ]),
    ...cameraSlots(bag(section.camera)),
    ...list(bag(section.subtitles)?.cues).flatMap((cue, i) => [
      ...slot(cue, 'at', `subtitles.cues[${i}]`),
      ...slot(cue, 'end', `subtitles.cues[${i}]`),
    ]),
    ...list(section.cutaways).flatMap((cutaway, i) => slot(cutaway, 'at', `cutaways[${i}]`)),
    ...list(section.filters).flatMap((filter, i) => filterSlots(filter, `filters[${i}]`)),
    ...list(section.sfx).flatMap((cue, i) => slot(cue, 'at', `sfx[${i}]`)),
    ...list(bag(section.options)?.audioAutomation).flatMap((key, i) =>
      slot(key, 'at', `options.audioAutomation[${i}]`)
    ),
  ];
}

/** Every element of the section that carries an id, in document order. */
export function sectionElements(section: Bag): ElementEntry[] {
  const kinetic = list(section.kinetic).map((node, i) => ({
    kind: 'kinetic' as const,
    node,
    path: `kinetic[${i}].delay`,
    start: node.delay,
  }));
  const graphics = list(section.graphics).map((node, i) => ({
    kind: 'graphic' as const,
    node,
    path: `graphics[${i}].at`,
    start: node.at,
  }));
  const drawtext = list(section.filters)
    .map((node, i) => ({
      kind: 'drawtext' as const,
      node,
      path: `filters[${i}].reveal.delay`,
      start: bag(node.reveal)?.delay,
    }))
    .filter((entry) => entry.node.type === 'drawtext');

  return [...kinetic, ...graphics, ...drawtext].flatMap((entry) => {
    const id = idOf(entry.node);

    return id === undefined ? [] : [{ ...entry, id }];
  });
}
