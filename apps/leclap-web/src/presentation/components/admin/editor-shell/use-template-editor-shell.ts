// State hooks lifted out of TemplateEditorShell to keep the shell component itself thin: the live
// program monitor (playable timeline + rAF clock + play-mode bookkeeping) and template persistence
// (guard + projection + save). The shell composes these with the shared editor-state hooks.
import { useEffect, useMemo, useState } from 'react';
import type { TFunction } from 'i18next';
import { useReducedMotion } from 'motion/react';
import { templateService, type Template } from '@/services/templateService';
import { userTemplateService } from '@/services/userTemplateService';
import type { StoredTemplate } from '@/stores/userTemplateStore';
import { buildDescriptor, type EditorState } from '../templateEditorModel';
import { buildMasterTimeline } from './program-timeline.logic';
import { useProgramClock } from './use-program-clock';

// Save guard mirroring TemplateEditor's saveGuardError: name + at least one section + media-or-upload.
// Returns true when the template is NOT yet safe to save.
export function saveGuardFails(state: EditorState): boolean {
  if (state.name.trim() === '') return true;

  if (state.sections.length === 0) return true;

  const emptyMedia = state.sections.find(
    (s) => (s.kind === 'music' || s.kind === 'image') && s.allowed.length === 0 && !s.allowUpload
  );

  return Boolean(emptyMedia);
}

// Editor state -> persisted user Template (same projection as TemplateEditor.toUserTemplate).
function toUserTemplate(state: EditorState): Template {
  const descriptor = buildDescriptor(state);

  return {
    id: state.id,
    name: state.name.trim(),
    description: state.description.trim(),
    orientation: state.orientation,
    hasForm: templateService.extractFormFields(descriptor).length > 0,
    complexity: templateService.getTemplateComplexity(descriptor),
    source: 'user',
    descriptor,
  };
}

// The live program monitor's state: the visual scenes concatenated into one playable timeline driven
// by a rAF clock, plus play-mode bookkeeping (starting the clock enters play mode; exit pauses it).
export function useProgramMonitor(state: EditorState) {
  const reduced = useReducedMotion() ?? false;
  const playTimeline = useMemo(
    () => buildMasterTimeline(state.sections, state.defaultTransition),
    [state.sections, state.defaultTransition]
  );
  const playTotal = playTimeline.at(-1)?.end ?? 0;
  const clock = useProgramClock(playTotal, reduced);
  const [playMode, setPlayMode] = useState(false);

  useEffect(() => {
    if (clock.playing) setPlayMode(true);
  }, [clock.playing]);

  const exitPlayMode = (): void => {
    clock.pause();
    setPlayMode(false);
  };

  return { clock, playTimeline, playMode, exitPlayMode };
}

interface PersistenceArgs {
  state: EditorState;
  t: TFunction<'admin'>;
  onSaved: (saved: StoredTemplate) => void;
  onSaveAndCompile?: (saved: StoredTemplate) => void;
}

// Save/persist for the shell: guards, projects to a user Template, writes it, and surfaces a save
// error. Exposes the guard flag too, so the titlebar's disabled state and the save path share it.
export function useTemplatePersistence({ state, t, onSaved, onSaveAndCompile }: PersistenceArgs) {
  const [error, setError] = useState('');
  const guardFails = saveGuardFails(state);

  const persist = (): StoredTemplate | null => {
    if (saveGuardFails(state)) return null;
    setError('');

    try {
      return userTemplateService.save(toUserTemplate(state));
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : t('validation.saveFailed'));

      return null;
    }
  };

  const handleSave = (): void => {
    const saved = persist();

    if (saved) onSaved(saved);
  };

  const handleSaveAndCompile = (): void => {
    const saved = persist();

    if (saved) onSaveAndCompile?.(saved);
  };

  return { error, guardFails, handleSave, handleSaveAndCompile };
}
