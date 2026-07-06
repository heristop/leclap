import { newSection, type EditorSection } from '../templateEditorModel';

// True while the timeline is still the untouched cold-start default: exactly one section that is
// byte-for-byte the video-section factory output (toEditorState(null) seeds precisely that). Any edit —
// a second scene, an overlay, a duration tweak — flips it false. Drives the "add your first scene /
// browse starter templates" hint in the scene lane.
export function isPristineTimeline(sections: EditorSection[]): boolean {
  if (sections.length !== 1) return false;

  if (sections[0].kind !== 'video') return false;

  return JSON.stringify(sections[0]) === JSON.stringify(newSection('video'));
}
