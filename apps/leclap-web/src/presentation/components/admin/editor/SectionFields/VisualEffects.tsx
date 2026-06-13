// The shared look + grade block rendered inside every visual section card (video /
// color / image). LookGallery writes `look`; GradePanel writes `grade`. Both go through
// the same section patch so the card owns no extra state.
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
