import { normalizePartialId } from '@/stores/userPartialStore';

// A local partial id no stored partial uses yet: the normalized base, else base-2, base-3… Saving
// upserts by id, so a fresh draft that reused a stored id would silently overwrite that partial.
export function uniquePartialId(base: string, taken: readonly string[]): string {
  const root = normalizePartialId(base);
  const used = new Set(taken.map(normalizePartialId));

  if (!used.has(root)) return root;

  let suffix = 2;

  while (used.has(`${root}-${String(suffix)}`)) suffix += 1;

  return `${root}-${String(suffix)}`;
}
