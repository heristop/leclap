// Per-kind section field dispatcher. Picks the matching field block and threads the
// section patch through; color sections also receive a dedicated layers setter so the
// LayersEditor writes through patchLayers in the parent.
import type { BackgroundLayer, EditorSection, EditorState } from '../../templateEditorModel';
import { VideoFields } from './VideoFields';
import { ColorFields } from './ColorFields';
import { ImageFields } from './ImageFields';
import { MusicFields } from './MusicFields';
import { FormFields } from './FormFields';

interface SectionFieldsProps {
  section: EditorSection;
  orientation: EditorState['orientation'];
  variables: string[];
  onChange: (p: Partial<EditorSection>) => void;
  onLayers: (layers: BackgroundLayer[]) => void;
  inputCls: string;
}

export const SectionFields = ({
  section,
  orientation,
  variables,
  onChange,
  onLayers,
  inputCls,
}: SectionFieldsProps) => {
  if (section.kind === 'video') {
    return (
      <VideoFields
        section={section}
        orientation={orientation}
        variables={variables}
        onChange={onChange}
        inputCls={inputCls}
      />
    );
  }

  if (section.kind === 'color') {
    return <ColorFields section={section} onChange={onChange} onLayers={onLayers} inputCls={inputCls} />;
  }

  if (section.kind === 'image') {
    return <ImageFields section={section} onChange={onChange} inputCls={inputCls} />;
  }

  if (section.kind === 'music') {
    return <MusicFields section={section} onChange={onChange} />;
  }

  return <FormFields section={section} onChange={onChange} inputCls={inputCls} />;
};
