import { describe, it, expect } from 'vitest';
import {
  buildAnimationLegFilters,
  buildGradientSource,
  buildSingleFileAnimationSource,
  overlayMotionExpr,
  resolveLayerGeometry,
} from '@/editor/inputSources';

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

  // fit maps the overlay into its "w:h" box without distortion: contain letterboxes inside it with
  // transparent padding, cover fills it and centre-crops the overflow. scale/pad/crop are core LGPL.
  it('contain letterboxes inside the box with transparent padding', () => {
    expect(buildAnimationLegFilters({ scale: '640:360', fit: 'contain' })).toEqual([
      'scale=640:360:force_original_aspect_ratio=decrease',
      'format=rgba',
      'pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black@0',
      'setsar=1',
    ]);
  });

  it('cover fills the box and centre-crops the overflow', () => {
    expect(buildAnimationLegFilters({ scale: '640:360', fit: 'cover' })).toEqual([
      'scale=640:360:force_original_aspect_ratio=increase',
      'crop=640:360',
      'setsar=1',
    ]);
  });

  it('stretch (explicit or omitted) keeps the plain free scale', () => {
    expect(buildAnimationLegFilters({ scale: '640:360', fit: 'stretch' })).toEqual(['scale=640:360', 'setsar=1']);
  });

  it('ignores fit without a scale box or with a keep-aspect (-1) component', () => {
    expect(buildAnimationLegFilters({ fit: 'contain' })).toEqual([]);
    expect(buildAnimationLegFilters({ scale: '640:-1', fit: 'cover' })).toEqual(['scale=640:-1', 'setsar=1']);
  });

  it('reuses the contain rgba frame for the opacity fade (no second format)', () => {
    expect(buildAnimationLegFilters({ scale: '640:360', fit: 'contain', opacity: 0.4 })).toEqual([
      'scale=640:360:force_original_aspect_ratio=decrease',
      'format=rgba',
      'pad=640:360:(ow-iw)/2:(oh-ih)/2:color=black@0',
      'setsar=1',
      'colorchannelmixer=aa=0.4',
    ]);
  });

  it('rotates and fades after a cover fit on one chain', () => {
    expect(buildAnimationLegFilters({ scale: '640:360', fit: 'cover', rotation: 45, opacity: 0.4 })).toEqual([
      'scale=640:360:force_original_aspect_ratio=increase',
      'crop=640:360',
      'setsar=1',
      'format=rgba',
      'rotate=a=45*PI/180:ow=rotw(45*PI/180):oh=roth(45*PI/180):c=none',
      'colorchannelmixer=aa=0.4',
    ]);
  });
});

// A background layer's x/y/w/h are authored as pixels or `iw*<f>`/`ih*<f>` fraction expressions
// (the builder UI emits the latter). resolveLayerGeometry lowers them to concrete pixels against
// the project scale so the gradients source can be sized and the overlay positioned.
describe('resolveLayerGeometry', () => {
  it('defaults to a full-frame box at the origin', () => {
    expect(resolveLayerGeometry({}, '1280:720')).toEqual({ x: 0, y: 0, w: 1280, h: 720 });
  });

  it('passes plain pixel numbers through, rounded to whole pixels', () => {
    expect(resolveLayerGeometry({ x: 100, y: 50.4, w: 640, h: 360 }, '1280:720')).toEqual({
      x: 100,
      y: 50,
      w: 640,
      h: 360,
    });
  });

  it('resolves iw/ih fraction expressions against the scale', () => {
    expect(resolveLayerGeometry({ x: 'iw*0.25', y: 'ih*0.25', w: 'iw*0.5', h: 'ih*0.5' }, '1280:720')).toEqual({
      x: 320,
      y: 180,
      w: 640,
      h: 360,
    });
  });

  it('resolves an ih-based width and an iw-based height by their own basis', () => {
    // A square box authored as ih on both axes: w follows the expression's basis, not the axis.
    expect(resolveLayerGeometry({ w: 'ih*0.5', h: 'ih*0.5' }, '1280:720')).toEqual({ x: 0, y: 0, w: 360, h: 360 });
  });

  it('falls back for unresolvable expressions (w/h to full frame, x/y to 0)', () => {
    expect(resolveLayerGeometry({ x: 't*10', y: 'main_h/2', w: 'foo', h: 'bar' }, '1280:720')).toEqual({
      x: 0,
      y: 0,
      w: 1280,
      h: 720,
    });
  });

  it('clamps w/h to at least 1 pixel', () => {
    expect(resolveLayerGeometry({ w: 0, h: 'ih*0.0001' }, '1280:720')).toEqual({ x: 0, y: 0, w: 1, h: 1 });
  });

  it('falls back to 1280x720 when the scale is not plain positive pixels', () => {
    expect(resolveLayerGeometry({ w: 'iw*0.5' }, '1280:-1')).toEqual({ x: 0, y: 0, w: 640, h: 720 });
  });
});

// The gradients lavfi source must be sized to the LAYER's box (not the full frame) so a 50%-wide
// gradient layer actually renders half-frame; the sweep coords span the box.
describe('buildGradientSource geometry', () => {
  const gradient = { from: '#000000', to: '#ffffff' };

  it('sizes the source to the full scale when the layer has no w/h', () => {
    const src = buildGradientSource({ gradient }, '1280:720', 4);
    expect(src).toContain('gradients=s=1280x720:c0=#000000:c1=#ffffff:d=4');
    expect(src).toContain('x0=0:y0=0:x1=0:y1=720');
  });

  it('sizes the source to the resolved w/h box and sweeps across it', () => {
    const src = buildGradientSource(
      { gradient: { ...gradient, direction: 'diagonal' }, w: 'iw*0.5', h: 'ih*0.5' },
      '1280:720',
      4
    );
    expect(src).toContain('gradients=s=640x360');
    expect(src).toContain('x0=0:y0=0:x1=640:y1=360');
  });

  it('sweeps a horizontal gradient across the layer width, not the frame', () => {
    const src = buildGradientSource({ gradient: { ...gradient, direction: 'horizontal' }, w: 320, h: 720 }, '1280:720', 2);
    expect(src).toContain('gradients=s=320x720');
    expect(src).toContain('x0=0:y0=0:x1=320:y1=0');
  });
});

// The gradients source's default speed (0.01) slowly rotates the gradient over the section — an
// unexposed side effect; the layer must render a STILL gradient, so speed=0 is always explicit.
// `shape` lowers to the source's `type` option (linear|radial|circular|spiral); non-linear shapes
// radiate from a point, so their origin is centred in the layer box instead of using the linear
// direction sweep coords (which would pin a radial at the top-left corner).
describe('buildGradientSource shape', () => {
  const gradient = { from: '#000000', to: '#ffffff' };

  it('freezes the gradient with speed=0 and emits no type token when shape is unset', () => {
    const src = buildGradientSource({ gradient }, '1280:720', 4);
    expect(src).toContain('speed=0');
    expect(src).not.toContain('type=');
  });

  it('lowers shape=linear to type=linear and keeps the direction sweep coords', () => {
    const src = buildGradientSource(
      { gradient: { ...gradient, shape: 'linear', direction: 'horizontal' } },
      '1280:720',
      4
    );
    expect(src).toContain('type=linear');
    expect(src).toContain('x0=0:y0=0:x1=1280:y1=0');
  });

  it('centres a radial gradient in the layer box and reaches its far corner', () => {
    const src = buildGradientSource({ gradient: { ...gradient, shape: 'radial' } }, '1280:720', 4);
    expect(src).toContain('type=radial');
    expect(src).toContain('x0=640:y0=360:x1=1280:y1=720');
    expect(src).toContain('speed=0');
  });

  it('centres circular and spiral shapes the same way', () => {
    const circular = buildGradientSource(
      { gradient: { ...gradient, shape: 'circular' }, w: 'iw*0.5', h: 'ih*0.5' },
      '1280:720',
      4
    );
    expect(circular).toContain('type=circular');
    expect(circular).toContain('x0=320:y0=180:x1=640:y1=360');

    const spiral = buildGradientSource({ gradient: { ...gradient, shape: 'spiral' } }, '1280:720', 4);
    expect(spiral).toContain('type=spiral');
    expect(spiral).toContain('x0=640:y0=360:x1=1280:y1=720');
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
