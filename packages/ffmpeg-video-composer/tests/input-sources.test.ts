import { describe, it, expect } from 'vitest';
import { buildAnimationLegFilters, buildSingleFileAnimationSource, overlayMotionExpr } from '@/editor/inputSources';

// overlayMotionExpr maps a reveal intent to overlay-filter (W,H,w,h,t) coordinates. These assert the
// exact expressions so a regression in the entrance math is caught.
describe('overlayMotionExpr', () => {
  const RAMP = 'if(lt(t,0.3),0,if(lt(t,0.9),(t-0.3)/0.6,1))';

  it('returns nothing for undefined or "none"', () => {
    expect(overlayMotionExpr(undefined, '0:0')).toEqual({});
    expect(overlayMotionExpr('none', '0:0')).toEqual({});
  });

  it('rise lifts y from below the base position', () => {
    expect(overlayMotionExpr('rise', '40:200')).toEqual({ x: '40', y: `(200)+(1-(${RAMP}))*60` });
  });

  it('slide-left enters from the right of the base x', () => {
    expect(overlayMotionExpr('slide-left', '40:200')).toEqual({ x: `(40)+(1-(${RAMP}))*60`, y: '200' });
  });

  it('slide-right enters from the left of the base x', () => {
    expect(overlayMotionExpr('slide-right', '40:200')).toEqual({ x: `(40)-(1-(${RAMP}))*60`, y: '200' });
  });

  it('fade emits an alpha fade-in leg filter, no position change', () => {
    expect(overlayMotionExpr('fade', '40:200')).toEqual({ legFilter: 'fade=t=in:st=0.3:d=0.6:alpha=1' });
  });

  it('honours custom timing/distance overrides', () => {
    const expr = overlayMotionExpr({ type: 'rise', delay: 0.5, duration: 1, distance: 100 }, '0:0');
    expect(expr.y).toBe('(0)+(1-(if(lt(t,0.5),0,if(lt(t,1.5),(t-0.5)/1,1))))*100');
  });
});

// The animation-leg filter chain shared by the per-section overlay (MapManager.addAnimationOverlay)
// and the whole-video overlay pass (AnimationComposer) — scale the leg, then fade it when opacity < 1.
describe('buildAnimationLegFilters', () => {
  it('returns no filters when neither scale nor a fade is set', () => {
    expect(buildAnimationLegFilters({})).toEqual([]);
    expect(buildAnimationLegFilters({ opacity: 1 })).toEqual([]);
  });

  it('scales and squares the SAR when scale is set', () => {
    expect(buildAnimationLegFilters({ scale: '640:360' })).toEqual(['scale=640:360', 'setsar=1']);
  });

  it('fades via format+colorchannelmixer when opacity < 1', () => {
    expect(buildAnimationLegFilters({ opacity: 0.5 })).toEqual(['format=rgba', 'colorchannelmixer=aa=0.5']);
  });

  it('appends the fade after the scale on one chain when both are set', () => {
    expect(buildAnimationLegFilters({ scale: '640:360', opacity: 0.4 })).toEqual([
      'scale=640:360',
      'setsar=1',
      'format=rgba',
      'colorchannelmixer=aa=0.4',
    ]);
  });

  it('rotates via the rotate filter when a nonzero rotation is set', () => {
    expect(buildAnimationLegFilters({ rotation: 30 })).toEqual([
      'format=rgba',
      'rotate=a=30*PI/180:ow=rotw(30*PI/180):oh=roth(30*PI/180):c=none',
    ]);
  });

  it('adds no rotate filter when rotation is omitted or zero', () => {
    expect(buildAnimationLegFilters({})).toEqual([]);
    expect(buildAnimationLegFilters({ rotation: 0 })).toEqual([]);
  });

  it('rotates after the scale and before the opacity fade on one chain', () => {
    expect(buildAnimationLegFilters({ scale: '640:360', rotation: 45, opacity: 0.4 })).toEqual([
      'scale=640:360',
      'setsar=1',
      'format=rgba',
      'rotate=a=45*PI/180:ow=rotw(45*PI/180):oh=roth(45*PI/180):c=none',
      'colorchannelmixer=aa=0.4',
    ]);
  });
});

// The `-i` source fragment: loop/loops/duration map to `-stream_loop` and `-t` input options. An
// overlay can be bounded by a finite loop count (-stream_loop N-1) or a duration (-t seconds);
// `loop: true` is the legacy infinite case. webm keeps `-c:v libvpx-vp9` before the flags.
describe('buildSingleFileAnimationSource', () => {
  const src = (options: Record<string, unknown>, url = '/tmp/a.apng', opts?: { maxDuration?: number }) =>
    buildSingleFileAnimationSource({ url, options }, url, opts);

  it('plays once (no stream_loop) when neither loop, loops nor duration is set', () => {
    expect(src({})).toBe('-i /tmp/a.apng');
    expect(src({ loop: false })).toBe('-i /tmp/a.apng');
    expect(src({ loops: 1 })).toBe('-i /tmp/a.apng');
  });

  it('loops forever with -stream_loop -1 when loop is true', () => {
    expect(src({ loop: true })).toBe('-stream_loop -1 -i /tmp/a.apng');
  });

  it('repeats a finite number of times with -stream_loop (N-1)', () => {
    expect(src({ loops: 3 })).toBe('-stream_loop 2 -i /tmp/a.apng');
  });

  it('bounds by duration with -stream_loop -1 -t <seconds>', () => {
    expect(src({ duration: 8 })).toBe('-stream_loop -1 -t 8 -i /tmp/a.apng');
  });

  it('caps a finite loop count with -t when a maxDuration ceiling is given', () => {
    expect(src({ loops: 3 }, '/tmp/a.apng', { maxDuration: 10 })).toBe('-stream_loop 2 -t 10 -i /tmp/a.apng');
  });

  it('ignores the maxDuration ceiling for the duration mode (its own -t wins)', () => {
    expect(src({ duration: 8 }, '/tmp/a.apng', { maxDuration: 10 })).toBe('-stream_loop -1 -t 8 -i /tmp/a.apng');
  });

  it('does not apply the maxDuration ceiling to a forever loop (keeps it infinite)', () => {
    expect(src({ loop: true }, '/tmp/a.apng', { maxDuration: 10 })).toBe('-stream_loop -1 -i /tmp/a.apng');
  });

  it('puts -c:v libvpx-vp9 before the flags for a webm overlay', () => {
    expect(src({ duration: 8 }, '/tmp/a.webm')).toBe('-c:v libvpx-vp9 -stream_loop -1 -t 8 -i /tmp/a.webm');
  });

  it('delays the overlay with -itsoffset when start is set', () => {
    expect(src({ start: 3 })).toBe('-itsoffset 3 -i /tmp/a.apng');
    expect(src({ start: 3, duration: 8 })).toBe('-stream_loop -1 -itsoffset 3 -t 8 -i /tmp/a.apng');
    expect(src({ start: 3, loops: 3 })).toBe('-stream_loop 2 -itsoffset 3 -i /tmp/a.apng');
    expect(src({ start: 3, loop: true })).toBe('-stream_loop -1 -itsoffset 3 -i /tmp/a.apng');
  });

  it('omits -itsoffset for start 0 or undefined', () => {
    expect(src({ start: 0, duration: 8 })).toBe('-stream_loop -1 -t 8 -i /tmp/a.apng');
  });
});
