import { type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { SectionFields } from '../editor/SectionFields';
import { EDITOR_INPUT_CLASS } from '../editor/editorStyles';
import type { AvailablePartial } from '@/services/templatePartialService';
import { collectVariables, SECTION_LABELS, type EditorSection, type EditorState } from '../templateEditorModel';
import type { PartialToolId } from './usePartialEditorState';
import { addableKinds } from './AddElementMenu';
import { ElementBlock } from './ElementBlock';
import type { ElementRef, SectionSelectionState } from './useSectionSelection';

// True when the section owns any addable visual element, so the left panel hosts the unified Add menu
// + element list + inspector below the section-level fields.
const hasElements = (section: EditorSection): boolean => addableKinds(section).length > 0;

interface PartialPanelSwitchProps {
  activeTool: PartialToolId;
  state: EditorState;
  section: EditorSection | null;
  partials: AvailablePartial[];
  readonly: boolean;
  idLocked: boolean;
  patch: (p: Partial<EditorState>) => void;
  patchSection: (p: Partial<EditorSection>) => void;
  selection: SectionSelectionState;
  onSelectElement: (ref: ElementRef | null) => void;
}

// A panel shell mirroring EditorPanelSwitch's PanelFrame: eyebrow + title over a swap-animated body.
const PanelFrame = ({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) => (
  <div className="flex min-h-0 flex-1 flex-col">
    <header className="border-b border-brand-500/20 bg-brand-500/10 px-4 py-3">
      <span className="block text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-brand-600 dark:text-brand-300">
        {eyebrow}
      </span>
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
    </header>
    <div className="panel-swap min-h-0 flex-1 overflow-y-auto p-4 motion-reduce:animate-none">{children}</div>
  </div>
);

const PanelPlaceholder = ({ message }: { message: string }) => (
  <p className="text-sm text-muted-foreground">{message}</p>
);

// The partial editor's panel body. scenes → the selected section's fields (read-only partials see a
// hint); basics → the partial id + description inputs (id disabled when locked, like PartialsEditor).
export const PartialPanelSwitch = ({
  activeTool,
  state,
  section,
  partials,
  readonly,
  idLocked,
  patch,
  patchSection,
  selection,
  onSelectElement,
}: PartialPanelSwitchProps) => {
  const { t } = useTranslation('admin');

  if (activeTool === 'scenes') {
    if (!section) {
      return (
        <PanelFrame eyebrow={t('shell.tools')} title={t('shell.scenes')}>
          <PanelPlaceholder message={t('shell.monitorEmpty')} />
        </PanelFrame>
      );
    }

    if (readonly) {
      return (
        <PanelFrame eyebrow={t('shell.scenes')} title={SECTION_LABELS[section.kind]}>
          <PanelPlaceholder message={t('shell.partialBuiltin')} />
        </PanelFrame>
      );
    }

    return (
      <PanelFrame eyebrow={t('shell.scenes')} title={SECTION_LABELS[section.kind]}>
        <SectionFields
          section={section}
          orientation={state.orientation}
          variables={collectVariables(state)}
          partials={partials}
          onChange={patchSection}
          inputCls={EDITOR_INPUT_CLASS}
        />
        {hasElements(section) && (
          <ElementBlock
            state={state}
            section={section}
            selection={selection}
            patchSection={patchSection}
            onSelectElement={onSelectElement}
          />
        )}
      </PanelFrame>
    );
  }

  return (
    <PanelFrame eyebrow={t('shell.tools')} title={t('shell.basics')}>
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('shell.partialNameLabel')}
          </label>
          <input
            aria-label={t('shell.partialNameLabel')}
            className={EDITOR_INPUT_CLASS}
            value={state.id}
            disabled={idLocked || readonly}
            placeholder="local:intro"
            onChange={(e) => {
              patch({ id: e.target.value, name: e.target.value });
            }}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            {t('shell.partialDescription')}
          </label>
          <input
            aria-label={t('shell.partialDescription')}
            className={EDITOR_INPUT_CLASS}
            value={state.description}
            disabled={readonly}
            placeholder="Reusable intro"
            onChange={(e) => {
              patch({ description: e.target.value });
            }}
          />
        </div>
      </div>
    </PanelFrame>
  );
};
