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
            percentage >= 100 ? 'bg-green-100 text-green-600' : 'bg-blue-100 text-blue-600'
          )}>
            <StageIcon className={clsx(
              'w-5 h-5',
              percentage < 100 && percentage > 0 && 'animate-pulse'
            )} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {stage || 'Processing Video'}
            </h3>
            <p className="text-sm text-gray-600">
              Step {currentStepIndex} of {totalSteps}
            </p>
          </div>
        </div>

        {/* Time Remaining */}
        {estimatedTimeRemaining !== undefined && estimatedTimeRemaining > 0 && (
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="w-4 h-4" />
            <span>~{formatTime(estimatedTimeRemaining)} remaining</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">
            {currentStep || 'Processing...'}
          </span>
          <span className={clsx(
            'font-semibold',
            percentage >= 100 ? 'text-green-600' : 'text-blue-600'
          )}>
            {Math.round(percentage)}%
          </span>
        </div>

        <div className="relative w-full h-3 bg-gray-200 rounded-full overflow-hidden">
          {/* Animated Background */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-[shimmer_2s_infinite]" />

          {/* Progress Fill */}
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500 ease-out relative overflow-hidden',
              progressColor
            )}
            style={{ width: `${Math.max(percentage, 0)}%` }}
          >
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -skew-x-12 animate-[shimmer_1.5s_infinite]" />
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
                'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all duration-300',
                isCompleted && 'bg-green-500 text-white scale-110',
                isCurrent && 'bg-brand-500 text-white animate-pulse ring-4 ring-brand-200',
                isPending && 'bg-gray-200 text-gray-500'
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
                isCurrent && 'bg-brand-500',
                isPending && 'bg-gray-300'
              )} />
            </div>
          )
        })}
      </div>

      {/* Performance Metrics */}
      <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-sm text-gray-600 mb-1">
            <Zap className="w-4 h-4" />
            <span>Speed</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {percentage > 0 ? 'Active' : 'Idle'}
          </p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-sm text-gray-600 mb-1">
            <Cpu className="w-4 h-4" />
            <span>Stage</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {currentStepIndex}/{totalSteps}
          </p>
        </div>

        <div className="text-center">
          <div className="flex items-center justify-center space-x-1 text-sm text-gray-600 mb-1">
            <Clock className="w-4 h-4" />
            <span>Progress</span>
          </div>
          <p className="text-lg font-semibold text-gray-900">
            {Math.round(percentage)}%
          </p>
        </div>
      </div>

      {/* Completion Message */}
      {percentage >= 100 && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg fade-in">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-green-500 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <h4 className="font-semibold text-green-800">
                Processing Complete! 🎉
              </h4>
              <p className="text-sm text-green-600">
                Your video has been processed successfully and is ready for download.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}