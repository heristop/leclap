// Ready-made EditorState skeletons so authors start from a real structure instead of a blank video.
// Pure data + model factories only (no React, no web-only imports) so the Expo app can reuse them.
// Each preset's `build()` returns a fresh, saveable EditorState (fresh id, a name, several sections).
import {
  newSection,
  makeTemplateId,
  DEFAULT_AUDIO_MIX,
  DEFAULT_TRANSITION,
  type EditorState,
  type EditorSection,
} from './model';

export interface StarterPreset {
  id: string;
  nameKey: string; // i18n key under the `admin` namespace (presets.items.<id>.name)
  descriptionKey: string;
  accent: string; // swatch colour for the picker card
  // The scene kinds build() will create, in order — a cheap structural summary for picker cards so
  // they never have to call build() (which mints a fresh template id) just to render icons.
  scenes: Array<EditorSection['kind']>;
  build: () => EditorState;
}

// Base state matching toEditorState(null), minus the single default section — presets supply their own.
function baseState(name: string): Omit<EditorState, 'sections'> {
  return {
    id: makeTemplateId(),
    name,
    description: '',
    orientation: 'landscape',
    globalVariables: [],
    audio: { ...DEFAULT_AUDIO_MIX },
    defaultTransition: { ...DEFAULT_TRANSITION },
    globalAnimations: [],
    globalOverlays: [],
  };
}

const fade = { type: 'fade', duration: 0.5 } as const;

// Speech-ducking on by default so music dips under narration — a fresh preset sounds finished, not raw.
const ducking = { threshold: 0.05, ratio: 8, attack: 20, release: 400 } as const;

// Narrowing factory helpers: start from newSection(kind) then layer preset-specific fields on. Casting
// through the discriminated union keeps this terse while staying type-checked at each field.
function colorSection(over: Partial<Extract<EditorSection, { kind: 'color' }>>): EditorSection {
  return {
    ...(newSection('color') as Extract<EditorSection, { kind: 'color' }>),
    ...over,
  };
}

function videoSection(over: Partial<Extract<EditorSection, { kind: 'video' }>>): EditorSection {
  return {
    ...(newSection('video') as Extract<EditorSection, { kind: 'video' }>),
    ...over,
  };
}

function imageSection(over: Partial<Extract<EditorSection, { kind: 'image' }>>): EditorSection {
  return {
    ...(newSection('image') as Extract<EditorSection, { kind: 'image' }>),
    ...over,
  };
}

function musicSection(): EditorSection {
  return {
    ...(newSection('music') as Extract<EditorSection, { kind: 'music' }>),
    // allowUpload so the scene passes the save guard (a media scene with no library + no upload can't save).
    allowUpload: true,
  };
}

export const STARTER_PRESETS: StarterPreset[] = [
  {
    id: 'talking-head',
    nameKey: 'presets.items.talking-head.name',
    descriptionKey: 'presets.items.talking-head.description',
    accent: '#7C83FD',
    scenes: ['color', 'video', 'color'],
    build: () => ({
      ...baseState('Talking-head intro'),
      audio: { ...DEFAULT_AUDIO_MIX, ducking },
      defaultTransition: { ...fade },
      sections: [
        colorSection({
          color: '#0E1116',
          duration: 3,
          transitionAfter: { ...fade },
          titleCard: {
            kicker: { en: 'Introducing' },
            headline: { en: 'Your headline here' },
            subtitle: { en: 'A short supporting line' },
            accent: '#7C83FD',
            reveal: { type: 'rise' },
          },
        }),
        videoSection({
          duration: 8,
          transitionAfter: { ...fade },
          look: 'cinematic',
          grade: { curvesPreset: 'increase_contrast' },
        }),
        colorSection({
          color: '#0E1116',
          duration: 3,
          titleCard: { headline: { en: 'Thanks for watching' }, accent: '#7C83FD' },
        }),
      ],
    }),
  },
  {
    id: 'product-showcase',
    nameKey: 'presets.items.product-showcase.name',
    descriptionKey: 'presets.items.product-showcase.description',
    accent: '#FF7AC6',
    scenes: ['image', 'video', 'music'],
    build: () => ({
      ...baseState('Product showcase'),
      audio: { ...DEFAULT_AUDIO_MIX, ducking },
      defaultTransition: { ...fade },
      sections: [
        imageSection({
          allowUpload: true,
          duration: 4,
          transitionAfter: { ...fade },
          motion: [{ type: 'kenburns', direction: 'in', intensity: 1.15 }],
          grade: { colorBalance: { highlights: { r: 0.05 } }, curvesPreset: 'increase_contrast' },
          caption: { text: 'Introducing our latest product', style: 'bold', position: 'bottom' },
        }),
        videoSection({
          duration: 8,
          transitionAfter: { ...fade },
          look: 'vivid-pop',
          lowerThird: {
            title: { en: 'Product name' },
            badge: { en: '$99' },
            accent: '#FF7AC6',
            reveal: { type: 'rise' },
          },
        }),
        musicSection(),
      ],
    }),
  },
  {
    id: 'testimonial',
    nameKey: 'presets.items.testimonial.name',
    descriptionKey: 'presets.items.testimonial.description',
    accent: '#FDE047',
    scenes: ['video', 'color'],
    build: () => ({
      ...baseState('Testimonial'),
      audio: { ...DEFAULT_AUDIO_MIX, ducking },
      defaultTransition: { ...fade },
      sections: [
        videoSection({
          duration: 10,
          transitionAfter: { ...fade },
          look: 'warm-film',
          grade: { curvesPreset: 'medium_contrast' },
          lowerThird: {
            title: { en: 'Jane Doe' },
            subtitle: { en: 'Happy customer' },
            accent: '#FDE047',
            reveal: { type: 'rise' },
          },
          // Centered so the quote never collides with the lower-third band at the bottom.
          caption: {
            text: '“This changed everything for our team.”',
            style: 'subtle',
            position: 'center',
          },
        }),
        colorSection({
          color: '#0E1116',
          duration: 3,
          titleCard: { headline: { en: 'Join thousands of happy customers' }, accent: '#FDE047' },
        }),
      ],
    }),
  },
];
