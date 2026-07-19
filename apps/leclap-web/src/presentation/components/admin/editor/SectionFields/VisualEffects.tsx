// The shared look + grade + letterbox block rendered inside the "Effects" disclosure of every visual
// section card (video / color / image). LookGallery writes `look`; GradePanel writes `grade`;
// LetterboxField writes `letterbox` (effects-pack cinemascope bars). Animation lives in its own
// sibling disclosure (AnimationGallery), not here.
import type { Grade, Letterbox } from '../../templateEditorModel';
import { LookGallery } from '../LookGallery';
import { GradePanel } from '../GradePanel';
import { LetterboxField } from './LetterboxField';

interface VisualEffectsProps {
  look: string | undefined;
  grade: Grade | undefined;
  letterbox: Letterbox | undefined;
  onLook: (look: string | undefined) => void;
  onGrade: (grade: Grade | undefined) => void;
  onLetterbox: (letterbox: Letterbox | undefined) => void;
}

export const VisualEffects = ({ look, grade, letterbox, onLook, onGrade, onLetterbox }: VisualEffectsProps) => (
  <div className="space-y-3">
    <LookGallery look={look} onChange={onLook} />
    <GradePanel grade={grade} onChange={onGrade} />
    <LetterboxField letterbox={letterbox} onChange={onLetterbox} />
  </div>
);
