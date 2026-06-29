// @vitest-environment node
// Renders EditorPanelSwitch (scenes tool, a color section) to static markup and asserts the unified
// element block replaced the old per-element editors: the Add trigger + element list show, the
// SECTION-LEVEL duration field stays, and the retired LayersEditor markers are gone.
import { beforeAll, describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import admin from '@/i18n/locales/en/admin.json';
import { newSection, toEditorState, type EditorSection, type EditorState } from '../templateEditorModel';
import { newExtraLayer } from '../editor/layerGeometry';
import { initialSectionSelection } from './useSectionSelection';
import { EditorPanelSwitch } from './EditorPanelSwitch';

beforeAll(async () => {
  await i18n.init({ lng: 'en', fallbackLng: 'en', ns: ['admin'], defaultNS: 'admin', resources: { en: { admin } } });
});

const noop = () => {};

const colorSection = (): EditorSection => ({
  ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
  layers: [newExtraLayer()],
});

const baseState = (section: EditorSection): EditorState => ({ ...toEditorState(null), sections: [section] });

const render = (section: EditorSection) =>
  renderToStaticMarkup(
    <I18nextProvider i18n={i18n}>
      <EditorPanelSwitch
        activeTool="scenes"
        state={baseState(section)}
        section={section}
        partials={[]}
        patch={noop}
        patchSection={noop}
        onImport={noop}
        selection={initialSectionSelection}
        onSelectElement={noop}
      />
    </I18nextProvider>
  );

describe('EditorPanelSwitch', () => {
  it('renders the unified add menu + element list alongside section-level fields', () => {
    const html = render(colorSection());

    expect(html).toContain(`aria-label="${admin.element.add}"`);
    expect(html).toContain(admin.element.list);
    // The duration label is pluralized (Duration (second) / (seconds)); assert the shared stem so the
    // test holds whatever the default count resolves to.
    expect(html).toContain(admin.video.duration_other.split(' (')[0]);
  });

  it('drops the old per-element LayersEditor from the section fields', () => {
    const html = render(colorSection());

    // "Add layer" is the LayersEditor's distinctive control; it must no longer render in the panel.
    expect(html).not.toContain(admin.layer.add);
  });
});
