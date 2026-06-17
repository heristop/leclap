// The shared look + grade block rendered inside the "Effects" disclosure of every visual section card
// (video / color / image). LookGallery writes `look`; GradePanel writes `grade`. Animation lives in
// its own sibling disclosure (AnimationGallery), not here.
import type { Grade } from '../../templateEditorModel';
import { LookGallery } from '../LookGallery';
import { GradePanel } from '../GradePanel';

interface VisualEffectsProps {
  look: string | undefined;
  grade: Grade | undefined;
  onLook: (look: string | undefined) => void;
  onGrade: (grade: Grade | undefined) => void;
}

export const VisualEffects = ({ look, grade, onLook, onGrade }: VisualEffectsProps) => (
  <div className="space-y-3">
    <LookGallery look={look} onChange={onLook} />
    <GradePanel grade={grade} onChange={onGrade} />
  </div>
);
