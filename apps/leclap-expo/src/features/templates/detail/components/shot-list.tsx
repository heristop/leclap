import { View } from 'react-native';
import type { Section, Project } from '@/src/types';
import { FilmstripEdge } from '@/src/components/kinetic/filmstrip-edge';
import { ShotRow } from '@/src/features/templates/detail/components/shot-row';
import { MediaStepRow } from '@/src/features/templates/detail/components/media-step-row';
import { styles } from '@/src/features/templates/detail/detail.styles';

interface ShotListProps {
  sections: Section[];
  project: Project;
  vars: Record<string, string | string[]>;
  hasMediaStep: boolean;
  mediaStepDone: boolean;
  onSectionPress: (s: Section) => void;
  onPreview: (s: Section) => void;
  onMediaPress: () => void;
}

// The shot list as an edit timeline: a filmstrip spine threads the rows, each keyframe status dot
// riding the spine. The media step is the last frame.
export function ShotList({
  sections,
  project,
  vars,
  hasMediaStep,
  mediaStepDone,
  onSectionPress,
  onPreview,
  onMediaPress,
}: ShotListProps) {
  return (
    <View style={styles.shotList}>
      <FilmstripEdge style={styles.filmstrip} />
      {sections.map((section, i) => (
        <ShotRow
          key={section.name}
          section={section}
          project={project}
          index={i + 1}
          vars={vars}
          onPress={() => {
            onSectionPress(section);
          }}
          onPreview={() => {
            onPreview(section);
          }}
        />
      ))}
      {hasMediaStep ? <MediaStepRow index={sections.length + 1} done={mediaStepDone} onPress={onMediaPress} /> : null}
    </View>
  );
}

export default ShotList;
