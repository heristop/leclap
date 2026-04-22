import { useMemo } from 'react'
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

export const ProgressDisplay = ({ progress }: ProgressDisplayProps) => {
  const {
    stage,
    percentage,
    currentStep,
    totalSteps,
    currentStepIndex,
    estimatedTimeRemaining
  } = progress

  const formatTime = (milliseconds: number) => {
    const seconds = Math.floor(milliseconds / 1000)
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60

    if (minutes > 0) {
      return `${minutes}m ${remainingSeconds}s`
    }
    return `${remainingSeconds}s`
  }

  const stageIcon = useMemo(() => {
    if (percentage >= 100) return CheckCircle2
    if (percentage === 0) return AlertCircle
    return Cpu
  }, [percentage])

  const StageIcon = stageIcon

  const progressColor = useMemo(() => {
    if (percentage >= 100) return 'bg-green-500'
    if (percentage >= 75) return 'bg-blue-500'
    if (percentage >= 50) return 'bg-yellow-500'
    if (percentage >= 25) return 'bg-orange-500'
    return 'bg-red-500'
  }, [percentage])

  return (
    <div className="space-y-6 processing fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={clsx(
            'p-2 rounded-lg transition-all duration-300',
            percentage >= 100 ? 'bg-green-900/30 text-green-400' : 'bg-blue-900/30 text-blue-400'
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

        {/* Time Remaining */}
        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Clock className="w-4 h-4" />
            <span>~{formatTime(estimatedTimeRemaining)} remaining</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-300">
            {currentStep || 'Processing...'}
          </span>
          <span className={clsx(
            'font-semibold',
            percentage >= 100 ? 'text-green-400' : 'text-blue-400'
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
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12 animate-[shimmer_2s_infinite]" />

          {/* Progress Fill */}
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden',
              progressColor
            )}
            style={{ width: `${Math.max(percentage, 0)}%` }}
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 animate-[shimmer_1.5s_infinite]" />
          </div>
        </div>
      </div>

      {/* Step Indicators */}
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, index) => {
          const stepNumber = index + 1
          const isCompleted = stepNumber < currentStepIndex
          const isCurrent = stepNumber === currentStepIndex
          const isPending = stepNumber > currentStepIndex

          return (
            <div key={stepNumber} className="flex flex-col items-center space-y-2">
              <div className={clsx(
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300 border',
                isCompleted && 'bg-green-600 border-green-500 text-white scale-110 shadow-[0_0_10px_rgba(34,197,94,0.4)]',
                isCurrent && 'bg-blue-600 border-blue-500 text-white animate-pulse ring-4 ring-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.5)]',
                isPending && 'bg-gray-800 border-gray-700 text-gray-500'
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : (
                  stepNumber
                )}
              </div>
              <div className={clsx(
                'w-2 h-1 rounded-full transition-all duration-300',
                isCompleted && 'bg-green-500',
                isCurrent && 'bg-blue-500',
                isPending && 'bg-gray-700'
              )} />
            </div>
          )
        })}
      </div>

      {/* Performance Metrics */}
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

      {/* Completion Message */}
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