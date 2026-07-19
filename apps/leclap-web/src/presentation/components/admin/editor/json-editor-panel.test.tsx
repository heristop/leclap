// @vitest-environment node
// The raw-JSON escape hatch panel. The web app has no jsdom/@testing-library, so we render to
// static markup and assert the initial DOM (the interactive dirty/apply/error state machine itself
// is covered directly — and far more thoroughly — by json-editor-state.test.ts, since a static
// render can't simulate typing or clicks). This test only guards the wiring: the panel shows the
// exported descriptor JSON on mount (via the Suspense fallback, since CodeMirror never resolves
// synchronously during SSR) and carries the expected labels/roles.
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import { newSection, type EditorState, type EditorSection } from '../templateEditorModel';
import { exportDescriptorJson } from './templateIO';
import { JsonEditorPanel } from './json-editor-panel';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const noop = () => {};

function state(over: Partial<EditorState> = {}): EditorState {
  const video = { ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), duration: 6 };

  return {
    id: 'user-42',
    name: 'My Template',
    description: 'A demo',
    orientation: 'portrait',
    sections: [newSection('form'), video, newSection('color')],
    globalVariables: [],
    audio: { sourceVolume: 1, musicVolume: 0.5, ducking: false },
    defaultTransition: { type: 'cut', duration: 0.5 },
    globalAnimations: [],
    globalOverlays: [],
    ...over,
  };
}

const render = (over: Partial<EditorState> = {}) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <JsonEditorPanel state={state(over)} onImport={noop} />
    </I18nextProvider>
  );

describe('JsonEditorPanel', () => {
  it('shows the exported descriptor JSON on mount', () => {
    const html = render({ name: 'Holiday Promo' });
    // The fallback <textarea> renders its text content HTML-escaped (quotes become &quot;), so
    // compare against the same escaping rather than the raw JSON string.
    const escaped = exportDescriptorJson(state({ name: 'Holiday Promo' })).replaceAll('"', '&quot;');

    expect(html).toContain(escaped);
  });

  it('renders the raw-JSON label, apply button and a valid indicator for the current export', () => {
    const html = render();

    expect(html).toContain('Raw JSON');
    expect(html).toContain('Apply');
    expect(html).toContain('Valid JSON');
  });

  it('does not show the dirty or state-changed hints on a fresh, unedited mount', () => {
    const html = render();

    expect(html).not.toContain('Unapplied changes');
    expect(html).not.toContain('changed elsewhere');
  });
});
