import { Layers, FileText, Music, Braces, SlidersHorizontal, type LucideIcon } from '@/presentation/components/icons';

export type EditorToolId = 'scenes' | 'basics' | 'audio' | 'variables' | 'advanced';

export interface EditorTool {
  id: EditorToolId;
  icon: LucideIcon;
  labelKey: string; // i18n key under the `admin` namespace
}

const BASE: EditorTool[] = [
  { id: 'scenes', icon: Layers, labelKey: 'shell.scenes' },
  { id: 'basics', icon: FileText, labelKey: 'shell.basics' },
  { id: 'audio', icon: Music, labelKey: 'shell.audio' },
];

const ADVANCED: EditorTool[] = [
  { id: 'variables', icon: Braces, labelKey: 'shell.variables' },
  { id: 'advanced', icon: SlidersHorizontal, labelKey: 'shell.advanced' },
];

// The dock's tools. scenes + basics + audio are always present; variables and the advanced panel
// appear only when the editor is in "advanced" mode (matching the existing Simple/Advanced toggle).
export const buildEditorTools = ({ advanced }: { advanced: boolean }): EditorTool[] =>
  advanced ? [...BASE, ...ADVANCED] : BASE;
