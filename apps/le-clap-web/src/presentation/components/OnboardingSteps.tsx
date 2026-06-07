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
} from 'lucide-react';
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay';
import { Button, Input } from '@/presentation/components/ui';
import type { CompilationProgress, CompilationResult } from '@/application/usecases/coreCompilationService';

const WELCOME_FEATURES = [
  { icon: VideoIcon, text: 'Record a short intro with your camera' },
  { icon: Sparkles, text: 'We apply a cinematic sample template' },
  { icon: Download, text: 'Download your finished video' },
] as const;

interface WelcomeStepProps {
  onStart: () => void;
  onDone: () => void;
}

export const WelcomeStep = ({ onStart, onDone }: WelcomeStepProps) => (
  <div className="text-center">
    <div className="inline-flex p-4 brand-gradient rounded-2xl shadow-lg shadow-brand-900/40 mb-5 animate-glow">
      <Clapperboard className="w-8 h-8 text-white" />
    </div>
    <h2 className="text-3xl font-bold font-display text-foreground mb-2">Welcome to LeClap</h2>
    <p className="text-gray-300 mb-6">
      Let's make your first video in under a minute — record a quick intro and we'll turn it into a polished clip.
    </p>

    <div className="space-y-3 text-left mb-8">
      {WELCOME_FEATURES.map(({ icon: Icon, text }) => (
        <div key={text} className="flex items-center gap-3 text-sm text-gray-200">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-500/15 text-brand-700 dark:text-brand-300 shrink-0 ring-1 ring-brand-500/20">
            <Icon className="w-4 h-4" />
          </span>
          {text}
        </div>
      ))}
    </div>

    <Button onClick={onStart} variant="primary" size="lg" className="group w-full text-base">
      Create my intro
      <ArrowRight className="transition-transform group-hover:translate-x-1" />
    </Button>
    <Button onClick={onDone} variant="ghost" size="sm" className="mt-3 w-full text-gray-400">
      Skip for now
    </Button>
  </div>
);

interface CreateStepProps {
  name: string;
  onNameChange: (value: string) => void;
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
  videoFile,
  canCreate,
  fileInputRef,
  onOpenCamera,
  onFilePicked,
  onCreate,
}: CreateStepProps) => (
  <div>
    <h2 className="text-2xl font-bold font-display text-foreground mb-1">Present yourself</h2>
    <p className="text-gray-300 mb-6 text-sm">Tell us your name and record a short clip — that's all we need.</p>

    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2" htmlFor="ob-name">
      Your name
    </label>
    <Input
      id="ob-name"
      required
      value={name}
      onChange={(e) => {
        onNameChange(e.target.value);
      }}
      placeholder="e.g. Alex"
      className="mb-6 px-4 py-3 rounded-xl"
    />

    {videoFile ? (
      <div className="pop-in flex items-center justify-between gap-3 mb-6 p-3 rounded-xl bg-success/10 border border-success/30">
        <span className="flex items-center gap-2 text-sm text-success font-medium">
          <Check className="w-5 h-5" /> Intro recorded
        </span>
        <Button
          onClick={onOpenCamera}
          variant="ghost"
          size="sm"
          className="gap-1.5 rounded-lg bg-foreground/5 text-xs text-gray-300 [&_svg]:size-3.5"
        >
          <RotateCcw /> Re-record
        </Button>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button
          onClick={onOpenCamera}
          aria-label="Record an intro with your camera"
          className="tap group/tile flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-200 transition-[transform,background-color,box-shadow,border-color] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:border-brand-500/50 hover:bg-brand-500/20 hover:shadow-[var(--shadow-glow)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
        >
          <VideoIcon className="w-6 h-6 transition-transform duration-300 ease-[var(--ease-spring)] group-hover/tile:scale-110" />
          <span className="text-sm font-semibold">Record</span>
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          aria-label="Upload an intro video"
          className="tap group/tile flex min-h-[5.5rem] flex-col items-center justify-center gap-2 rounded-xl border border-foreground/10 bg-foreground/5 text-gray-300 transition-[transform,background-color,box-shadow,border-color] duration-300 ease-[var(--ease-spring)] hover:-translate-y-0.5 hover:border-foreground/20 hover:bg-foreground/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-500/30"
        >
          <Upload className="w-6 h-6 transition-transform duration-300 ease-[var(--ease-spring)] group-hover/tile:scale-110" />
          <span className="text-sm font-semibold">Upload</span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*"
          aria-label="Upload intro video"
          className="hidden"
          onChange={onFilePicked}
        />
      </div>
    )}

    <Button onClick={onCreate} disabled={!canCreate} variant="primary" size="lg" className="w-full text-base">
      <Sparkles /> Create my video
    </Button>
  </div>
);

interface CompilingStepProps {
  progress: CompilationProgress;
}

export const CompilingStep = ({ progress }: CompilingStepProps) => (
  <div>
    <h2 className="text-2xl font-bold font-display text-foreground mb-1">Creating your video…</h2>
    <p className="text-gray-300 mb-6 text-sm">This runs entirely in your browser — hang tight.</p>
    <ProgressDisplay progress={progress} />
  </div>
);

interface DoneStepProps {
  result: CompilationResult;
  onDone: () => void;
}

export const DoneStep = ({ result, onDone }: DoneStepProps) => (
  <div className="text-center">
    <div className="pop-in inline-flex p-3 bg-success rounded-2xl shadow-lg shadow-success/30 ring-4 ring-success/15 mb-4">
      <Check className="w-6 h-6 text-white" />
    </div>
    <h2 className="text-2xl font-bold font-display brand-gradient-text mb-2">Your first video is ready!</h2>
    <video
      src={result.url}
      aria-label="Your created video"
      controls
      playsInline
      className="w-full rounded-xl border border-foreground/10 bg-black mb-6"
    />
    <div className="flex flex-col sm:flex-row gap-3">
      <Button asChild variant="primary" className="flex-1">
        <a href={result.url} download="leclap-intro.mp4">
          <Download /> Download
        </a>
      </Button>
      <Button onClick={onDone} variant="secondary" className="flex-1">
        Start creating <ArrowRight />
      </Button>
    </div>
  </div>
);

interface ErrorStepProps {
  errorMessage: string;
  onRetry: () => void;
  onDone: () => void;
}

export const ErrorStep = ({ errorMessage, onRetry, onDone }: ErrorStepProps) => (
  <div className="text-center">
    <div className="pop-in inline-flex p-3 bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 rounded-2xl mb-4">
      <X className="w-6 h-6 text-[var(--color-error)]" />
    </div>
    <h2 className="text-2xl font-bold font-display text-foreground mb-2">That didn't work</h2>
    <p className="text-gray-300 mb-6 text-sm">{errorMessage}</p>
    <div className="flex flex-col sm:flex-row gap-3">
      <Button onClick={onRetry} variant="primary" className="flex-1">
        Try again
      </Button>
      <Button onClick={onDone} variant="secondary" className="flex-1">
        Continue to builder
      </Button>
    </div>
  </div>
);
