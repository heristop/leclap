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
