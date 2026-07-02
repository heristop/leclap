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
import type { Resources } from '../en';

type LocaleShape<T> = { [K in keyof T]: T[K] extends string ? string : LocaleShape<T[K]> };

export const de = {
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
} satisfies LocaleShape<Resources>;
