// The page-view path under a cookieless tracker. The DOM side (binding the tag's load/error) is out
// of scope here for the same reason components are — no jsdom — so what is pinned is the part that
// decides what gets sent and what gets dropped.

import { describe, expect, it } from 'vitest';
import { MAX_QUEUED, enqueue, pageViewProps } from './umami';

/** Identifiable no-ops: what matters is which of them survive the queue, not what they do. */
const call = (id: number) => () => id;

describe('enqueue', () => {
  it('keeps calls in order while there is room', () => {
    const first = call(1);
    const second = call(2);

    expect(enqueue(enqueue([], first, 3), second, 3)).toEqual([first, second]);
  });

  it('drops the oldest once full, so a blocked tracker cannot grow it without bound', () => {
    const calls = [call(1), call(2), call(3)];
    const queue = calls.reduce<ReturnType<typeof call>[]>((acc, c) => enqueue(acc, c, 2), []);

    expect(queue).toHaveLength(2);
    // The landing page view is the one worth losing after three navigations, not the current page.
    expect(queue).toEqual([calls[1], calls[2]]);
  });

  it('never exceeds the cap the module ships with', () => {
    const queue = Array.from({ length: MAX_QUEUED * 3 }).reduce<ReturnType<typeof call>[]>(
      (acc, _, index) => enqueue(acc, call(index as number), MAX_QUEUED),
      []
    );

    expect(queue).toHaveLength(MAX_QUEUED);
  });
});

describe('pageViewProps', () => {
  it('overrides the url and title while keeping what the tag injected', () => {
    // The callback form is the point: a bare object would drop the website id and the hit would be
    // rejected.
    expect(pageViewProps('/fr/studio', 'Studio')({ website: 'website-id', url: '/' })).toEqual({
      website: 'website-id',
      url: '/fr/studio',
      title: 'Studio',
    });
  });
});
