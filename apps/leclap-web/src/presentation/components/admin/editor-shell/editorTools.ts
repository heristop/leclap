import type { ComponentType } from 'react';
import { Music, Hash } from '@/presentation/components/icons';
import { LayersIcon } from '@/presentation/components/icons/layers';
import { FileTextIcon } from '@/presentation/components/icons/file-text';
import { SlidersHorizontalIcon } from '@/presentation/components/icons/sliders-horizontal';

export type EditorToolId = 'scenes' | 'basics' | 'audio' | 'variables' | 'advanced';

export interface EditorTool {
  id: EditorToolId;
  icon: ComponentType<{ className?: string }>;
  labelKey: string; // i18n key under the `admin` namespace
}

const BASE: EditorTool[] = [
  { id: 'scenes', icon: LayersIcon, labelKey: 'shell.scenes' },
  { id: 'basics', icon: FileTextIcon, labelKey: 'shell.basics' },
  { id: 'audio', icon: Music, labelKey: 'shell.audio' },
];

const ADVANCED: EditorTool[] = [
  { id: 'variables', icon: Hash, labelKey: 'shell.variables' },
  { id: 'advanced', icon: SlidersHorizontalIcon, labelKey: 'shell.advanced' },
];

// The dock's tools. scenes + basics + audio are always present; variables and the advanced panel
// appear only when the editor is in "advanced" mode (matching the existing Simple/Advanced toggle).
export const buildEditorTools = ({ advanced }: { advanced: boolean }): EditorTool[] =>
  advanced ? [...BASE, ...ADVANCED] : BASE;

// The tool one step after `current` in `tools`, wrapping at the end. Used by the `]` shortcut.
export const nextTool = (tools: EditorTool[], current: EditorToolId): EditorToolId => {
  const at = tools.findIndex((tool) => tool.id === current);
  const next = at < 0 || at >= tools.length - 1 ? 0 : at + 1;

  return tools[next].id;
};

// The tool one step before `current`, wrapping at the start. Used by the `[` shortcut.
export const prevTool = (tools: EditorTool[], current: EditorToolId): EditorToolId => {
  const at = tools.findIndex((tool) => tool.id === current);
  const prev = at <= 0 ? tools.length - 1 : at - 1;

  return tools[prev].id;
};
