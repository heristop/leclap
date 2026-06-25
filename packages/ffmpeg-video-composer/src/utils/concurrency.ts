// Run `fn` over `items` with at most `limit` tasks in flight. Results are returned in input order
// (not completion order). Rejects with the first error raised; in-flight tasks are allowed to
// settle but no further items are started once a rejection occurs.
export const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results = Array.from<R>({ length: items.length });
  const effectiveLimit = Math.max(1, Math.min(limit, items.length));
  let nextIndex = 0;

  // Each worker pulls the next index, runs it, then recurses to the next free index. Recursion (vs a
  // while-await loop) keeps at most `effectiveLimit` tasks in flight without awaiting inside a loop.
  const worker = async (): Promise<void> => {
    const current = nextIndex;
    nextIndex += 1;

    if (current >= items.length) {
      return;
    }

    results[current] = await fn(items[current], current);

    return worker();
  };

  if (items.length === 0) {
    return results;
  }

  await Promise.all(Array.from({ length: effectiveLimit }, () => worker()));

  return results;
};
