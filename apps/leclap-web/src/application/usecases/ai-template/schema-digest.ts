// Shrinks the engine's template JSON Schema to fit a prompt. The raw schema is ~390 KB minified,
// mostly because every section variant repeats the same option/filter subtrees. Two lossless-ish
// passes bring it to ~60 KB: descriptions are clipped (they stay, shortened, because they carry
// units and ranges), and every repeated subtree is hoisted once into `$defs` and referenced. If the
// result is still over budget, descriptions are clipped harder, then dropped.

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

const DROPPED_KEYS = new Set(['$schema', 'examples', 'title']);
// Subtrees shorter than this are cheaper inline than as a `$ref`.
const MIN_HOIST = 90;
// Description clip lengths tried in order until the digest fits; 0 drops descriptions.
const DESCRIPTION_STEPS = [160, 90, 40, 0];

function clipDescription(value: Json, max: number): Json | undefined {
  if (max <= 0 || typeof value !== 'string') return undefined;

  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

// Keywords whose value is a map of NAME -> schema: its keys are field names (a section really has a
// `title` and a `description`), so they must never be filtered as schema keywords.
const NAME_MAPS = new Set(['properties', 'patternProperties', '$defs', 'definitions']);

function cleanNameMap(node: Json, maxDescription: number): Json {
  if (node === null || typeof node !== 'object' || Array.isArray(node)) return node;

  return Object.fromEntries(Object.entries(node).map(([name, child]) => [name, cleanNode(child, maxDescription)]));
}

function cleanNode(node: Json, maxDescription: number): Json {
  if (Array.isArray(node)) return node.map((child) => cleanNode(child, maxDescription));

  if (node === null || typeof node !== 'object') return node;

  const out: { [key: string]: Json } = {};

  for (const [key, value] of Object.entries(node)) {
    if (DROPPED_KEYS.has(key)) continue;

    if (key === 'description') {
      const clipped = clipDescription(value, maxDescription);

      if (clipped !== undefined) out[key] = clipped;
      continue;
    }
    out[key] = NAME_MAPS.has(key) ? cleanNameMap(value, maxDescription) : cleanNode(value, maxDescription);
  }

  return out;
}

function countSubtrees(node: Json, counts: Map<string, number>): void {
  if (node === null || typeof node !== 'object') return;

  const text = JSON.stringify(node);

  if (text.length >= MIN_HOIST) counts.set(text, (counts.get(text) ?? 0) + 1);

  for (const child of Object.values(node)) countSubtrees(child, counts);
}

interface Hoister {
  counts: Map<string, number>;
  ids: Map<string, string>;
  defs: { [key: string]: Json };
}

function hoist(node: Json, hoister: Hoister, isRoot: boolean): Json {
  if (node === null || typeof node !== 'object') return node;

  const text = JSON.stringify(node);

  if (!isRoot && (hoister.counts.get(text) ?? 0) > 1) {
    let id = hoister.ids.get(text);

    if (!id) {
      id = `S${String(hoister.ids.size)}`;
      hoister.ids.set(text, id);
      hoister.defs[id] = hoist(node, hoister, true);
    }

    return { $ref: `#/$defs/${id}` };
  }

  if (Array.isArray(node)) return node.map((child) => hoist(child, hoister, false));

  // A name map is never replaced by a `$ref` itself (that is not a schema); its entries may be.
  return Object.fromEntries(
    Object.entries(node).map(([key, child]) => [
      key,
      NAME_MAPS.has(key) ? hoist(child, hoister, true) : hoist(child, hoister, false),
    ])
  );
}

// One compaction pass at a given description length. Returns minified JSON text.
export function compactSchema(schema: unknown, maxDescription: number): string {
  const cleaned = cleanNode(schema as Json, maxDescription);
  const counts = new Map<string, number>();
  countSubtrees(cleaned, counts);
  const hoister: Hoister = { counts, ids: new Map(), defs: {} };
  const root = hoist(cleaned, hoister, true);

  if (root === null || typeof root !== 'object' || Array.isArray(root)) return JSON.stringify(root);

  const existing = root.$defs && typeof root.$defs === 'object' && !Array.isArray(root.$defs) ? root.$defs : {};

  return JSON.stringify({ ...root, $defs: { ...existing, ...hoister.defs } });
}

export interface SchemaDigest {
  text: string;
  // Description length used (0 = descriptions dropped); `truncated` when even that overflowed.
  descriptionLength: number;
  truncated: boolean;
}

// The richest digest that fits `budget` characters. As a last resort the text is cut (and flagged),
// so the prompt never blows past its size guard.
export function fitSchema(schema: unknown, budget: number): SchemaDigest {
  for (const length of DESCRIPTION_STEPS) {
    const text = compactSchema(schema, length);

    if (text.length <= budget) return { text, descriptionLength: length, truncated: false };
  }

  return { text: compactSchema(schema, 0).slice(0, budget), descriptionLength: 0, truncated: true };
}
