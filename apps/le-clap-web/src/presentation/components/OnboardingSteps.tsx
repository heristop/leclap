import type { RefObject } from 'react'
import { Sparkles, Video as VideoIcon, Upload, Check, Download, ArrowRight, RotateCcw, X, Clapperboard } from 'lucide-react'
import clsx from 'clsx'
import { ProgressDisplay } from '@/presentation/components/ProgressDisplay'
import type { CompilationProgress, CompilationResult } from '@/application/usecases/coreCompilationService'

const WELCOME_FEATURES = [
  { icon: VideoIcon, text: 'Record a short intro with your camera' },
  { icon: Sparkles, text: 'We apply a cinematic sample template' },
  { icon: Download, text: 'Download your finished video' },
] as const

interface WelcomeStepProps {
  onStart: () => void
  onDone: () => void
}

export const WelcomeStep = ({ onStart, onDone }: WelcomeStepProps) => (
  <div className="text-center">
    <div className="inline-flex p-4 brand-gradient rounded-2xl shadow-lg shadow-brand-900/40 mb-5 animate-glow">
      <Clapperboard className="w-8 h-8 text-white" />
    </div>
    <h2 className="text-3xl font-bold font-display text-foreground mb-2">Welcome to LeClap</h2>
    <p className="text-gray-300 mb-6">Let's make your first video in under a minute — record a quick intro and we'll turn it into a polished clip.</p>

    <div className="space-y-3 text-left mb-8">
      {WELCOME_FEATURES.map(({ icon: Icon, text }) => (
        <div key={text} className="flex items-center gap-3 text-sm text-gray-200">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-brand-500/15 text-brand-700 dark:text-brand-300 shrink-0">
            <Icon className="w-4 h-4" />
          </span>
          {text}
        </div>
      ))}
    </div>

    <button onClick={onStart} className="tap group w-full flex items-center justify-center gap-2 brand-gradient text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-brand-900/40 hover:-translate-y-0.5 transition-transform">
      Create my intro
      <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
    </button>
    <button onClick={onDone} className="tap mt-3 w-full text-sm text-gray-400 hover:text-foreground py-2 transition-colors">
      Skip for now
    </button>
  </div>
)

interface CreateStepProps {
  name: string
  onNameChange: (value: string) => void
  videoFile: File | null
  canCreate: boolean
  fileInputRef: RefObject<HTMLInputElement | null>
  onOpenCamera: () => void
  onFilePicked: (event: React.ChangeEvent<HTMLInputElement>) => void
  onCreate: () => void
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

    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2" htmlFor="ob-name">Your name</label>
    <input
      id="ob-name"
      required
      value={name}
      onChange={(e) => { onNameChange(e.target.value) }}
      placeholder="e.g. Alex"
      className="w-full mb-6 px-4 py-3 rounded-xl bg-surface-2 border border-foreground/10 text-foreground placeholder:text-gray-500 focus:outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 transition-all"
    />

    {videoFile ? (
      <div className="flex items-center justify-between gap-3 mb-6 p-3 rounded-xl bg-success/10 border border-success/30">
        <span className="flex items-center gap-2 text-sm text-success font-medium">
          <Check className="w-5 h-5" /> Intro recorded
        </span>
        <button onClick={onOpenCamera} className="tap flex items-center gap-1.5 text-xs text-gray-300 hover:text-foreground px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 transition-colors">
          <RotateCcw className="w-3.5 h-3.5" /> Re-record
        </button>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-3 mb-6">
        <button onClick={onOpenCamera} className="tap flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-200 hover:bg-brand-500/20 hover:-translate-y-0.5 transition-all">
          <VideoIcon className="w-6 h-6" />
          <span className="text-sm font-semibold">Record</span>
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="tap flex flex-col items-center justify-center gap-2 py-5 rounded-xl border border-foreground/10 bg-foreground/5 text-gray-300 hover:bg-foreground/10 hover:-translate-y-0.5 transition-all">
          <Upload className="w-6 h-6" />
          <span className="text-sm font-semibold">Upload</span>
        </button>
        <input ref={fileInputRef} type="file" accept="video/*" aria-label="Upload intro video" className="hidden" onChange={onFilePicked} />
      </div>
    )}

    <button
      onClick={onCreate}
      disabled={!canCreate}
      className={clsx(
        'tap w-full flex items-center justify-center gap-2 font-semibold py-3.5 rounded-xl transition-all',
        canCreate
          ? 'brand-gradient text-white shadow-lg shadow-brand-900/40 hover:-translate-y-0.5'
          : 'bg-surface text-gray-500 cursor-not-allowed border border-foreground/5'
      )}
    >
      <Sparkles className="w-5 h-5" /> Create my video
    </button>
  </div>
)

interface CompilingStepProps {
  progress: CompilationProgress
}

export const CompilingStep = ({ progress }: CompilingStepProps) => (
  <div>
    <h2 className="text-2xl font-bold font-display text-foreground mb-1">Creating your video…</h2>
    <p className="text-gray-300 mb-6 text-sm">This runs entirely in your browser — hang tight.</p>
    <ProgressDisplay progress={progress} />
  </div>
)

interface DoneStepProps {
  result: CompilationResult
  onDone: () => void
}

export const DoneStep = ({ result, onDone }: DoneStepProps) => (
  <div className="text-center">
    <div className="inline-flex p-3 bg-success rounded-xl shadow-lg shadow-success/20 mb-4">
      <Check className="w-6 h-6 text-white" />
    </div>
    <h2 className="text-2xl font-bold font-display brand-gradient-text mb-2">Your first video is ready!</h2>
    <video src={result.url} aria-label="Your created video" controls playsInline className="w-full rounded-xl border border-foreground/10 bg-black mb-6" />
    <div className="flex flex-col sm:flex-row gap-3">
      <a href={result.url} download="leclap-intro.mp4" className="tap flex-1 flex items-center justify-center gap-2 brand-gradient text-white font-semibold py-3 rounded-xl shadow-lg shadow-brand-900/40 hover:-translate-y-0.5 transition-transform">
        <Download className="w-5 h-5" /> Download
      </a>
      <button onClick={onDone} className="tap flex-1 flex items-center justify-center gap-2 bg-foreground/5 hover:bg-foreground/10 text-foreground font-semibold py-3 rounded-xl border border-foreground/10 transition-colors">
        Start creating <ArrowRight className="w-5 h-5" />
      </button>
    </div>
  </div>
)

interface ErrorStepProps {
  errorMessage: string
  onRetry: () => void
  onDone: () => void
}

export const ErrorStep = ({ errorMessage, onRetry, onDone }: ErrorStepProps) => (
  <div className="text-center">
    <div className="inline-flex p-3 bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 rounded-xl mb-4">
      <X className="w-6 h-6 text-[var(--color-error)]" />
    </div>
    <h2 className="text-2xl font-bold font-display text-foreground mb-2">That didn't work</h2>
    <p className="text-gray-300 mb-6 text-sm">{errorMessage}</p>
    <div className="flex flex-col sm:flex-row gap-3">
      <button onClick={onRetry} className="tap flex-1 brand-gradient text-white font-semibold py-3 rounded-xl shadow-lg shadow-brand-900/40 hover:-translate-y-0.5 transition-transform">
        Try again
      </button>
      <button onClick={onDone} className="tap flex-1 bg-foreground/5 hover:bg-foreground/10 text-foreground font-semibold py-3 rounded-xl border border-foreground/10 transition-colors">
        Continue to builder
      </button>
    </div>
  </div>
)
