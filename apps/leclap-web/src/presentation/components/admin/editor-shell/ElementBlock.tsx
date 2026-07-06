// The unified left-panel element block shared by both panel switches: the "+ Add" menu, the
// cross-kind element list, and the per-element settings inspector, all driven by the section's shared
// selection. Section-level fields render above this; this block owns every per-element editor.
import { useTranslation } from 'react-i18next';
import { collectVariables, type EditorSection, type EditorState } from '../templateEditorModel';
import { AddElementMenu } from './AddElementMenu';
import { ElementList } from './ElementList';
import { ElementInspector } from './ElementInspector';
import { addElement, listSectionElements, removeElement, reorderElement } from './sectionElements';
import type { ElementRef, SectionSelectionState } from './useSectionSelection';

interface ElementBlockProps {
  state: EditorState;
  section: EditorSection;
  selection: SectionSelectionState;
  patchSection: (p: Partial<EditorSection>) => void;
  onSelectElement: (ref: ElementRef | null) => void;
}

export const ElementBlock = ({ state, section, selection, patchSection, onSelectElement }: ElementBlockProps) => {
  const { t } = useTranslation('admin');

  return (
    <div className="mt-4 space-y-3 border-t border-foreground/10 pt-4">
      {/* One header row — list label left, "+ Add" right — mirroring OverlayInspector's header so
          the label and the action that feeds the list read as a single group. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-widest text-gray-400">{t('element.list')}</span>
        <AddElementMenu
          section={section}
          onAdd={(kind) => {
            // Orientation sizes/centres a fresh shape's raster box; other kinds ignore it.
            const added = addElement(section, kind, state.orientation);

            if (!added) return;

            patchSection(added.patch);
            onSelectElement(added.ref);
          }}
        />
      </div>
      <ElementList
        elements={listSectionElements(section)}
        activeRef={selection.element}
        onSelect={onSelectElement}
        onDelete={(ref) => {
          onSelectElement(null);
          patchSection(removeElement(section, ref));
        }}
        onMove={(ref, delta) => {
          patchSection(reorderElement(section, ref, delta));
        }}
      />
      <ElementInspector
        section={section}
        activeRef={selection.element}
        variables={collectVariables(state)}
        orientation={state.orientation}
        onPatchSection={patchSection}
        onSelectElement={onSelectElement}
      />
    </div>
  );
};
