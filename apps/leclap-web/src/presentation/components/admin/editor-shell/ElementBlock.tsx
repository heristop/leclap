// The unified left-panel element block shared by both panel switches: the "+ Add" menu, the
// cross-kind element list, and the per-element settings inspector, all driven by the section's shared
// selection. Section-level fields render above this; this block owns every per-element editor.
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

export const ElementBlock = ({ state, section, selection, patchSection, onSelectElement }: ElementBlockProps) => (
  <div className="mt-4 space-y-3 border-t border-foreground/10 pt-4">
    <AddElementMenu
      section={section}
      onAdd={(kind) => {
        const added = addElement(section, kind);

        if (!added) return;

        patchSection(added.patch);
        onSelectElement(added.ref);
      }}
    />
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
