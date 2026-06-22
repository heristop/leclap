// @vitest-environment node
// The web app has no jsdom/@testing-library, so we render to static markup and assert the semantic +
// a11y contract: a real <input type=number> with min/max/step, the ▲▼ stepper buttons with aria-labels,
// and the (decorative) unit/sprocket cues. The scrub + slide are runtime-only and not asserted here.
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { NumberField } from './NumberField';

const noop = () => {};

const html = renderToStaticMarkup(
  <NumberField label="Duration" value={7} onChange={noop} min={1} max={60} step={2} unit="s" />
);

describe('NumberField (Take Counter)', () => {
  it('renders a real number input carrying the ARIA spinbutton range', () => {
    expect(html).toContain('type="number"');
    expect(html).toContain('min="1"');
    expect(html).toContain('max="60"');
    expect(html).toContain('step="2"');
    expect(html).toContain('value="7"');
  });

  it('exposes ▲▼ stepper buttons with aria-labels', () => {
    expect(html).toContain('▲');
    expect(html).toContain('▼');
    expect(html).toContain('aria-label="+2 Duration (s)"');
    expect(html).toContain('aria-label="-2 Duration (s)"');
    expect(html).toContain('type="button"');
  });

  it('renders the muted unit suffix and the slate/sprocket wrapper', () => {
    expect(html).toContain('take-counter');
    expect(html).toContain('take-counter-unit');
    expect(html).toContain('>s</span>');
  });

  it('associates the label with the input via htmlFor/id', () => {
    expect(html).toMatch(/<label[^>]+for="([^"]+)"/);
    const id = html.match(/<label[^>]+for="([^"]+)"/)?.[1];
    expect(id).toBeTruthy();
    expect(html).toContain(`id="${id}"`);
  });

  it('omits a max attribute when unbounded so the spinbutton has no false ceiling', () => {
    const open = renderToStaticMarkup(<NumberField label="Count" value={3} onChange={noop} />);
    expect(open).not.toContain('max=');
    expect(open).toContain('min="0"');
  });
});
