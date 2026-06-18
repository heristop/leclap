import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CameraCapture } from '@/presentation/components/CameraCapture';
import { WelcomeStep, CreateStep, CompilingStep, DoneStep, ErrorStep } from '@/presentation/components/OnboardingSteps';
import { useOnboardingCompile } from '@/hooks/useOnboardingCompile';
import { useSampleTemplate } from '@/hooks/useSampleTemplate';
import { setHeroVideo } from '@/services/heroVideoStore';
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll';

// The onboarding makes a first video from a built-in template so newcomers see the whole flow
// (record → compile → download) in one guided pass. We match the template to how the app is actually
// shown — its live viewport shape — rather than the physical device: a viewport taller than it is
// wide (a phone upright, or a narrow / split / resized desktop window) gets Big Reveal (a 3·2·1
// countdown into the recorded clip with confetti + a headline); anything wider gets Spotlight (a
// cinematic intro + outro wrap), so the recorded clip fills the frame instead of being letter-boxed.
// Both record one clip; the name typed at the record step lands in the template's first form field.
const LANDSCAPE_TEMPLATE_ID = 'spotlight';
const PORTRAIT_TEMPLATE_ID = 'big-reveal';

// Reflect the app's actual viewport (window aspect) — not the device-orientation media query, which
// is always "landscape" on desktop regardless of how the window is sized.
const pickSampleTemplateId = (): string =>
  window.innerHeight > window.innerWidth ? PORTRAIT_TEMPLATE_ID : LANDSCAPE_TEMPLATE_ID;

// A friendly sample first name shown as the field's *placeholder* (not a prefilled value, so the user
// never has to clear it). If they skip typing, this same name is used so the title card is never empty.
const SAMPLE_FIRST_NAMES = ['Alex', 'Sam', 'Mia', 'Noah', 'Léa', 'Liam', 'Zoé', 'Ava', 'Theo', 'Nina'];

const randomFirstName = (): string => SAMPLE_FIRST_NAMES[Math.floor(Math.random() * SAMPLE_FIRST_NAMES.length)];

interface OnboardingProps {
  onDone: () => void;
}

export const Onboarding = ({ onDone }: OnboardingProps) => {
  const { t } = useTranslation('onboarding');
  const navigate = useNavigate();
  const [name, setName] = useState('');
  // Picked once when the modal opens: shown as the field's placeholder and used as the title fallback.
  const [placeholderName] = useState(randomFirstName);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [showCamera, setShowCamera] = useState(false);
  // Chosen once when the modal opens so a mid-flow rotation can't swap the template underfoot.
  const [sampleTemplateId] = useState(pickSampleTemplateId);
  const { template, recordingConfig } = useSampleTemplate(sampleTemplateId);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The compile flow (step state + start/stop around the in-browser compile) lives in its own hook;
  // `stop` cancels an in-flight compile and closes the dialog.
  const { step, setStep, progress, result, errorMessage, start, stop } = useOnboardingCompile({
    sampleTemplateId,
    template,
    onClose: onDone,
  });

  useLockBodyScroll();

  // Personalize the Home hero: once the in-browser compile succeeds, show that video as the hero clip
  // for this session (fires an event so a Home behind the modal swaps immediately; not persisted).
  useEffect(() => {
    if (result) {
      setHeroVideo(result.blob);
    }
  }, [result]);

  // Typed name, or the placeholder sample if left blank — so a recorded clip is always enough to create.
  const effectiveName = name.trim() || placeholderName;
  const canCreate = videoFile !== null;
  // The welcome/create steps are dismissible (skippable); compiling/done/error are not, so a stray
  // backdrop click can't tear down an in-flight compile.
  const dismissible = step === 'welcome' || step === 'create';

  // Close when the click lands on the backdrop itself, not on the modal panel or its children.
  const onBackdropClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dismissible && event.target === event.currentTarget) onDone();
  };

  // "Start creating" from the done step: close the dialog and drop the user into the studio.
  const startCreating = () => {
    onDone();
    Promise.resolve(navigate('/studio')).catch(() => {});
  };

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (file) setVideoFile(file);
  };

  const renderStep = () => {
    if (step === 'welcome') {
      return (
        <WelcomeStep
          onStart={() => {
            setStep('create');
          }}
          onDone={onDone}
        />
      );
    }

    if (step === 'create') {
      return (
        <CreateStep
          name={name}
          onNameChange={setName}
          sampleName={placeholderName}
          videoFile={videoFile}
          canCreate={canCreate}
          fileInputRef={fileInputRef}
          onOpenCamera={() => {
            setShowCamera(true);
          }}
          onFilePicked={onFilePicked}
          onCreate={() => {
            Promise.resolve(start(effectiveName, videoFile)).catch(() => {});
          }}
        />
      );
    }

    if (step === 'compiling') return <CompilingStep progress={progress} onStop={stop} />;

    if (step === 'done' && result) return <DoneStep result={result} onStartCreating={startCreating} />;

    if (step === 'error') {
      return (
        <ErrorStep
          errorMessage={errorMessage}
          onRetry={() => {
            setStep('create');
          }}
          onDone={onDone}
        />
      );
    }

    return null;
  };

  return createPortal(
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-black/40 dark:bg-black/80">
      {/* Ambient brand aurora — drifting multi-color blobs for a first-run "wow" backdrop.
          Hidden on mobile, where the soft glow reads as an unwanted blur on the small modal. */}
      <div className="pointer-events-none absolute inset-0 hidden overflow-hidden sm:block">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-brand-500/20 rounded-full blur-[120px] animate-float" />
        <div
          className="absolute top-1/4 -left-24 w-[26rem] h-[26rem] bg-secondary-500/15 rounded-full blur-[110px] animate-float"
          style={{ animationDelay: '-4s' }}
        />
        <div
          className="absolute -bottom-24 right-0 w-[28rem] h-[28rem] bg-accent-400/10 rounded-full blur-[120px] animate-float"
          style={{ animationDelay: '-8s' }}
        />
      </div>

      <div
        onClick={onBackdropClick}
        className="relative min-h-full flex items-center justify-center p-4 pt-[max(1.5rem,env(safe-area-inset-top))] safe-b"
      >
        <div className="relative w-full max-w-lg bg-surface border border-foreground/10 rounded-2xl p-6 sm:p-8 shadow-2xl rise-in">
          <button
            onClick={step === 'compiling' ? stop : onDone}
            className="tap absolute top-4 right-4 z-10 grid place-items-center w-10 h-10 rounded-full text-gray-400 hover:text-foreground hover:bg-foreground/10 transition-colors focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30 before:absolute before:-inset-2.5 before:content-['']"
            aria-label={step === 'compiling' ? t('compiling.stopAria') : t('skipAria')}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Keyed wrapper so each step re-triggers the entrance animation,
              keeping transitions between steps smooth and on-brand. */}
          <div key={step} className="fade-in">
            {renderStep()}
          </div>
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(file) => {
            setVideoFile(file);
          }}
          onClose={() => {
            setShowCamera(false);
          }}
          countdownSeconds={recordingConfig.countdownSeconds}
          maxDurationSeconds={recordingConfig.maxDurationSeconds}
          framingGuide={recordingConfig.framingGuide}
          description={recordingConfig.description}
          orientation={recordingConfig.orientation}
        />
      )}
    </div>,
    document.body
  );
};
