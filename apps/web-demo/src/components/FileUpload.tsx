import { useCallback, useState, startTransition } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, X, File, AlertCircle } from 'lucide-react'
import clsx from 'clsx'

interface FileUploadProps {
  onFilesUploaded: (files: File[]) => void
  uploadedFiles: File[]
  maxFiles?: number
  maxSizeInMB?: number
}

export const FileUpload = ({
  onFilesUploaded,
  uploadedFiles,
  maxFiles = 5,
  maxSizeInMB = 100
}: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    const errors: string[] = []
    rejectedFiles.forEach((file) => {
      file.errors.forEach((error: any) => {
        if (error.code === 'file-too-large') {
          errors.push(`${file.file.name} is too large (max ${maxSizeInMB}MB)`)
        } else if (error.code === 'file-invalid-type') {
          errors.push(`${file.file.name} is not a valid video file`)
        } else if (error.code === 'too-many-files') {
          errors.push(`Too many files. Maximum ${maxFiles} files allowed`)
        }
      })
    })

    if (errors.length > 0) {
      setUploadErrors(errors)
      return
    }

    // Clear any previous errors
    setUploadErrors([])

    // Use startTransition for non-urgent updates
    startTransition(() => {
      const newFiles = [...uploadedFiles, ...acceptedFiles].slice(0, maxFiles)
      onFilesUploaded(newFiles)
    })
  }, [uploadedFiles, onFilesUploaded, maxFiles, maxSizeInMB])

  const removeFile = useCallback((indexToRemove: number) => {
    startTransition(() => {
      const newFiles = uploadedFiles.filter((_, index) => index !== indexToRemove)
      onFilesUploaded(newFiles)
    })
  }, [uploadedFiles, onFilesUploaded])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    maxFiles: maxFiles - uploadedFiles.length,
    maxSize: maxSizeInMB * 1024 * 1024,
    multiple: true,
    onDragEnter: () => setDragActive(true),
    onDragLeave: () => setDragActive(false)
  })

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="space-y-4">
      {/* Drop Zone */}
      <div
        {...getRootProps()}
        className={clsx(
          'relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 cursor-pointer fade-in',
          isDragActive || dragActive
            ? 'border-brand-500 bg-brand-50 scale-[1.02]'
            : 'border-gray-300 hover:border-brand-400 hover:bg-brand-50/50',
          uploadedFiles.length >= maxFiles && 'opacity-50 cursor-not-allowed'
        )}
      >
        <input {...getInputProps()} />

        <div className="flex flex-col items-center space-y-4">
          <div className={clsx(
            'p-3 rounded-full transition-all duration-200',
            isDragActive || dragActive
              ? 'bg-brand-500 text-white scale-110'
              : 'bg-gray-100 text-gray-500'
          )}>
            <Upload className="w-8 h-8" />
          </div>

          <div>
            <p className="text-lg font-medium text-gray-900">
              {isDragActive ? 'Drop the files here' : 'Drag & drop video files here'}
            </p>
            <p className="text-sm text-gray-500 mt-1">
              or click to browse files ({maxFiles - uploadedFiles.length} remaining)
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Supports MP4, AVI, MOV, MKV, WebM • Max {maxSizeInMB}MB per file
            </p>
          </div>
        </div>

        {/* Upload Progress Indicator */}
        {uploadedFiles.length > 0 && (
          <div className="absolute top-2 right-2">
            <div className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
              {uploadedFiles.length}/{maxFiles} files
            </div>
          </div>
        )}
      </div>

      {/* Error Messages */}
      {uploadErrors.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 fade-in">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-medium text-red-800 mb-1">Upload errors:</h4>
              <ul className="text-sm text-red-600 space-y-1">
                {uploadErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Uploaded Files List */}
      {uploadedFiles.length > 0 && (
        <div className="space-y-2 fade-in">
          <h4 className="text-sm font-medium text-gray-900">Uploaded Files:</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <div
                key={`${file.name}-${index}`}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border hover:bg-gray-100 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <File className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 truncate max-w-[200px]">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => removeFile(index)}
                  className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}