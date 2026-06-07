import { Check } from 'lucide-react'
import { cn } from '../../lib/utils'

interface StepperProps {
    steps: string[]
    currentStep: number
    className?: string
    onStepClick?: (stepIndex: number) => void
}

const getLabelColorClass = (isCurrent: boolean, isCompleted: boolean): string => {
    if (isCurrent) {
        return "text-brand-300 translate-y-0 opacity-100"
    }

    if (isCompleted) {
        return "text-gray-400 group-hover:text-gray-200"
    }

    return "text-gray-600"
}

export const Stepper = ({ steps, currentStep, className, onStepClick }: StepperProps) => {
    return (
        <nav aria-label="Progress" className={cn("w-full py-6", className)}>
            <ol className="flex items-center justify-between relative px-4">
                {/* Progress Bar Background */}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-full h-0.5 bg-gray-800 -z-10" />

                {/* Progress Bar Fill */}
                <div
                    className="absolute left-0 top-1/2 -translate-y-1/2 h-0.5 brand-gradient -z-10 transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
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
                            onClick={() => { if (isClickable) { onStepClick(index) } }}
                            aria-current={isCurrent ? "step" : undefined}
                        >
                            <div
                                className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] relative z-10",
                                    isCompleted && "brand-gradient border-transparent text-white shadow-[0_0_15px_rgba(124,131,253,0.55)]",
                                    isCurrent && "bg-surface border-brand-500 text-brand-300 shadow-[0_0_22px_rgba(124,131,253,0.4)] scale-110",
                                    !isCompleted && !isCurrent && "bg-surface border-gray-700 text-gray-600",
                                    isClickable && "group-hover:scale-110 group-hover:shadow-[0_0_25px_rgba(124,131,253,0.45)]"
                                )}
                            >
                                {isCurrent && (
                                    <div className="absolute inset-0 rounded-full bg-brand-500/25 animate-ping" />
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
                                    getLabelColorClass(isCurrent, isCompleted),
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
