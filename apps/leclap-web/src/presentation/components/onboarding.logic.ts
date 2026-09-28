// The onboarding dialog's rules, kept pure so they unit-test without a DOM: which steps close on a click
// beside the panel or on Escape, and where keyboard focus goes once the camera or the file picker hands it
// back.
import type { OnboardingStep } from '@/hooks/useOnboardingCompile';

/** Where the intro clip came from: the camera, or a file the visitor imported. */
export type ClipSource = 'camera' | 'file';

/**
 * A click on the backdrop skips the intro only while nothing is at stake yet: a stray click must not tear
 * down a render in flight, nor the finished video or the error the visitor is reading.
 */
export const closesOnBackdrop = (step: OnboardingStep): boolean => step === 'welcome' || step === 'create';

/**
 * Escape is a deliberate key press, so it closes every step, like the close button, except the render
 * itself: stopping one is the Stop button's job, not a key that might have been meant for something else.
 */
export const closesOnEscape = (step: OnboardingStep): boolean => step !== 'compiling';

export type FocusAfterClip = 'keep' | 'create' | 'trigger';

/**
 * The camera and the file picker take focus away, and the control that had it may be gone once a clip
 * replaces the choice. Focus still in the dialog stays put; otherwise it goes to the next thing to do,
 * Create, when there is a clip, or back to the control that opened the camera when none came back.
 */
export const focusAfterClipPicked = ({
  focusInDialog,
  hasClip,
}: {
  focusInDialog: boolean;
  hasClip: boolean;
}): FocusAfterClip => {
  if (focusInDialog) return 'keep';

  if (hasClip) return 'create';

  return 'trigger';
};
