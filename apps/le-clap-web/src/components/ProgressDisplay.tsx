import { Clock, Cpu, CheckCircle2, AlertCircle, Zap } from 'lucide-react'
import clsx from 'clsx'

interface ProcessingProgress {
  stage: string
  percentage: number
  currentStep: string
  totalSteps: number
  currentStepIndex: number
  estimatedTimeRemaining?: number
}

interface ProgressDisplayProps {
  progress: ProcessingProgress
}

const formatTime = (milliseconds: number): string => {
  const seconds = Math.floor(milliseconds / 1000)
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60

  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`
  }

  return `${remainingSeconds}s`
}

const getStageIcon = (percentage: number) => {
  if (percentage >= 100) return CheckCircle2

  if (percentage === 0) return AlertCircle

  return Cpu
}

const getProgressColor = (percentage: number): string => {
  // One on-brand fill (lavender→pink) that turns success-green on completion —
  // not a rainbow ramp.
  if (percentage >= 100) return 'bg-success'

  return 'brand-gradient bg-[length:200%_100%] animate-gradient'
}

interface StepIndicatorProps {
  stepNumber: number
  currentStepIndex: number
}

const StepIndicator = ({ stepNumber, currentStepIndex }: StepIndicatorProps) => {
  const isCompleted = stepNumber < currentStepIndex
  const isCurrent = stepNumber === currentStepIndex
  const isPending = stepNumber > currentStepIndex

  return (
    <div className="flex flex-col items-center space-y-2">
      <div className={clsx(
        'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] border',
        isCompleted && 'bg-success border-success text-white scale-110 shadow-[0_0_10px_oklch(0.673_0.162_144.2/0.45)]',
        isCurrent && 'brand-gradient border-transparent text-white animate-pulse ring-4 ring-brand-500/25 shadow-[0_0_16px_oklch(0.663_0.178_277.9/0.55)]',
        isPending && 'bg-surface-2 border-gray-700 text-gray-500'
      )}>
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4" />
        ) : (
          stepNumber
        )}
      </div>
      <div className={clsx(
        'w-2 h-1 rounded-full transition-all duration-300',
        isCompleted && 'bg-success',
        isCurrent && 'bg-brand-500',
        isPending && 'bg-gray-700'
      )} />
    </div>
  )
}

interface PerformanceMetricsProps {
  percentage: number
  currentStepIndex: number
  totalSteps: number
}

const PerformanceMetrics = ({ percentage, currentStepIndex, totalSteps }: PerformanceMetricsProps) => (
  <div className="grid grid-cols-3 gap-4 p-4 bg-gray-800/40 rounded-xl border border-white/5 backdrop-blur-sm">
    <div className="text-center">
      <div className="flex items-center justify-center space-x-1 text-sm text-gray-400 mb-1">
        <Zap className="w-4 h-4" />
        <span>Speed</span>
      </div>
      <p className="text-lg font-semibold text-white">
        {percentage > 0 ? 'Active' : 'Idle'}
      </p>
    </div>

    <div className="text-center">
      <div className="flex items-center justify-center space-x-1 text-sm text-gray-400 mb-1">
        <Cpu className="w-4 h-4" />
        <span>Stage</span>
      </div>
      <p className="text-lg font-semibold text-white">
        {currentStepIndex}/{totalSteps}
      </p>
    </div>

    <div className="text-center">
      <div className="flex items-center justify-center space-x-1 text-sm text-gray-400 mb-1">
        <Clock className="w-4 h-4" />
        <span>Progress</span>
      </div>
      <p className="text-lg font-semibold text-white">
        {Math.round(percentage)}%
      </p>
    </div>
  </div>
)

interface ProgressHeaderProps {
  stage: string
  percentage: number
  currentStepIndex: number
  totalSteps: number
  estimatedTimeRemaining?: number
}

const ProgressHeader = ({ stage, percentage, currentStepIndex, totalSteps, estimatedTimeRemaining }: ProgressHeaderProps) => {
  const StageIcon = getStageIcon(percentage)

  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={clsx(
          'p-2 rounded-lg transition-all duration-300',
          percentage >= 100 ? 'bg-success/15 text-success' : 'bg-brand-500/15 text-brand-300'
        )}>
          <StageIcon className={clsx(
            'w-5 h-5',
            percentage < 100 && percentage > 0 && 'animate-pulse'
          )} />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-white">
            {stage || 'Processing Video'}
          </h3>
          <p className="text-sm text-gray-400">
            Step {currentStepIndex} of {totalSteps}
          </p>
        </div>
      </div>

      {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
        <div className="flex items-center space-x-2 text-sm text-gray-400">
          <Clock className="w-4 h-4" />
          <span>~{formatTime(estimatedTimeRemaining)} remaining</span>
        </div>
      )}
    </div>
  )
}

interface ProgressBarProps {
  percentage: number
  currentStep: string
}

const ProgressBar = ({ percentage, currentStep }: ProgressBarProps) => {
  const progressColor = getProgressColor(percentage)

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium text-gray-300">
          {currentStep || 'Processing...'}
        </span>
        <span className={clsx(
          'font-semibold',
          percentage >= 100 ? 'text-success' : 'text-brand-300'
        )}>
          {Math.round(percentage)}%
        </span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={Math.round(percentage)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Video processing progress"
        className="relative w-full h-3 bg-gray-700/50 rounded-full overflow-hidden border border-white/5"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-[shimmer_2s_infinite]" />

        <div
          className={clsx(
            'h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden',
            progressColor
          )}
          style={{ width: `${Math.max(percentage, 0)}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-[shimmer_1.5s_infinite]" />
        </div>
      </div>
    </div>
  )
}

export const ProgressDisplay = ({ progress }: ProgressDisplayProps) => {
  const {
    stage,
    percentage,
    currentStep,
    totalSteps,
    currentStepIndex,
    estimatedTimeRemaining
  } = progress

  return (
    <div className="space-y-6 processing fade-in">
      <ProgressHeader
        stage={stage}
        percentage={percentage}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
        estimatedTimeRemaining={estimatedTimeRemaining}
      />

      <ProgressBar percentage={percentage} currentStep={currentStep} />

      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => (
          <StepIndicator
            key={index + 1}
            stepNumber={index + 1}
            currentStepIndex={currentStepIndex}
          />
        ))}
      </div>

      <PerformanceMetrics
        percentage={percentage}
        currentStepIndex={currentStepIndex}
        totalSteps={totalSteps}
      />

      {percentage >= 100 && (
        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl fade-in backdrop-blur-sm">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-600 rounded-lg shadow-lg shadow-green-500/20">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-green-400">
                Processing Complete! 🎉
              </h4>
              <p className="text-sm text-green-300/80">
                Your video has been processed and is ready for download.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
