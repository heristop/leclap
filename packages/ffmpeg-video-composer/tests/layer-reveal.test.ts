// Entrance (`reveal`) support for background layers and reveal-timed accent bars.
//
// - `revealEnableExpr` lowers a reveal intent to a drawbox timeline gate `'gte(t,<delay>)'` —
//   the LGPL-safe way to time a filter that has no alpha expression (drawbox pops at the delay).
// - `layersToFilters` gates a SOLID layer's fill + border drawboxes with that gate (gradient
//   layers animate via the overlay-motion machinery instead — see managers.test.ts).
// - the titleCard / lowerThird accent bar drawbox follows its text line's staggered reveal
//   timing so the bar never appears before the text it decorates.
import { describe, it, expect } from 'vitest';
import { revealEnableExpr } from '../src/editor/presets/text';
import { layersToFilters } from '../src/editor/presets/looks';
import { titleCardToFilters, lowerThirdToFilters } from '../src/editor/presets/text-blocks';
import { BackgroundLayerSchema } from '../src/schemas/effects.schemas';

describe('revealEnableExpr', () => {
  it('returns undefined for no reveal / none / a zero delay', () => {
    expect(revealEnableExpr(undefined)).toBeUndefined();
    expect(revealEnableExpr('none')).toBeUndefined();
    expect(revealEnableExpr({ type: 'none', delay: 1 })).toBeUndefined();
    expect(revealEnableExpr({ type: 'fade', delay: 0 })).toBeUndefined();
  });

  it('gates at the default 0.3s delay for a bare type', () => {
    expect(revealEnableExpr('fade')).toBe("'gte(t,0.3)'");
    expect(revealEnableExpr('rise')).toBe("'gte(t,0.3)'");
  });

  it('honours an authored delay, trimming float noise', () => {
    expect(revealEnableExpr({ type: 'fade', delay: 1.2 })).toBe("'gte(t,1.2)'");
    expect(revealEnableExpr({ type: 'rise', delay: 0.1 + 0.2 })).toBe("'gte(t,0.3)'");
  });
});

describe('BackgroundLayerSchema reveal', () => {
  it('accepts a bare reveal type and a full object', () => {
    expect(BackgroundLayerSchema.safeParse({ color: '#112233', reveal: 'fade' }).success).toBe(true);
    expect(
      BackgroundLayerSchema.safeParse({
        gradient: { from: '#000', to: '#fff' },
        reveal: { type: 'rise', delay: 0.5, duration: 1, easing: 'ease-out' },
      }).success
    ).toBe(true);
  });

  it('stays optional (older descriptors parse unchanged)', () => {
    const parsed = BackgroundLayerSchema.parse({ color: '#112233' });
    expect(parsed).not.toHaveProperty('reveal');
  });
});

describe('layersToFilters reveal', () => {
  it('gates a solid layer fill drawbox with the reveal delay', () => {
    const filters = layersToFilters([{ color: '#112233', reveal: 'fade' }]);

    expect(filters).toEqual([
      {
        type: 'drawbox',
        values: { x: 0, y: 0, w: 'iw', h: 'ih', c: '#112233@1', t: 'fill', enable: "'gte(t,0.3)'" },
      },
    ]);
  });

  it('gates the border drawbox with the same delay', () => {
    const filters = layersToFilters([
      { color: '#112233', border: { color: '#ffffff', width: 4 }, reveal: { type: 'rise', delay: 1 } },
    ]);

    expect(filters).toHaveLength(2);
    expect(filters[0].values).toMatchObject({ t: 'fill', enable: "'gte(t,1)'" });
    expect(filters[1].values).toMatchObject({ t: 4, enable: "'gte(t,1)'" });
  });

  it('emits no enable key without a reveal (backward compatible)', () => {
    const filters = layersToFilters([{ color: '#112233' }, { color: '#445566', reveal: 'none' }]);

    for (const filter of filters) {
      expect(filter.values).not.toHaveProperty('enable');
    }
  });

  it('still skips gradient layers (compiled by the maps pipeline)', () => {
    expect(layersToFilters([{ gradient: { from: '#000', to: '#fff' }, reveal: 'fade' }])).toEqual([]);
  });
});

describe('accent bar follows the reveal timing', () => {
  const ctx = { scale: '1280:720' };

  it('titleCard: the bar is gated at the headline line stagger (default rise, kicker+headline)', () => {
    const filters = titleCardToFilters({ kicker: { en: 'ON AIR' }, headline: { en: 'Ada' }, accent: '#7C83FD' }, ctx);
    const bar = filters.find((f) => f.type === 'drawbox');

    // kicker staggers at 0.3, headline at 0.45 — the bar underlines the headline.
    expect(bar?.values).toMatchObject({ c: '#7C83FD@1', enable: "'gte(t,0.45)'" });
  });

  it('titleCard: a headline-only card gates the bar at the base delay', () => {
    const filters = titleCardToFilters({ headline: { en: 'Ada' }, accent: '#7C83FD' }, ctx);
    const bar = filters.find((f) => f.type === 'drawbox');

    expect(bar?.values).toMatchObject({ enable: "'gte(t,0.3)'" });
  });

  it('titleCard: reveal none leaves the bar ungated (backward compatible)', () => {
    const filters = titleCardToFilters({ headline: { en: 'Ada' }, accent: '#7C83FD', reveal: 'none' }, ctx);
    const bar = filters.find((f) => f.type === 'drawbox');

    expect(bar?.values).not.toHaveProperty('enable');
  });

  it('lowerThird: the bar is gated with the title line (stagger index 0)', () => {
    const filters = lowerThirdToFilters({ title: { en: 'Aurora' }, accent: '#7C83FF' }, ctx);
    const bars = filters.filter((f) => f.type === 'drawbox');
    // band (ungated) + accent bar (gated with the title).
    const accentBar = bars.at(-1);

    expect(accentBar?.values).toMatchObject({ c: '#7C83FF@1', enable: "'gte(t,0.3)'" });
    expect(bars[0]?.values).not.toHaveProperty('enable');
  });

  it('lowerThird: an authored delay shifts the bar gate with the title', () => {
    const filters = lowerThirdToFilters(
      { title: { en: 'Aurora' }, accent: '#7C83FF', reveal: { type: 'fade', delay: 1 } },
      ctx
    );
    const accentBar = filters.filter((f) => f.type === 'drawbox').at(-1);

    expect(accentBar?.values).toMatchObject({ enable: "'gte(t,1)'" });
  });
});
