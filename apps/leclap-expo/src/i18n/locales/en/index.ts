// English resource bundle. Each namespace is one JSON file; add new namespaces
// here so they are registered with i18next and picked up by the typed-key
// augmentation in src/types/react-i18next.d.ts.
import common from './common.json';
import header from './header.json';
import templates from './templates.json';
import projects from './projects.json';
import editor from './editor.json';
import recording from './recording.json';
import preview from './preview.json';
import queue from './queue.json';
import permissions from './permissions.json';
import alerts from './alerts.json';
import detail from './detail.json';

export const en = {
  common,
  header,
  templates,
  projects,
  editor,
  recording,
  preview,
  queue,
  permissions,
  alerts,
  detail,
} as const;

export type Resources = typeof en;
