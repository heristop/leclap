// @vitest-environment node
// The web app has no jsdom/RTL (see vitest.config.ts), so this renders to static markup the same way
// MediaPicker.test.tsx does. It asserts the one thing that silently breaks mobile capture if wrong:
// a wildcard accept must reach the input bare, with no extension list appended.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { useMediaDrop } from './use-media-drop';
import type { AcceptSpec } from '../core/types';

const VIDEO: AcceptSpec = [{ mime: 'video/*', extensions: ['.mp4', '.mkv'] }];
const ANIM: AcceptSpec = [{ mime: 'image/apng', extensions: ['.apng'] }];

function Harness({ accept, multiple }: { accept: AcceptSpec; multiple?: boolean }) {
  const { getRootProps, getInputProps } = useMediaDrop({ onDrop: () => {}, accept, multiple });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
    </div>
  );
}

describe('useMediaDrop', () => {
  it('advertises a wildcard bare, so iOS and Android keep Camera and Photo Library', () => {
    const html = renderToStaticMarkup(<Harness accept={VIDEO} />);
    expect(html).toContain('accept="video/*"');
    expect(html).not.toContain('.mp4');
  });

  it('advertises concrete types with their extensions', () => {
    expect(renderToStaticMarkup(<Harness accept={ANIM} />)).toContain('accept="image/apng,.apng"');
  });

  it('exposes the surface to keyboard users as a button', () => {
    const html = renderToStaticMarkup(<Harness accept={VIDEO} />);
    expect(html).toContain('role="button"');
    expect(html).toContain('tabindex="0"');
  });

  it('honours multiple', () => {
    expect(renderToStaticMarkup(<Harness accept={VIDEO} multiple />)).toContain('multiple');
  });
});
