import { describe, it, expect } from 'vitest';
import {
  buildDescriptor,
  collectVariables,
  newOverlay,
  parseFraction,
  toEditorState,
  newSection,
  type EditorState,
  type EditorSection,
  type TextOverlay,
} from './templateEditorModel';
import { MUSIC_LIBRARY, BACKGROUND_LIBRARY } from '@/data/mediaCatalog';
import type { Template } from '@/services/templateService';

// All drawtext filters on the first project_video section, as plain value maps.
function drawtextFilters(state: EditorState): Array<Record<string, unknown>> {
  const d = buildDescriptor(state);
  const video = d.sections?.find((s) => s.type === 'project_video');

  return (video?.filters ?? []).filter((f) => f.type === 'drawtext').map((f) => f.values as Record<string, unknown>);
}

// Values of the first drawtext filter (convenience for single-overlay cases).
function drawtextValues(state: EditorState): Record<string, unknown> | undefined {
  return drawtextFilters(state)[0];
}

function overlay(over: Partial<TextOverlay> = {}): TextOverlay {
  return { ...newOverlay(), ...over };
}

function videoSection(overlays: TextOverlay[]): EditorSection {
  return { ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>), overlays };
}

// Accepts either a bare section array (legacy call sites) or a Partial<EditorState>
// override object. Always supplies a default empty globalVariables.
function baseState(input: EditorSection[] | Partial<EditorState> = {}): EditorState {
  const over: Partial<EditorState> = Array.isArray(input) ? { sections: input } : input;

  const defaults: EditorState = {
    id: 'user-1',
    name: 'T',
    description: '',
    orientation: 'landscape',
    sections: [],
    globalVariables: [],
    audioMix: { video: 1, music: 0.5 },
  };

  return Object.assign(defaults, over);
}

function asTemplate(state: EditorState): Template {
  return {
    id: state.id,
    name: state.name,
    description: state.description,
    orientation: state.orientation,
    hasForm: false,
    complexity: 'simple',
    source: 'user',
    descriptor: buildDescriptor(state),
  };
}

const music1 = MUSIC_LIBRARY[0];
const music2 = MUSIC_LIBRARY[1];
const bg1 = BACKGROUND_LIBRARY[0];
const bg2 = BACKGROUND_LIBRARY[1];

describe('templateEditorModel — music section', () => {
  it('folds a music section into global.musicEnabled/allowedMusic/allowUploadMusic', () => {
    const d = buildDescriptor(
      baseState([newSection('video'), { kind: 'music', allowed: [music1.id, music2.id], allowUpload: true }])
    );

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([music1.id, music2.id]);
    expect(d.global?.allowUploadMusic).toBe(true);
  });

  it('emits allowUploadMusic:false when uploads are not allowed', () => {
    const d = buildDescriptor(baseState([{ kind: 'music', allowed: [music1.id], allowUpload: false }]));

    expect(d.global?.allowUploadMusic).toBe(false);
  });

  it('leaves music globals off (musicEnabled:false) when there is no music section', () => {
    const d = buildDescriptor(baseState([newSection('video')]));

    expect(d.global?.musicEnabled).toBe(false);
    expect(d.global?.allowedMusic).toBeUndefined();
    expect(d.global?.allowUploadMusic).toBeUndefined();
  });

  it('treats an upload-only music section (no shortlist) as enabled', () => {
    const d = buildDescriptor(baseState([{ kind: 'music', allowed: [], allowUpload: true }]));

    expect(d.global?.musicEnabled).toBe(true);
    expect(d.global?.allowedMusic).toEqual([]);
    expect(d.global?.allowUploadMusic).toBe(true);
  });
});

describe('templateEditorModel — image section', () => {
  it('emits an image_background descriptor section with its duration + background globals', () => {
    const d = buildDescriptor(
      baseState([{ kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 6 }])
    );

    const imageSection = d.sections?.find((s) => s.type === 'image_background');

    expect(imageSection).toMatchObject({ name: 'image_1', type: 'image_background', options: { duration: 6 } });
    // placeholder carries no pictureUrl — the Builder injects the chosen one later
    expect((imageSection?.options as { pictureUrl?: string } | undefined)?.pictureUrl).toBeUndefined();
    expect(d.global?.allowedBackgrounds).toEqual([bg1.id, bg2.id]);
    expect(d.global?.allowUploadBackground).toBe(true);
  });

  it('numbers multiple image sections image_1, image_2 and de-duplicates the global union', () => {
    const d = buildDescriptor(
      baseState([
        { kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 },
        { kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 5 },
      ])
    );

    const imageSections = (d.sections ?? []).filter((s) => s.type === 'image_background');

    expect(imageSections.map((s) => s.name)).toEqual(['image_1', 'image_2']);
    expect(imageSections.map((s) => s.options?.duration)).toEqual([4, 5]);
    // de-duplicated union of both shortlists
    expect(d.global?.allowedBackgrounds).toEqual([bg1.id, bg2.id]);
    // allowUpload true because at least one image section allows it
    expect(d.global?.allowUploadBackground).toBe(true);
  });

  it('emits allowUploadBackground:false when no image section allows uploads', () => {
    const d = buildDescriptor(baseState([{ kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 }]));

    expect(d.global?.allowUploadBackground).toBe(false);
  });

  it('leaves background globals off and emits no image_background when there is no image section', () => {
    const d = buildDescriptor(baseState([newSection('video')]));

    expect(d.global?.allowedBackgrounds).toBeUndefined();
    expect(d.global?.allowUploadBackground).toBeUndefined();
    expect(d.sections?.some((s) => s.type === 'image_background')).toBe(false);
  });
});

describe('templateEditorModel — round-trips', () => {
  it('round-trips a music section through a stored template', () => {
    const start = baseState([
      newSection('video'),
      { kind: 'music', allowed: [music1.id, music2.id], allowUpload: true },
    ]);
    const back = toEditorState(asTemplate(start));

    const music = back.sections.find((s) => s.kind === 'music');

    expect(music).toEqual({ kind: 'music', allowed: [music1.id, music2.id], allowUpload: true });
    // music is surfaced at the top of the section list
    expect(back.sections[0].kind).toBe('music');
  });

  it('round-trips an image section (descriptor section + duration + globals)', () => {
    const start = baseState([{ kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 7 }]);
    const back = toEditorState(asTemplate(start));

    const image = back.sections.find((s) => s.kind === 'image');

    expect(image).toEqual({ kind: 'image', allowed: [bg1.id, bg2.id], allowUpload: true, duration: 7 });
  });

  it('reconstructs image sections at their descriptor position, music at the top', () => {
    const start = baseState([
      newSection('video'),
      { kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 },
      { kind: 'music', allowed: [music1.id], allowUpload: false },
    ]);
    const back = toEditorState(asTemplate(start));

    expect(back.sections.map((s) => s.kind)).toEqual(['music', 'video', 'image']);
  });

  it('round-trips multiple image sections preserving their durations', () => {
    const start = baseState([
      { kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 3 },
      { kind: 'image', allowed: [bg2.id], allowUpload: true, duration: 9 },
    ]);
    const back = toEditorState(asTemplate(start));

    const images = back.sections.filter((s): s is Extract<EditorSection, { kind: 'image' }> => s.kind === 'image');

    expect(images.map((s) => s.duration)).toEqual([3, 9]);
    // both image sections share the de-duplicated global shortlist + allowUpload
    for (const img of images) {
      expect(img.allowed).toEqual([bg1.id, bg2.id]);
      expect(img.allowUpload).toBe(true);
    }
  });

  it('reconstructs an image section from a legacy stored image_background', () => {
    const legacyDescriptor = {
      global: {
        orientation: 'landscape' as const,
        musicEnabled: false,
        allowedBackgrounds: [bg1.id],
        allowUploadBackground: false,
      },
      sections: [
        { name: 'video_1', type: 'project_video' as const, options: { duration: 8 } },
        {
          name: 'image_1',
          type: 'image_background' as const,
          options: { duration: 4, pictureUrl: '/backgrounds/forest-sea.jpg' },
        },
      ],
    };
    const template: Template = {
      id: 'legacy-1',
      name: 'Legacy',
      description: '',
      orientation: 'landscape',
      hasForm: false,
      complexity: 'simple',
      source: 'user',
      descriptor: legacyDescriptor,
    };
    const state = toEditorState(template);

    expect(state.sections.some((s) => s.kind === 'video')).toBe(true);
    const image = state.sections.find((s) => s.kind === 'image');

    expect(image).toEqual({ kind: 'image', allowed: [bg1.id], allowUpload: false, duration: 4 });
  });

  it('toEditorState returns a single blank video section for a null template', () => {
    const state = toEditorState(null);

    expect(state.sections).toHaveLength(1);
    expect(state.sections[0].kind).toBe('video');
    expect(state.sections.some((s) => s.kind === 'music')).toBe(false);
    expect(state.sections.some((s) => s.kind === 'image')).toBe(false);
  });
});

describe('templateEditorModel — newSection/newOverlay defaults', () => {
  it('newSection(video) starts with no overlays', () => {
    expect(newSection('video')).toEqual({
      kind: 'video',
      duration: 8,
      mute: false,
      overlays: [],
      countdown: false,
      countdownSeconds: 4,
    });
  });

  it('newOverlay() is a centered, white, box-less overlay on the default font', () => {
    expect(newOverlay()).toEqual({
      text: '',
      x: 0.5,
      y: 0.5,
      fontsize: 48,
      fontcolor: '#ffffff',
      font: 'rubik',
      box: false,
      boxcolor: '#000000',
      boxOpacity: 0.5,
    });
  });
});

describe('templateEditorModel — video overlays → drawtext filters', () => {
  it('writes the centered fractions into drawtext x/y at the default position', () => {
    const values = drawtextValues(baseState([videoSection([overlay({ text: 'Hello' })])]));

    expect(values?.x).toBe('(w-text_w)*0.5');
    expect(values?.y).toBe('(h-text_h)*0.5');
  });

  it('feeds custom x/y and font styling into the drawtext values', () => {
    const o = overlay({ text: 'Hello', x: 0.25, y: 0.8, fontsize: 64, fontcolor: '#ff0000' });
    const values = drawtextValues(baseState([videoSection([o])]));

    expect(values).toMatchObject({
      text: { en: 'Hello' },
      fontsize: 64,
      fontcolor: '#ff0000',
      fontfile: 'Rubik.ttf',
      x: '(w-text_w)*0.25',
      y: '(h-text_h)*0.8',
    });
  });

  it('rounds the fractions to 3 decimals and clamps them to [0, 1]', () => {
    const values = drawtextValues(baseState([videoSection([overlay({ text: 'Hi', x: 0.123456, y: 1.5 })])]));

    expect(values?.x).toBe('(w-text_w)*0.123');
    expect(values?.y).toBe('(h-text_h)*1');
  });

  it('emits box/boxcolor/boxborderw only when the overlay opts into a box', () => {
    const boxed = drawtextValues(
      baseState([videoSection([overlay({ text: 'Boxed', box: true, boxcolor: '#112233' })])])
    );

    expect(boxed).toMatchObject({ box: 1, boxcolor: '#112233@0.5', boxborderw: 12 });

    const plain = drawtextValues(baseState([videoSection([overlay({ text: 'Plain', box: false })])]));

    expect(plain).not.toHaveProperty('box');
    expect(plain).not.toHaveProperty('boxcolor');
    expect(plain).not.toHaveProperty('boxborderw');
  });

  it('emits one drawtext filter per non-empty overlay, in order', () => {
    const filters = drawtextFilters(
      baseState([videoSection([overlay({ text: 'First', x: 0.1 }), overlay({ text: 'Second', x: 0.9 })])])
    );

    expect(filters).toHaveLength(2);
    expect(filters[0]).toMatchObject({ text: { en: 'First' }, x: '(w-text_w)*0.1' });
    expect(filters[1]).toMatchObject({ text: { en: 'Second' }, x: '(w-text_w)*0.9' });
  });

  it('skips overlays whose text is blank but keeps the non-empty ones', () => {
    const filters = drawtextFilters(
      baseState([videoSection([overlay({ text: 'Keep' }), overlay({ text: '   ' }), overlay({ text: 'Me' })])])
    );

    expect(filters).toHaveLength(2);
    expect(filters.map((f) => (f.text as { en: string }).en)).toEqual(['Keep', 'Me']);
  });

  it('emits no filters when there are no overlays or all are empty', () => {
    const none = buildDescriptor(baseState([videoSection([])]));

    expect(none.sections?.find((s) => s.type === 'project_video')?.filters).toBeUndefined();

    const allEmpty = buildDescriptor(baseState([videoSection([overlay({ text: '' }), overlay({ text: '  ' })])]));

    expect(allEmpty.sections?.find((s) => s.type === 'project_video')?.filters).toBeUndefined();
  });
});

describe('templateEditorModel — video overlays round-trip', () => {
  it('round-trips multiple overlays (text, position, font, box) through a stored template', () => {
    const overlays = [
      overlay({ text: 'Title', x: 0.25, y: 0.75, fontsize: 64, fontcolor: '#ff0000' }),
      overlay({ text: 'Subtitle', x: 0.5, y: 0.9, box: true, boxcolor: '#102030' }),
    ];
    const back = toEditorState(asTemplate(baseState([videoSection(overlays)])));
    const video = back.sections.find((s) => s.kind === 'video') as Extract<EditorSection, { kind: 'video' }>;

    expect(video.overlays).toEqual(overlays);
  });

  it('reconstructs a single overlay from a legacy single-drawtext section', () => {
    const legacy: Template = {
      id: 'legacy-dt',
      name: 'Legacy',
      description: '',
      orientation: 'landscape',
      hasForm: false,
      complexity: 'simple',
      source: 'user',
      descriptor: {
        global: { orientation: 'landscape', musicEnabled: false },
        sections: [
          {
            name: 'video_1',
            type: 'project_video',
            options: { duration: 8 },
            filters: [
              {
                type: 'drawtext',
                values: {
                  text: { en: 'Legacy' },
                  fontsize: 48,
                  fontcolor: '#ffffff',
                  fontfile: 'Rubik.ttf',
                  x: '(w-text_w)*0.5',
                  y: '(h-text_h)*0.5',
                },
              },
            ],
          },
        ],
      },
    };
    const video = toEditorState(legacy).sections.find((s) => s.kind === 'video') as Extract<
      EditorSection,
      { kind: 'video' }
    >;

    expect(video.overlays).toHaveLength(1);
    expect(video.overlays[0]).toMatchObject({ text: 'Legacy', x: 0.5, y: 0.5, box: false });
  });

  it('a video section with no drawtext filters round-trips to empty overlays', () => {
    const back = toEditorState(asTemplate(baseState([videoSection([])])));
    const video = back.sections.find((s) => s.kind === 'video') as Extract<EditorSection, { kind: 'video' }>;

    expect(video.overlays).toEqual([]);
  });
});

describe('templateEditorModel — parseFraction', () => {
  it('extracts the multiplier from a (w-text_w)*<frac> expression', () => {
    expect(parseFraction('(w-text_w)*0.25')).toBe(0.25);
    expect(parseFraction('(h-text_h)*0.8')).toBe(0.8);
  });

  it('defaults to 0.5 for the legacy centered /2 form', () => {
    expect(parseFraction('(w-text_w)/2')).toBe(0.5);
    expect(parseFraction('(h-text_h)/2')).toBe(0.5);
  });

  it('defaults to 0.5 for undefined, numeric, or unparseable values', () => {
    expect(parseFraction()).toBe(0.5);
    expect(parseFraction(120)).toBe(0.5);
    expect(parseFraction('center')).toBe(0.5);
  });

  it('clamps parsed fractions to [0, 1]', () => {
    expect(parseFraction('(w-text_w)*1.5')).toBe(1);
    expect(parseFraction('(w-text_w)*0')).toBe(0);
  });
});

describe('templateEditorModel — box opacity', () => {
  it('emits the box opacity into boxcolor', () => {
    const d = buildDescriptor(
      baseState({
        sections: [
          {
            kind: 'video',
            duration: 5,
            mute: false,
            countdown: false,
            countdownSeconds: 4,
            overlays: [
              {
                text: 'Hi',
                x: 0.5,
                y: 0.5,
                fontsize: 48,
                fontcolor: '#fff',
                box: true,
                boxcolor: '#000000',
                boxOpacity: 0.3,
                font: 'rubik',
              },
            ],
          },
        ],
      })
    );

    expect((d.sections?.[0].filters ?? [])[0].values?.boxcolor).toBe('#000000@0.3');
  });

  it('round-trips box opacity', () => {
    const start = baseState({
      sections: [
        {
          kind: 'video',
          duration: 5,
          mute: false,
          countdown: false,
          countdownSeconds: 4,
          overlays: [
            {
              text: 'Hi',
              x: 0.5,
              y: 0.5,
              fontsize: 48,
              fontcolor: '#fff',
              box: true,
              boxcolor: '#000000',
              boxOpacity: 0.3,
              font: 'rubik',
            },
          ],
        },
      ],
    });
    const back = toEditorState(asTemplate(start)).sections.find((s) => s.kind === 'video');

    expect((back as { overlays: { boxOpacity: number }[] }).overlays[0].boxOpacity).toBeCloseTo(0.3);
  });
});

describe('templateEditorModel — per-overlay font + global variables', () => {
  it('emits the chosen fontfile per overlay', () => {
    const d = buildDescriptor(
      baseState({
        sections: [
          {
            kind: 'video',
            duration: 5,
            mute: false,
            countdown: false,
            countdownSeconds: 4,
            overlays: [
              {
                text: 'Hi',
                x: 0.5,
                y: 0.5,
                fontsize: 48,
                fontcolor: '#fff',
                box: false,
                boxcolor: '#000',
                boxOpacity: 0.5,
                font: 'oswald',
              },
            ],
          },
        ],
      })
    );

    expect((d.sections?.[0].filters ?? [])[0].values?.fontfile).toBe('Oswald.ttf');
  });

  it('round-trips overlay font', () => {
    const start = baseState({
      sections: [
        {
          kind: 'video',
          duration: 5,
          mute: false,
          countdown: false,
          countdownSeconds: 4,
          overlays: [
            {
              text: 'Hi',
              x: 0.5,
              y: 0.5,
              fontsize: 48,
              fontcolor: '#fff',
              box: false,
              boxcolor: '#000',
              boxOpacity: 0.5,
              font: 'pacifico',
            },
          ],
        },
      ],
    });
    const back = toEditorState(asTemplate(start)).sections.find((s) => s.kind === 'video');

    expect((back as { overlays: { font: string }[] }).overlays[0].font).toBe('pacifico');
  });

  it('writes author global variables into global.variables', () => {
    const d = buildDescriptor(baseState({ globalVariables: [{ name: 'brand', value: 'LeClap' }] }));

    expect(d.global?.variables?.brand).toBe('LeClap');
  });

  it('round-trips global variables', () => {
    const start = baseState({ globalVariables: [{ name: 'brand', value: 'LeClap' }] });

    expect(toEditorState(asTemplate(start)).globalVariables).toContainEqual({ name: 'brand', value: 'LeClap' });
  });

  it('collectVariables unions form fields and global vars', () => {
    const s = baseState({
      globalVariables: [{ name: 'brand', value: 'X' }],
      sections: [{ kind: 'form', fields: [{ name: 'firstname', label: 'First', maxLength: 40 }] }],
    });

    expect(collectVariables(s)).toEqual(expect.arrayContaining(['firstname', 'brand']));
  });
});
