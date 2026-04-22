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
  uploadedFiles?: File[]
}

export const VideoProcessor = ({
  isProcessing,
  canProcess,
  onStartProcessing,
  error,
  template,
  formData,
  uploadedFiles
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
      <div className="flex items-center justify-between p-4 bg-gray-800/40 border border-white/10 rounded-xl backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <div className={clsx(
            'w-3 h-3 rounded-full transition-all duration-300',
            canProcess ? 'bg-green-500 animate-pulse shadow-lg shadow-green-500/20' : 'bg-red-500 shadow-lg shadow-red-500/20',
            actuallyProcessing && 'animate-ping'
          )} />
          <div>
            <p className="text-sm font-medium text-white">
              {actuallyProcessing
                ? 'Processing Video...'
                : canProcess
                  ? 'Ready to Process'
                  : 'Setup Required'
              }
            </p>
            <p className="text-xs text-gray-400">
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
          canProcess ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
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
        <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-xl fade-in backdrop-blur-sm">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-300 mb-1">
                Processing Error
              </h4>
              <p className="text-sm text-red-200/80">
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
            'focus:outline-none focus:ring-4 focus:ring-brand-500/30',
            canProcess && !actuallyProcessing
              ? 'bg-gradient-to-r from-brand-600 to-purple-600 text-white hover:from-brand-500 hover:to-purple-500 hover:scale-105 shadow-lg hover:shadow-brand-500/25 cursor-pointer'
              : 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5',
            actuallyProcessing && 'bg-gradient-to-r from-brand-600 to-blue-600 text-white cursor-wait opacity-90',
            isOptimisticProcessing && 'scale-95'
          )}
        >
          <div className={clsx(
            'p-2 rounded-lg transition-all duration-200',
            canProcess && !actuallyProcessing ? 'bg-white/20' : 'bg-white/5',
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
        <div className="p-4 bg-indigo-900/20 border border-indigo-500/30 rounded-xl fade-in backdrop-blur-sm">
          <div className="flex items-start space-x-3">
            <div className="p-2 bg-indigo-500/20 rounded-lg border border-indigo-500/20">
              {template.hasForm ? <Users className="w-4 h-4 text-indigo-300" /> : <FileText className="w-4 h-4 text-indigo-300" />}
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-medium text-indigo-300 mb-1">
                Selected Template: {template.name}
              </h4>
              <p className="text-xs text-indigo-200/70 mb-2">
                {template.description}
              </p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-indigo-400/70">Complexity:</span>
                  <span className="ml-1 font-medium text-indigo-300 capitalize">{template.complexity}</span>
                </div>
                <div>
                  <span className="text-indigo-400/70">Orientation:</span>
                  <span className="ml-1 font-medium text-indigo-300 capitalize">{template.orientation}</span>
                </div>
                <div>
                  <span className="text-indigo-400/70">Sections:</span>
                  <span className="ml-1 font-medium text-indigo-300">{template.descriptor.sections.length}</span>
                </div>
                <div>
                  <span className="text-indigo-400/70">Music:</span>
                  <span className="ml-1 font-medium text-indigo-300">{template.descriptor.global.musicEnabled ? 'Enabled' : 'Disabled'}</span>
                </div>
              </div>
              {template.hasForm && Object.keys(formData).length > 0 && (
                <div className="mt-2 pt-2 border-t border-indigo-500/20">
                  <p className="text-xs text-indigo-400/70 mb-1">Form Data:</p>
                  <div className="text-xs text-indigo-300 space-y-1">
                    {Object.entries(formData).map(([key, value]) => (
                      <div key={key} className="flex justify-between">
                        <span className="text-indigo-400/70">{key}:</span>
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
        <div className="p-4 bg-blue-900/20 border border-blue-500/30 rounded-xl fade-in backdrop-blur-sm">
          <h4 className="text-sm font-medium text-blue-300 mb-3">
            Before you can start processing:
          </h4>
          <div className="space-y-2">
            <div className="flex items-center space-x-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span className="text-gray-300">Video processing engine ready</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              {template ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
              )}
              <span className={template ? 'text-gray-300' : 'text-gray-500'}>
                Select a template
              </span>
            </div>
            {template?.hasForm && (
              <div className="flex items-center space-x-2 text-sm">
                {Object.keys(formData).length > 0 ? (
                  <CheckCircle2 className="w-4 h-4 text-green-400" />
                ) : (
                  <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
                )}
                <span className={Object.keys(formData).length > 0 ? 'text-gray-300' : 'text-gray-500'}>
                  Fill template form
                </span>
              </div>
            )}
            <div className="flex items-center space-x-2 text-sm">
              {uploadedFiles && uploadedFiles.length > 0 ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <div className="w-4 h-4 rounded-full border-2 border-gray-600" />
              )}
              <span className={uploadedFiles && uploadedFiles.length > 0 ? 'text-gray-300' : 'text-gray-500'}>
                Upload at least one video file
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Processing Tips */}
      {canProcess && !actuallyProcessing && (
        <div className="p-4 bg-green-900/20 border border-green-500/30 rounded-xl fade-in backdrop-blur-sm">
          <h4 className="text-sm font-medium text-green-300 mb-2">
            💡 Processing Tips
          </h4>
          <ul className="text-sm text-green-200/70 space-y-1">
            <li>• Keep this tab active during processing</li>
            <li>• Larger files will take longer to process</li>
            <li>• You can monitor progress in real-time</li>
            <li>• Processing happens entirely in your browser</li>
          </ul>
        </div>
      )}
    </div>
  )
}