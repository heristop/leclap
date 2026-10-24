// @vitest-environment node
// The web icons: drawn from the shared glyphs, decorative unless labelled, duotone parts
// marked for the stylesheet, and the gesture's parts tagged so icons.css can move them.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Check, Clapperboard, Play, Scissors, Trash2 } from './index';

describe('LeClap icons', () => {
  it('renders a 24-unit line icon, hidden from assistive tech by default', () => {
    const html = renderToStaticMarkup(<Play className="size-4" />);

    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('class="lc-icon lc-icon-play size-4"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('data-motion="nudge"');
  });

  it('stays visible to assistive tech when labelled', () => {
    expect(renderToStaticMarkup(<Play aria-label="Play" />)).not.toContain('aria-hidden');
  });

  it('marks the tinted part, the moving parts and the gradient they share', () => {
    const html = renderToStaticMarkup(<Trash2 />);

    expect(html).toContain('class="lc-f"');
    expect(html).toContain('class="lc-m"');
    expect(html).toMatch(/--lc-gradient:url\(#lc-icon-[a-zA-Z0-9]+\)/);
    expect(html).toContain('<linearGradient');
    expect(html).toContain('--lc-origin:20px 7.5px');
  });

  it('draws a line-only icon without a gradient, and gives a drawn stroke its length', () => {
    const html = renderToStaticMarkup(<Check />);

    expect(html).not.toContain('linearGradient');
    expect(html).toContain('pathLength="1"');
  });

  it('splits a two-handed gesture into two groups', () => {
    const html = renderToStaticMarkup(<Scissors />);

    expect(html).toContain('class="lc-m"');
    expect(html).toContain('class="lc-m2"');
  });

  it('takes a size, a colour and a line width', () => {
    const html = renderToStaticMarkup(<Clapperboard size={16} color="red" strokeWidth={1.5} />);

    expect(html).toContain('width="16"');
    expect(html).toContain('stroke="red"');
    expect(html).toContain('stroke-width="1.5"');
  });
});
