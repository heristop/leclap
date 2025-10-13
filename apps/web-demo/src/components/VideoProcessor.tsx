import { useState, startTransition } from 'react'
import { Play, Square, AlertCircle, CheckCircle2, Loader2, FileText, Users } from 'lucide-react'
import clsx from 'clsx'
import { type Template } from '../services/templateService'

interface VideoProcessorProps {
  isProcessing: boolean
  canProcess: boolean
  onStartProcessing: () => void
  error: string | null
  template: Template | null
  formData: Record<string, string>
}

export const VideoProcessor = ({
  isProcessing,
  canProcess,
  onStartProcessing,
  error,
  template,
  formData
}: VideoProcessorProps) => {
  const [isOptimisticProcessing, setIsOptimisticProcessing] = useState(false)

  const handleStartProcessing = () => {
    // Optimistic UI update
    startTransition(() => {
      setIsOptimisticProcessing(true)
    })

    onStartProcessing()

    // Reset optimistic state after a short delay
    setTimeout(() => {
      setIsOptimisticProcessing(false)
    }, 1000)
  }

  const actuallyProcessing = isProcessing || isOptimisticProcessing

  return (
    <div className="space-y-4">
      {/* Status Display */}
      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className={clsx(
            'w-3 h-3 rounded-full transition-all duration-300',
            canProcess ? 'bg-green-500 animate-pulse' : 'bg-red-500',
            actuallyProcessing && 'animate-ping'
          )} />
          <div>
            <p className="text-sm font-medium text-gray-900">
              {actuallyProcessing
                ? 'Processing Video...'
                : canProcess
                ? 'Ready to Process'
                : 'Setup Required'
              }
            </p>
            <p className="text-xs text-gray-500">
              {actuallyProcessing
                ? 'Please wait while we process your video'
                : canProcess
                ? 'All requirements met. You can start processing.'
                : 'Please select a template and upload video files'
              }
            </p>
          </div>
        </div>

        {/* Status Icon */}
        <div className={clsx(
          'p-2 rounded-lg transition-all duration-200',
          actuallyProcessing && 'animate-spin',
          canProcess ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
        )}>
          {actuallyProcessing ? (
            <Loader2 className="w-5 h-5" />
          ) : canProcess ? (
            <CheckCircle2 className="w-5 h-5" />
          ) : (
            <AlertCircle className="w-5 h-5" />
          )}
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg fade-in">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-800 mb-1">
                Processing Error
              </h4>
              <p className="text-sm text-red-600">
                {error}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Action Button */}
      <div className="flex justify-center">
        <button
          onClick={handleStartProcessing}
          disabled={!canProcess || actuallyProcessing}
          className={clsx(
            'flex items-center space-x-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-200',
            'focus:outline-none focus:ring-4 focus:ring-brand-200',
            canProcess && !actuallyProcessing
              ? 'bg-gradient-to-r from-brand-500 to-purple-600 text-white hover:from-brand-600 hover:to-purple-700 hover:scale-105 shadow-lg hover:shadow-xl'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed',
            actuallyProcessing && 'bg-gradient-to-r from-processing-500 to-blue-600 text-white cursor-wait',
            isOptimisticProcessing && 'scale-95'
          )}
        >
          <div className={clsx(
            'p-2 rounded-lg transition-all duration-200',
            canProcess && !actuallyProcessing ? 'bg-white/20' : 'bg-white/10',
            actuallyProcessing && 'animate-pulse'
          )}>
            {actuallyProcessing ? (
              <Square className="w-6 h-6" />
            ) : (
              <Play className="w-6 h-6" />
            )}
          </div>
          <span>
            {actuallyProcessing ? 'Processing...' : 'Start Processing'}
          </span>
        </button>
      </div>

      {/* Template Information */}
      {template && (
        <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg fade-in">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-indigo-500 rounded-lg">
              {template.hasForm ? <Users className="w-4 h-4 text-white" /> : <FileText className="w-4 h-4 text-white" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-indigo-800 mb-1">
                Selected Template: {template.name}
              </h4>
              <p className="text-xs text-indigo-600 mb-2">
                {template.description}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-indigo-500">Complexity:</span>
                  <span className="ml-1 font-medium text-indigo-700 capitalize">{template.complexity}</span>
                </div>
                <div>
                  <span className="text-indigo-500">Orientation:</span>
                  <span className="ml-1 font-medium text-indigo-700 capitalize">{template.orientation}</span>
                </div>
                <div>
                  <span className="text-indigo-500">Sections:</span>
                  <span className="ml-1 font-medium text-indigo-700">{template.descriptor.sections.length}</span>
                </div>
                <div>
                  <span className="text-indigo-500">Music:</span>
                  <span className="ml-1 font-medium text-indigo-700">{template.descriptor.global.musicEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              {template.hasForm && Object.keys(formData).length > 0 && (
                <div className="mt-2 pt-2 border-t border-indigo-200">
                  <p className="text-xs text-indigo-600 mb-1">Form Data:</p>
                  <div className="text-xs text-indigo-700 space-y-1">
                    {Object.entries(formData).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-indigo-500">{key}:</span>
                        <span className="font-medium truncate ml-2" title={value}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Requirements Checklist */}
      {!canProcess && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg fade-in">
          <h4 className="text-sm font-medium text-blue-800 mb-3">
            Before you can start processing:
          </h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <span className="text-gray-700">FFmpeg WebAssembly loaded</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              {template ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              )}
              <span className={template ? 'text-gray-700' : 'text-gray-500'}>
                Select a template
              </span>
            </div>
            {template?.hasForm && (
              <div className="flex items-center space-x-2 text-sm">
                {Object.keys(formData).length > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
                )}
                <span className={Object.keys(formData).length > 0 ? 'text-gray-700' : 'text-gray-500'}>
                  Fill template form
                </span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-sm">
              <div className="w-4 h-4 rounded-full border-2 border-gray-300" />
              <span className="text-gray-500">Upload at least one video file</span>
            </div>
          </div>
        </div>
      )}

      {/* Processing Tips */}
      {canProcess && !actuallyProcessing && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg fade-in">
          <h4 className="text-sm font-medium text-green-800 mb-2">
            💡 Processing Tips
          </h4>
          <ul className="text-sm text-green-700 space-y-1">
            <li>• Keep this tab active for optimal performance</li>
            <li>• Larger files will take longer to process</li>
            <li>• You can monitor progress in real-time</li>
            <li>• Processing happens entirely in your browser</li>
          </ul>
        </div>
      )}
    </div>
  )
}