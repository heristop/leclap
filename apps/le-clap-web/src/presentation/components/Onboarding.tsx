import { useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { CameraCapture } from '@/presentation/components/CameraCapture'
import { WelcomeStep, CreateStep, CompilingStep, DoneStep, ErrorStep } from '@/presentation/components/OnboardingSteps'
import { templateService } from '@/services/templateService'
import { coreCompilationService, type CompilationProgress, type CompilationResult } from '@/application/usecases/coreCompilationService'
import { logger } from '@/lib/logger'
import { useLockBodyScroll } from '@/hooks/useLockBodyScroll'

type Step = 'welcome' | 'create' | 'compiling' | 'done' | 'error'

// The onboarding makes a first video from a built-in template so newcomers see
// the whole flow (record → compile → download) in one guided pass.
const SAMPLE_TEMPLATE_ID = 'sample-advanced'

const initialProgress: CompilationProgress = {
  stage: 'Starting',
  percentage: 0,
  currentStep: 'Preparing your intro',
  totalSteps: 7,
  currentStepIndex: 0,
}

interface OnboardingProps {
  onDone: () => void
}

export const Onboarding = ({ onDone }: OnboardingProps) => {
  const [step, setStep] = useState<Step>('welcome')
  const [name, setName] = useState('')
  const [videoFile, setVideoFile] = useState<File | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [progress, setProgress] = useState<CompilationProgress>(initialProgress)
  const [result, setResult] = useState<CompilationResult | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useLockBodyScroll()

  const canCreate = name.trim().length > 0 && videoFile !== null

  const handleCreate = async () => {
    if (!videoFile) return

    setStep('compiling')
    setProgress(initialProgress)

    try {
      const template = await templateService.getTemplate(SAMPLE_TEMPLATE_ID)

      if (!template) throw new Error(`Sample template "${SAMPLE_TEMPLATE_ID}" could not be loaded.`)

      // Put the entered name in the first text field; leave the rest blank.
      const fields = templateService.extractFormFields(template.descriptor)
      const formData: Record<string, string> = {}

      for (const [index, field] of fields.entries()) {
        formData[field.name] = index === 0 ? name.trim() : ''
      }

      const compiled = await coreCompilationService.compileVideo({ template, formData, files: [videoFile] }, setProgress)
      setResult(compiled)
      setStep('done')
    } catch (error) {
      logger.error('Onboarding compilation failed:', error)
      setErrorMessage(error instanceof Error ? error.message : 'Something went wrong while creating your video.')
      setStep('error')
    }
  }

  const onFilePicked = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]

    if (file) setVideoFile(file)
  }

  return createPortal(
    <div className="fixed inset-0 z-[55] overflow-y-auto bg-black/40 backdrop-blur-md dark:bg-black/80">
      {/* Ambient brand glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] bg-brand-500/15 rounded-full blur-[120px] animate-float" />
      </div>

      <div className="relative min-h-full flex items-center justify-center p-4 pt-[max(1.5rem,env(safe-area-inset-top))] safe-b">
        <div className="relative w-full max-w-lg bg-surface border border-foreground/10 rounded-2xl p-6 sm:p-8 shadow-2xl rise-in">
          {(step === 'welcome' || step === 'create') && (
            <button
              onClick={onDone}
              className="tap absolute top-4 right-4 p-2 rounded-full text-gray-400 hover:text-foreground hover:bg-foreground/10 transition-colors"
              aria-label="Skip onboarding"
            >
              <X className="w-5 h-5" />
            </button>
          )}

          {step === 'welcome' && <WelcomeStep onStart={() => { setStep('create') }} onDone={onDone} />}

          {step === 'create' && (
            <CreateStep
              name={name}
              onNameChange={setName}
              videoFile={videoFile}
              canCreate={canCreate}
              fileInputRef={fileInputRef}
              onOpenCamera={() => { setShowCamera(true) }}
              onFilePicked={onFilePicked}
              onCreate={() => { handleCreate().catch((error: unknown) => { logger.error('Onboarding create handler failed:', error) }) }}
            />
          )}

          {step === 'compiling' && <CompilingStep progress={progress} />}

          {step === 'done' && result && <DoneStep result={result} onDone={onDone} />}

          {step === 'error' && (
            <ErrorStep errorMessage={errorMessage} onRetry={() => { setStep('create') }} onDone={onDone} />
          )}
        </div>
      </div>

      {showCamera && (
        <CameraCapture
          onCapture={(file) => { setVideoFile(file) }}
          onClose={() => { setShowCamera(false) }}
        />
      )}
    </div>,
    document.body
  )
}
