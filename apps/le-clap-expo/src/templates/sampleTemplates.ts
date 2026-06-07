import type { TemplateDescriptor } from '@/src/types';

/** A template in the local catalog — bundled sample, or a user-created one. */
export interface CatalogTemplate {
  id: string;
  name: string;
  description: string;
  orientation: 'landscape' | 'portrait';
  descriptor: TemplateDescriptor;
  source: 'sample' | 'user';
}

/**
 * Bundled sample templates so the catalog works fully offline (no server).
 * Shapes mirror the editor's `buildDescriptor` output so they round-trip in the editor.
 */
export const SAMPLE_TEMPLATES: CatalogTemplate[] = [
  {
    id: 'sample-simple-intro',
    name: 'Simple Intro',
    description: 'A single clip with a clean fade — the quickest way to start.',
    orientation: 'landscape',
    source: 'sample',
    descriptor: {
      global: { orientation: 'landscape', musicEnabled: false, transitionDuration: 0.5 },
      sections: [{ name: 'video_1', type: 'project_video', options: { duration: 8, muteSection: false } }],
    },
  },
  {
    id: 'sample-profile',
    name: 'Profile Video',
    description: 'Ask for a name, then overlay it on your clip — great for personal branding.',
    orientation: 'portrait',
    source: 'sample',
    descriptor: {
      global: { orientation: 'portrait', musicEnabled: true, transitionDuration: 0.5 },
      sections: [
        {
          name: 'form_1',
          type: 'form',
          options: { fields: [{ name: 'firstname', maxLength: 40, label: { en: 'Your name' } }] },
        },
        {
          name: 'video_1',
          type: 'project_video',
          options: { duration: 8, muteSection: false },
          filters: [
            {
              type: 'drawtext',
              values: {
                text: { en: '{{ firstname }}' },
                fontsize: 56,
                fontcolor: '#ffffff',
                fontfile: 'Rubik.ttf',
                x: '(w-text_w)/2',
                y: '(h-text_h)/2',
              },
            },
          ],
        },
      ],
    },
  },
  {
    id: 'sample-color-card',
    name: 'Title Card + Clip',
    description: 'Open on a brand-colored title card, then cut to your video.',
    orientation: 'landscape',
    source: 'sample',
    descriptor: {
      global: { orientation: 'landscape', musicEnabled: false, transitionDuration: 0.5 },
      sections: [
        { name: 'color_1', type: 'color_background', options: { duration: 3, backgroundColor: '#7C83FD' } },
        { name: 'video_1', type: 'project_video', options: { duration: 8, muteSection: false } },
      ],
    },
  },
];
