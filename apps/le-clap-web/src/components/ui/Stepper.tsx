import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StepperProps {
    steps: string[]
    currentStep: number
    className?: string
    onStepClick?: (stepIndex: number) => void
}

export const Stepper = ({ steps, currentStep, className, onStepClick }: StepperProps) => {
    return (
        <nav aria-label="Progress" className={cn("w-full py-6", className)}>
            <ol className="flex items-center justify-between relative px-4">
                {/* Progress Bar Background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-800 -z-10" />

                {/* Progress Bar Fill */}
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 bg-gradient-to-r from-blue-500 to-purple-500 -z-10 transition-all duration-500 ease-in-out"
                    style={{ width: `${(currentStep / (steps.length - 1)) * 100}%` }}
                />

                {steps.map((step, index) => {
                    const isCompleted = index < currentStep
                    const isCurrent = index === currentStep
                    const isClickable = onStepClick && (isCompleted || isCurrent)

                    return (
                        <li
                            key={step}
                            className={cn(
                                "flex flex-col items-center group relative",
                                isClickable && "cursor-pointer"
                            )}
                            onClick={() => isClickable && onStepClick(index)}
                            aria-current={isCurrent ? "step" : undefined}
                        >
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 relative z-10",
                                    isCompleted && "bg-gradient-to-br from-blue-600 to-purple-600 border-transparent text-white shadow-[0_0_15px_rgba(124,131,253,0.5)]",
                                    isCurrent && "bg-gray-900 border-blue-500 text-blue-400 shadow-[0_0_20px_rgba(59,130,246,0.3)] scale-110",
                                    !isCompleted && !isCurrent && "bg-gray-900 border-gray-700 text-gray-600",
                                    isClickable && "group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(59,130,246,0.4)]"
                                )}
                            >
                                {isCurrent && (
                                    <div className="absolute inset-0 rounded-full bg-blue-500/20 animate-ping" />
                                )}

                                {isCompleted ? (
                                    <Check className="w-5 h-5" />
                                ) : (
                                    <span className="text-sm font-bold font-display">{index + 1}</span>
                                )}
                            </div>

                            {/* Label */}
                            <span
                                className={cn(
                                    "absolute -bottom-8 text-xs font-bold uppercase tracking-widest transition-all duration-300 whitespace-nowrap",
                                    isCurrent ? "text-blue-400 translate-y-0 opacity-100" :
                                        isCompleted ? "text-gray-400 group-hover:text-gray-200" : "text-gray-600",
                                    !isCurrent && "opacity-0 group-hover:opacity-100 group-hover:translate-y-0 -translate-y-2"
                                )}
                            >
                                {step}
                            </span>
                        </li>
                    )
                })}
            </ol>
        </nav>
    )
}
