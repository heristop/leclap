import { describe, it, expect } from 'vitest';
import { revealToExpr } from '@/editor/presets/text';
import { titleCardToFilters, lowerThirdToFilters, globalTextOverlayToFilters } from '@/editor/presets/text-blocks';
import type { Filter } from '@/core/types';

// The reveal helper generates the exact drawtext alpha/x/y expressions authors used to hand-write.
// These assert the precise strings so a regression in the timing math is caught.
describe('revealToExpr', () => {
  const base = { x: '(w-text_w)/2', y: 652 };
  const DEFAULT_RAMP = 'if(lt(t,0.3),0,if(lt(t,0.9),(t-0.3)/0.6,1))';

  it('returns nothing for undefined or "none"', () => {
    expect(revealToExpr(undefined, base)).toEqual({});
    expect(revealToExpr('none', base)).toEqual({});
    expect(revealToExpr({ type: 'none' }, base)).toEqual({});
  });

  it('fade emits only an alpha ramp', () => {
    expect(revealToExpr('fade', base)).toEqual({ alpha: `'${DEFAULT_RAMP}'` });
  });

  it('rise lifts y up into place and fades in', () => {
    expect(revealToExpr('rise', { x: 0, y: 652 })).toEqual({
      alpha: `'${DEFAULT_RAMP}'`,
      y: `'(652)+(1-(${DEFAULT_RAMP}))*60'`,
    });
  });

  it('slide-left enters from the right (base + offset)', () => {
    expect(revealToExpr('slide-left', base)).toEqual({
      alpha: `'${DEFAULT_RAMP}'`,
      x: `'((w-text_w)/2)+(1-(${DEFAULT_RAMP}))*60'`,
    });
  });

  it('slide-right enters from the left (base - offset)', () => {
    expect(revealToExpr('slide-right', { x: 64, y: 0 })).toEqual({
      alpha: `'${DEFAULT_RAMP}'`,
      x: `'(64)-(1-(${DEFAULT_RAMP}))*60'`,
    });
  });

  it('honours custom delay/duration/distance', () => {
    const ramp = 'if(lt(t,0.5),0,if(lt(t,0.9),(t-0.5)/0.4,1))';

    expect(revealToExpr({ type: 'rise', delay: 0.5, duration: 0.4, distance: 120 }, { x: 0, y: 100 })).toEqual({
      alpha: `'${ramp}'`,
      y: `'(100)+(1-(${ramp}))*120'`,
    });
  });

  it('renders fractional sums without float noise', () => {
    expect(revealToExpr({ type: 'fade', delay: 0.1, duration: 0.2 }, base)).toEqual({
      alpha: `'if(lt(t,0.1),0,if(lt(t,0.3),(t-0.1)/0.2,1))'`,
    });
  });
});

describe('titleCardToFilters', () => {
  const ctx = { scale: '1280:720', backgroundColor: '#0d1b2a' };
  const RAMP_03 = 'if(lt(t,0.3),0,if(lt(t,0.9),(t-0.3)/0.6,1))';

  it('returns [] for an empty / textless card', () => {
    expect(titleCardToFilters(undefined, ctx)).toEqual([]);
    expect(titleCardToFilters({ headline: { en: '  ' } }, ctx)).toEqual([]);
  });

  it('headline-only card: one drawtext (rise) + auto fades, sized from scale', () => {
    expect(titleCardToFilters({ headline: { en: 'We did it' } }, ctx)).toEqual<Filter[]>([
      {
        type: 'drawtext',
        values: {
          text: { en: 'We did it' },
          x: '77',
          y: `'(325)+(1-(${RAMP_03}))*60'`,
          fontfile: 'Anton.ttf',
          fontsize: 61,
          fontcolor: '#ffffff',
          alpha: `'${RAMP_03}'`,
        } as Filter['values'],
      },
      { type: 'fadein', values: { color: '#0d1b2a' } },
      { type: 'fadeout', values: { color: '#0d1b2a' } },
    ]);
  });

  it('full card staggers the lines and draws an accent bar; fades can be disabled', () => {
    const filters = titleCardToFilters(
      { kicker: { en: 'ON THE RECORD' }, headline: { en: 'Ada' }, subtitle: { en: 'Engineer' }, accent: '#7C83FD', fade: { out: false } },
      ctx
    );

    expect(filters.map((f) => f.type)).toEqual(['drawtext', 'drawtext', 'drawbox', 'drawtext', 'fadein']);

    // kicker (index 0) tinted with the accent, headline (index 1) staggered +0.15s.
    expect((filters[0].values as Record<string, unknown>).fontcolor).toBe('#7C83FD');
    expect((filters[1].values as Record<string, unknown>).alpha).toBe(
      `'if(lt(t,0.45),0,if(lt(t,1.05),(t-0.45)/0.6,1))'`
    );

    // accent bar uses the accent colour at full opacity.
    expect((filters[2].values as Record<string, unknown>).c).toBe('#7C83FD@1');
  });

  it('center align centers text and the accent bar', () => {
    const filters = titleCardToFilters({ headline: { en: 'Hi' }, accent: '#fff', align: 'center', reveal: 'none' }, ctx);

    expect((filters[0].values as Record<string, unknown>).x).toBe('(w-text_w)/2');
    expect((filters[1].values as Record<string, unknown>).x).toBe('(w-166)/2');
  });
});

describe('lowerThirdToFilters', () => {
  const ctx = { scale: '1280:720' };

  it('returns [] when empty', () => {
    expect(lowerThirdToFilters(undefined, ctx)).toEqual([]);
    expect(lowerThirdToFilters({ title: { en: ' ' } }, ctx)).toEqual([]);
  });

  it('draws band + accent bar + title + subtitle + badge anchored at the bottom', () => {
    const filters = lowerThirdToFilters(
      { title: { en: 'Aurora' }, subtitle: { en: 'Fast' }, badge: { en: '$199' }, accent: '#7C83FF' },
      ctx
    );

    expect(filters.map((f) => f.type)).toEqual(['drawbox', 'drawbox', 'drawtext', 'drawtext', 'drawtext']);

    // band: bottom 20% of a 720-tall frame, full width, dark @ default 0.6.
    expect(filters[0].values).toMatchObject({ x: 0, y: 576, w: 'iw', h: 144, c: '#0a0f14@0.6' });
    // badge: right-aligned drawtext pill with the accent as its box colour.
    const badge = filters[4].values as Record<string, unknown>;
    expect(badge.x).toBe('w-text_w-77');
    expect(badge.boxcolor).toBe('#7C83FF@1');
  });

  it('boxOpacity 0 drops the band; top position anchors to y=0', () => {
    const filters = lowerThirdToFilters({ title: { en: 'Hi' }, position: 'top', boxOpacity: 0, reveal: 'none' }, ctx);

    expect(filters.map((f) => f.type)).toEqual(['drawtext']);
    expect((filters[0].values as Record<string, unknown>).y).toBe(40);
  });
});

describe('globalTextOverlayToFilters', () => {
  const ctx = { scale: '1280:720' };

  it('anchors a watermark top-right by default, sized from the frame', () => {
    expect(globalTextOverlayToFilters({ text: { en: 'BRAND' } }, ctx)).toEqual([
      {
        type: 'drawtext',
        values: { text: { en: 'BRAND' }, x: 'w-text_w-64', y: '36', fontfile: 'Oswald.ttf', fontsize: 22, fontcolor: '#ffffff' },
      },
    ]);
  });

  it('a static opacity becomes a constant alpha', () => {
    const [f] = globalTextOverlayToFilters({ text: { en: 'BRAND' }, opacity: 0.5 }, ctx);
    expect((f.values as Record<string, unknown>).alpha).toBe('0.5');
  });

  it('a reveal animates the entrance instead of a static alpha', () => {
    const [f] = globalTextOverlayToFilters({ text: { en: 'BRAND' }, reveal: 'fade' }, ctx);
    expect((f.values as Record<string, unknown>).alpha).toBe(`'if(lt(t,0.3),0,if(lt(t,0.9),(t-0.3)/0.6,1))'`);
  });

  it('center position centers the text', () => {
    const [f] = globalTextOverlayToFilters({ text: { en: 'X' }, position: 'center' }, ctx);
    const v = f.values as Record<string, unknown>;
    expect(v.x).toBe('(w-text_w)/2');
    expect(v.y).toBe('(h-text_h)/2');
  });
});
