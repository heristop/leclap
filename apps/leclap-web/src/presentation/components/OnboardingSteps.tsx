import type { RefObject } from 'react';
import {
  Sparkles,
  Video as VideoIcon,
  Upload,
  Check,
  Download,
  ArrowRight,
  RotateCcw,
  X,
  Clapperboard,
} from '@/presentation/components/icons';
import clsx from 'clsx';
import { useTranslation } from 'react-i18next';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { VideoPreview } from '@/presentation/components/VideoPreview';
import { StopButton } from '@/presentation/components/StopButton';
import { Button, Input } from '@/presentation/components/ui';
import { useBrowserSupport } from '@/hooks/useBrowserSupport';
import type { CompilationProgress, CompilationResult } from '@/application/usecases/coreCompilationService';

const WELCOME_FEATURES = [
  { id: 'record', icon: VideoIcon },
  { id: 'template', icon: Sparkles },
  { id: 'download', icon: Download },
] as const;

interface WelcomeStepProps {
  onStart: () => void;
  onDone: () => void;
}

export const WelcomeStep = ({ onStart, onDone }: WelcomeStepProps) => {
  const { t } = useTranslation('onboarding');
  const { checks, checking, ready } = useBrowserSupport();
  let startLabel = t('welcome.unsupported');

  if (checking) {
    startLabel = t('welcome.checking');
  }

  if (!checking && ready) {
    startLabel = t('welcome.start');
  }

  return (
    <div className="text-center">
      <div className="fade-in inline-flex p-4 brand-gradient rounded-2xl shadow-lg shadow-brand-900/40 mb-5 animate-glow">
        <Clapperboard className="w-8 h-8 text-white" />
      </div>
      <h2 className="fade-in text-3xl font-bold font-display text-foreground mb-2" style={{ animationDelay: '80ms' }}>
        {t('welcome.title')} <span className="text-gradient-animated">{t('brand', { ns: 'common' })}</span>
      </h2>
      <p className="fade-in text-gray-300 mb-6" style={{ animationDelay: '160ms' }}>
        {t('welcome.subtitle')}
      </p>

      <div className="space-y-3 text-left mb-6">
        {WELCOME_FEATURES.map(({ icon: Icon, id }, i) => (
          <div
            key={id}
            className="fade-in flex items-center gap-3 text-sm text-gray-200"
            style={{ animationDelay: `${240 + i * 100}ms` }}
          >
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-500/15 text-brand-700 dark:text-brand-300 shrink-0 ring-1 ring-brand-500/20">
              <Icon className="w-4 h-4" />
            </span>
            {t(`welcome.features.${id}`)}
          </div>
        ))}
      </div>

      {/* Discreet browser readiness check — gates "Create my intro" so newcomers on an
          unsupported browser don't hit a mid-flow failure when recording or compiling. */}
      {checks && (
        <ul
          className="fade-in mb-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5"
          style={{ animationDelay: '520ms' }}
        >
          {checks.map((check) => (
            <li
              key={check.id}
              className={clsx(
                'flex items-center gap-1.5 text-xs',
                check.ok ? 'text-gray-400' : 'font-medium text-[var(--color-error)]'
              )}
            >
              {check.ok ? <Check className="w-3.5 h-3.5 text-success-foreground" /> : <X className="w-3.5 h-3.5" />}
              {t(check.labelKey)}
            </li>
          ))}
        </ul>
      )}

      <div className="fade-in" style={{ animationDelay: '560ms' }}>
        <Button
          onClick={onStart}
          variant="primary"
          size="lg"
          disabled={checking || !ready}
          className="group w-full text-base glow-brand"
        >
          {startLabel}
          {ready && <ArrowRight className="transition-transform group-hover:translate-x-1" />}
        </Button>
        {!checking && !ready && <p className="mt-2 text-xs text-gray-500">{t('welcome.unsupportedHint')}</p>}
        <Button onClick={onDone} variant="ghost" size="sm" className="mt-3 w-full text-gray-400">
          {t('welcome.skip')}
        </Button>
      </div>
    </div>
  );
};

interface CreateStepProps {
  name: string;
  onNameChange: (value: string) => void;
  sampleName: string;
  videoFile: File | null;
  canCreate: boolean;
  fileInputRef: RefObject<HTMLInputElement | null>;
  onOpenCamera: () => void;
  onFilePicked: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onCreate: () => void;
}

export const CreateStep = ({
  name,
  onNameChange,
  sampleName,
  videoFile,
  canCreate,
  fileInputRef,
  onOpenCamera,
  onFilePicked,
  onCreate,
}: CreateStepProps) => {
  const { t } = useTranslation('onboarding');

  return (
    <div>
      <h2 className="text-2xl font-bold font-display text-foreground mb-1">{t('create.title')}</h2>
      <p className="text-gray-300 mb-6 text-sm">{t('create.subtitle')}</p>

      <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2" htmlFor="ob-name">
        {t('create.nameLabel')}
      </label>
      <Input
        id="ob-name"
        value={name}
        onChange={(e) => {
          onNameChange(e.target.value);
        }}
        placeholder={t('create.namePlaceholder', { name: sampleName })}
        className="mb-6 px-4 py-3 rounded-xl"
      />

      {videoFile ? (
        <div className="pop-in flex items-center justify-between gap-3 mb-6 p-3 rounded-xl bg-success/10 border border-success/30">
          <span className="flex items-center gap-2 text-sm text-success-foreground font-medium">
            <Check className="w-5 h-5" /> {t('create.recorded')}
          </span>
          <Button
            onClick={onOpenCamera}
            variant="ghost"
            size="sm"
            className="gap-1.5 rounded-lg bg-foreground/5 text-xs text-gray-300 [&_svg]:size-3.5"
          >
            <RotateCcw /> {t('create.reRecord')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            onClick={onOpenCamera}
            aria-label={t('create.recordAria')}
            className="tap group/tile flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-200 transition-[transform,background-color,box-shadow,border-color] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:border-brand-500/50 hover:bg-brand-500/20 hover:shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
          >
            <VideoIcon className="w-6 h-6 transition-transform duration-300 ease-[var(--ease-spring)] group-hover/tile:scale-110" />
            <span className="text-sm font-semibold">{t('create.record')}</span>
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            aria-label={t('create.uploadAria')}
            className="tap group/tile flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/5 text-gray-300 transition-[transform,background-color,box-shadow,border-color] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
          >
            <Upload className="w-6 h-6 transition-transform duration-300 ease-[var(--ease-spring)] group-hover/tile:scale-110" />
            <span className="text-sm font-semibold">{t('create.upload')}</span>
          </button>
          {/* Visually hidden via `sr-only`, NOT `display:none`: WebKit/Safari refuses to open the OS
              file dialog for a `display:none` input clicked programmatically, so the picker "won't
              open". sr-only keeps it rendered (and out of the tab order via tabIndex) so .click() works
              across browsers. */}
          <input
            ref={fileInputRef}
            type="file"
            accept="video/*"
            aria-label={t('create.uploadInputAria')}
            tabIndex={-1}
            className="sr-only"
            onChange={onFilePicked}
          />
        </div>
      )}

      <Button onClick={onCreate} disabled={!canCreate} variant="primary" size="lg" className="w-full text-base">
        <Sparkles /> {t('create.create')}
      </Button>
    </div>
  );
};

interface CompilingStepProps {
  progress: CompilationProgress;
  onStop: () => void;
}

export const CompilingStep = ({ progress, onStop }: CompilingStepProps) => {
  const { t } = useTranslation('onboarding');

  return (
    <div>
      <h2 className="text-2xl font-bold font-display text-foreground mb-1">{t('compiling.title')}</h2>
      <p className="text-gray-300 mb-6 text-sm">{t('compiling.subtitle')}</p>
      <ProgressDisplay progress={progress} />
      <div className="mt-6 flex justify-center">
        <StopButton onClick={onStop} label={t('compiling.stop')} />
      </div>
    </div>
  );
};

interface DoneStepProps {
  result: CompilationResult;
  onStartCreating: () => void;
}

export const DoneStep = ({ result, onStartCreating }: DoneStepProps) => {
  const { t } = useTranslation('onboarding');

  return (
    <div className="text-center">
      <div className="pop-in inline-flex p-3 bg-success rounded-2xl shadow-lg shadow-success/30 ring-4 ring-success/15 mb-4">
        <Check className="w-6 h-6 text-white" />
      </div>
      <h2 className="text-2xl font-bold font-display brand-gradient-text mb-2">{t('done.title')}</h2>
      <div className="mb-6">
        <VideoPreview url={result.url} duration={result.duration} />
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button asChild variant="primary" className="flex-1">
          <a href={result.url} download="leclap-intro.mp4">
            <Download /> {t('actions.download', { ns: 'common' })}
          </a>
        </Button>
        <Button onClick={onStartCreating} variant="secondary" className="flex-1">
          {t('done.startCreating')} <ArrowRight />
        </Button>
      </div>
    </div>
  );
};

interface ErrorStepProps {
  errorMessage: string;
  onRetry: () => void;
  onDone: () => void;
}

export const ErrorStep = ({ errorMessage, onRetry, onDone }: ErrorStepProps) => {
  const { t } = useTranslation('onboarding');

  return (
    <div className="text-center">
      <div className="pop-in inline-flex p-3 bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 rounded-2xl mb-4">
        <X className="w-6 h-6 text-[var(--color-error)]" />
      </div>
      <h2 className="text-2xl font-bold font-display text-foreground mb-2">{t('error.title')}</h2>
      <p className="text-gray-300 mb-6 text-sm">{errorMessage}</p>
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onRetry} variant="primary" className="flex-1">
          {t('actions.tryAgain', { ns: 'common' })}
        </Button>
        <Button onClick={onDone} variant="secondary" className="flex-1">
          {t('error.continueToBuilder')}
        </Button>
      </div>
    </div>
  );
};
