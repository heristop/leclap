// The left inspector's per-kind dispatcher: given the section + the single shared selection, render the
// right SETTINGS control for the selected element (text / background layer / image / animation) by
// reusing the existing extracted controls. Array surgery for layer move/remove reuses sectionElements.
import { useTranslation } from 'react-i18next';
import type { TFunction } from 'i18next';
import type {
  EditorSection,
  TextOverlay,
  BackgroundLayer,
  ImageOverlay,
  AnimationOverlay,
  Orientation,
} from '../templateEditorModel';
import { SelectedControls } from './overlayControls';
import { LayerRow } from '../editor/LayerRow';
import { PlacementControls } from './placementControls';
import { removeElement, reorderElement } from './sectionElements';
import type { ElementRef } from './useSectionSelection';

interface ElementInspectorProps {
  section: EditorSection;
  activeRef: ElementRef | null;
  variables: string[];
  orientation: Orientation;
  onPatchSection: (patch: Partial<EditorSection>) => void;
  onSelectElement: (ref: ElementRef | null) => void;
}

// Immutable single-index patch shared by every array-backed kind.
function patchAt<T>(arr: T[], index: number, patch: Partial<T>): T[] {
  return arr.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

// Read a section's element array for a kind without `any`. The kind guards in the dispatcher ensure the
// element actually has the requested shape, so a localized cast at the read site is safe.
function readArray<T>(section: EditorSection, field: string): T[] {
  const value = (section as Record<string, unknown>)[field];

  if (!Array.isArray(value)) return [];

  return value as T[];
}

// Indexed access that honestly returns `T | undefined`, so the out-of-range guard at each call site is
// a real check the type-checker respects (the tsconfig does not enable noUncheckedIndexedAccess).
function elementAt<T>(arr: T[], index: number): T | undefined {
  return index >= 0 && index < arr.length ? arr[index] : undefined;
}

export const ElementInspector = ({
  section,
  activeRef,
  variables,
  orientation,
  onPatchSection,
  onSelectElement,
}: ElementInspectorProps) => {
  const { t } = useTranslation('admin');

  if (!activeRef) return <Hint label={t('element.selectHint')} />;

  if (activeRef.kind === 'text') {
    return (
      <TextSettings
        section={section}
        activeRef={activeRef}
        variables={variables}
        t={t}
        onPatchSection={onPatchSection}
        onSelectElement={onSelectElement}
      />
    );
  }

  if (activeRef.kind === 'layer') {
    return (
      <LayerSettings
        section={section}
        activeRef={activeRef}
        t={t}
        onPatchSection={onPatchSection}
        onSelectElement={onSelectElement}
      />
    );
  }

  if (activeRef.kind === 'image') {
    return (
      <ImageSettings
        section={section}
        activeRef={activeRef}
        orientation={orientation}
        t={t}
        onPatchSection={onPatchSection}
      />
    );
  }

  return (
    <AnimationSettings
      section={section}
      activeRef={activeRef}
      orientation={orientation}
      t={t}
      onPatchSection={onPatchSection}
    />
  );
};

interface TextSettingsProps {
  section: EditorSection;
  activeRef: ElementRef;
  variables: string[];
  t: TFunction<'admin'>;
  onPatchSection: (patch: Partial<EditorSection>) => void;
  onSelectElement: (ref: ElementRef | null) => void;
}

const TextSettings = ({ section, activeRef, variables, t, onPatchSection, onSelectElement }: TextSettingsProps) => {
  const overlays = readArray<TextOverlay>(section, 'overlays');
  const overlay = elementAt(overlays, activeRef.index);

  if (!overlay) return <Hint label={t('element.selectHint')} />;

  return (
    <SelectedControls
      overlay={overlay}
      t={t}
      variables={variables}
      onPatch={(patch) => {
        onPatchSection({ overlays: patchAt(overlays, activeRef.index, patch) } as Partial<EditorSection>);
      }}
      onInsertVariable={(name) => {
        const text = `${overlay.text}{{ ${name} }}`;
        onPatchSection({ overlays: patchAt(overlays, activeRef.index, { text }) } as Partial<EditorSection>);
      }}
      onDelete={() => {
        onSelectElement(null);
        onPatchSection(removeElement(section, activeRef));
      }}
    />
  );
};

interface LayerSettingsProps {
  section: EditorSection;
  activeRef: ElementRef;
  t: TFunction<'admin'>;
  onPatchSection: (patch: Partial<EditorSection>) => void;
  onSelectElement: (ref: ElementRef | null) => void;
}

const LayerSettings = ({ section, activeRef, t, onPatchSection, onSelectElement }: LayerSettingsProps) => {
  const layers = readArray<BackgroundLayer>(section, 'layers');
  const layer = elementAt(layers, activeRef.index);

  if (!layer) return <Hint label={t('element.selectHint')} />;

  return (
    <LayerRow
      layer={layer}
      index={activeRef.index}
      isBase={activeRef.index === 0}
      canMoveUp={activeRef.index > 0}
      canMoveDown={activeRef.index < layers.length - 1}
      onPatch={(patch) => {
        onPatchSection({ layers: patchAt(layers, activeRef.index, patch) } as Partial<EditorSection>);
      }}
      onMove={(delta) => {
        onPatchSection(reorderElement(section, activeRef, delta));
      }}
      onRemove={() => {
        onSelectElement(null);
        onPatchSection(removeElement(section, activeRef));
      }}
    />
  );
};

interface PlacementSettingsProps {
  section: EditorSection;
  activeRef: ElementRef;
  orientation: Orientation;
  t: TFunction<'admin'>;
  onPatchSection: (patch: Partial<EditorSection>) => void;
}

const ImageSettings = ({ section, activeRef, orientation, t, onPatchSection }: PlacementSettingsProps) => {
  const images = readArray<ImageOverlay>(section, 'images');
  const image = elementAt(images, activeRef.index);

  if (!image) return <Hint label={t('element.selectHint')} />;

  return (
    <PlacementControls
      kind="image"
      orientation={orientation}
      value={image}
      onChange={(patch) => {
        onPatchSection({ images: patchAt(images, activeRef.index, patch) } as Partial<EditorSection>);
      }}
    />
  );
};

const AnimationSettings = ({ section, activeRef, orientation, t, onPatchSection }: PlacementSettingsProps) => {
  const animations = readArray<AnimationOverlay>(section, 'animations');
  const animation = elementAt(animations, activeRef.index);

  if (!animation) return <Hint label={t('element.selectHint')} />;

  return (
    <PlacementControls
      kind="animation"
      orientation={orientation}
      value={animation}
      onChange={(patch) => {
        onPatchSection({ animations: patchAt(animations, activeRef.index, patch) } as Partial<EditorSection>);
      }}
    />
  );
};

// The muted "select an element" placeholder, mirroring OverlayInspector's hint styling.
const Hint = ({ label }: { label: string }) => <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>;
