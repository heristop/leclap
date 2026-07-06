import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  newOverlay,
  newSection,
  toEditorState,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type AccentBar,
  type EditorState,
  type EditorSection,
  type EditableTemplate,
  type TemplateDescriptor,
  type TextOverlay,
} from '../src/editor/templateEditorModel';
import { TemplateDescriptorSchema } from 'ffmpeg-video-composer/src/schemas/template.schemas.ts';

function baseState(sections: EditorSection[]): EditorState {
  return {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections,
    globalVariables: [],
    audio: { ...DEFAULT_AUDIO_MIX },
    defaultTransition: { ...DEFAULT_TRANSITION },
    globalAnimations: [],
    globalOverlays: [],
  };
}

function asTemplate(state: EditorState): EditableTemplate {
  return {
    id: state.id,
    name: state.name,
    description: state.description,
    orientation: state.orientation,
    descriptor: buildDescriptor(state),
  };
}

function overlay(over: Partial<TextOverlay> = {}): TextOverlay {
  return { ...newOverlay(), ...over };
}

function videoSection(overlays: TextOverlay[]): EditorSection {
  return { ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), overlays };
}

// The reference overlay used across the suite: fontsize 50 keeps every default em → px conversion
// integral (50*6=300, 50*0.12=6, 50*1.2=60, 50*0.25=12.5→13), so expectations stay readable.
const accented = (accent: string | AccentBar, over: Partial<TextOverlay> = {}) =>
  overlay({ text: 'Title', x: 0.25, y: 0.8, fontsize: 50, accent, ...over });

function accentFilters(state: EditorState): Array<Record<string, unknown>> {
  const d = buildDescriptor(state);
  const video = d.sections?.find((s) => s.type === 'project_video');

  return (video?.filters ?? []).filter((f) => f.type === 'drawbox').map((f) => f.values as Record<string, unknown>);
}

function videoOverlays(state: EditorState): TextOverlay[] {
  const back = toEditorState(asTemplate(state));
  const video = back.sections.find((s) => s.kind === 'video') as Extract<EditorSection, { kind: 'video' }>;

  return video.overlays;
}

// The exact drawbox values a bare-string accent has always produced for the reference overlay.
const LEGACY_BAR_VALUES = {
  x: '(iw-300)*0.25',
  y: '(ih-60)*0.8+73',
  w: 300,
  h: 6,
  c: '#ff8800@1',
  t: 'fill',
};

// --- regression pin: the bare string form must stay byte-identical ---

describe('overlay accent geometry — string-form regression pin', () => {
  it('a bare string accent emits exactly the historical drawbox values', () => {
    const filters = accentFilters(baseState([videoSection([accented('#ff8800')])]));

    expect(filters).toEqual([LEGACY_BAR_VALUES]);
  });

  it('a bare string accent still serialises to the identical descriptor JSON', () => {
    const d = buildDescriptor(baseState([videoSection([accented('#ff8800')])]));
    const bar = (d.sections?.find((s) => s.type === 'project_video')?.filters ?? [])[1];

    // Key ORDER pinned too: the emitted JSON must be byte-identical for untouched templates.
    expect(JSON.stringify(bar)).toBe(
      '{"type":"drawbox","values":{"x":"(iw-300)*0.25","y":"(ih-60)*0.8+73","w":300,"h":6,"c":"#ff8800@1","t":"fill"}}'
    );
  });

  it('an object accent carrying only the colour emits the same values as the string form', () => {
    const fromString = accentFilters(baseState([videoSection([accented('#ff8800')])]));
    const fromObject = accentFilters(baseState([videoSection([accented({ color: '#ff8800' })])]));

    expect(fromObject).toEqual(fromString);
  });

  it('an all-default object accent emits the same values as the string form', () => {
    const all: AccentBar = { color: '#ff8800', position: 'below', length: 6, thickness: 0.12, align: 'center' };
    const fromObject = accentFilters(baseState([videoSection([accented(all)])]));

    expect(fromObject).toEqual([LEGACY_BAR_VALUES]);
  });
});

// --- lowering: geometry → drawbox expressions ---

describe('overlay accent geometry — lowering', () => {
  it('position above puts the bar gap+thickness above the y anchor', () => {
    const filters = accentFilters(baseState([videoSection([accented({ color: '#ff8800', position: 'above' })])]));

    // gap = round(50*0.25) = 13, barH = 6 → 19 above the drawtext top anchor.
    expect(filters[0]).toEqual({ ...LEGACY_BAR_VALUES, y: '(ih-60)*0.8-19' });
  });

  it('length and thickness scale the bar in em of the fontsize', () => {
    const filters = accentFilters(
      baseState([videoSection([accented({ color: '#ff8800', length: 4, thickness: 0.2 })])])
    );

    expect(filters[0]).toEqual({ ...LEGACY_BAR_VALUES, x: '(iw-200)*0.25', w: 200, h: 10 });
  });

  it('thickness keeps the 4px legibility floor', () => {
    const filters = accentFilters(
      baseState([videoSection([accented({ color: '#ff8800', thickness: 0.05 })])])
    );

    // round(50*0.05) = 3 → floored to 4 so the bar never vanishes at small sizes.
    expect(filters[0]).toEqual({ ...LEGACY_BAR_VALUES, h: 4 });
  });

  it('align left hangs the bar rightward from the x anchor line', () => {
    const filters = accentFilters(baseState([videoSection([accented({ color: '#ff8800', align: 'left' })])]));

    expect(filters[0]).toEqual({ ...LEGACY_BAR_VALUES, x: 'iw*0.25' });
  });

  it('align right ends the bar on the x anchor line', () => {
    const filters = accentFilters(baseState([videoSection([accented({ color: '#ff8800', align: 'right' })])]));

    expect(filters[0]).toEqual({ ...LEGACY_BAR_VALUES, x: 'iw*0.25-300' });
  });

  it('keeps the reveal-sync enable gate on a geometry bar', () => {
    const filters = accentFilters(
      baseState([videoSection([accented({ color: '#ff8800', position: 'above' }, { reveal: 'rise' })])])
    );

    expect(filters[0].enable).toBe("'gte(t,0.3)'");
  });

  it('a full geometry descriptor validates against the template schema', () => {
    const full: AccentBar = { color: '#ff8800', position: 'above', length: 4, thickness: 0.2, align: 'left' };
    const d = buildDescriptor(baseState([videoSection([accented(full)])]));

    expect(() => TemplateDescriptorSchema.parse(d)).not.toThrow();
  });
});

// --- recovery: drawbox expressions → minimal accent ---

describe('overlay accent geometry — recovery round-trip', () => {
  it('a bare string accent round-trips back to the plain string form', () => {
    const overlays = [accented('#ff8800')];
    const recovered = videoOverlays(baseState([videoSection(overlays)]));

    expect(recovered).toEqual(overlays);
    expect(recovered[0].accent).toBe('#ff8800');
  });

  it('an all-default object accent collapses back to the plain string form', () => {
    const all: AccentBar = { color: '#ff8800', position: 'below', length: 6, thickness: 0.12, align: 'center' };
    const recovered = videoOverlays(baseState([videoSection([accented(all)])]));

    expect(recovered[0].accent).toBe('#ff8800');
  });

  it('round-trips a full geometry object exactly', () => {
    const full: AccentBar = { color: '#ff8800', position: 'above', length: 4, thickness: 0.2, align: 'left' };
    const recovered = videoOverlays(baseState([videoSection([accented(full)])]));

    expect(recovered[0].accent).toEqual(full);
  });

  it('round-trips a partial object with only the non-default fields', () => {
    const partial: AccentBar = { color: '#ff8800', align: 'right' };
    const recovered = videoOverlays(baseState([videoSection([accented(partial)])]));

    expect(recovered[0].accent).toEqual({ color: '#ff8800', align: 'right' });
  });

  it('rebuilds an identical descriptor after a geometry round-trip', () => {
    const full: AccentBar = { color: '#ff8800', position: 'above', length: 3.5, thickness: 0.25, align: 'right' };
    const state = baseState([videoSection([accented(full)])]);
    const back = toEditorState(asTemplate(state));

    expect(buildDescriptor(back)).toEqual(buildDescriptor(state));
  });

  it('does not claim a hand-authored drawbox whose y is not the kit anchor form', () => {
    const descriptor = {
      sections: [
        {
          name: 'video_1',
          type: 'project_video',
          options: { duration: 8, muteSection: false },
          filters: [
            {
              type: 'drawtext',
              values: {
                text: { en: 'Hi' },
                fontsize: 48,
                fontcolor: '#ffffff',
                fontfile: 'Rubik.ttf',
                x: '(w-text_w)*0.5',
                y: '(h-text_h)*0.5',
              },
            },
            // Kit-like x form, but a hand-set numeric y: the extended signature must reject it.
            { type: 'drawbox', values: { x: '(iw-300)*0.5', y: 900, w: 300, h: 6, c: '#ff8800@1', t: 'fill' } },
          ],
        },
      ],
    } as unknown as TemplateDescriptor;
    const back = toEditorState({ id: 'user-x', name: 'T', description: '', orientation: 'landscape', descriptor });
    const video = back.sections.find((s) => s.kind === 'video') as Extract<EditorSection, { kind: 'video' }>;

    expect(video.overlays[0]).not.toHaveProperty('accent');
  });

  it('does not claim a centered drawbox whose x width disagrees with its w', () => {
    const descriptor = {
      sections: [
        {
          name: 'video_1',
          type: 'project_video',
          options: { duration: 8, muteSection: false },
          filters: [
            {
              type: 'drawtext',
              values: {
                text: { en: 'Hi' },
                fontsize: 48,
                fontcolor: '#ffffff',
                fontfile: 'Rubik.ttf',
                x: '(w-text_w)*0.5',
                y: '(h-text_h)*0.5',
              },
            },
            // x says a 500px box, w says 300: not a kit emission — leave it alone.
            {
              type: 'drawbox',
              values: { x: '(iw-500)*0.5', y: '(ih-58)*0.5+72', w: 300, h: 6, c: '#ff8800@1', t: 'fill' },
            },
          ],
        },
      ],
    } as unknown as TemplateDescriptor;
    const back = toEditorState({ id: 'user-x', name: 'T', description: '', orientation: 'landscape', descriptor });
    const video = back.sections.find((s) => s.kind === 'video') as Extract<EditorSection, { kind: 'video' }>;

    expect(video.overlays[0]).not.toHaveProperty('accent');
  });
});
