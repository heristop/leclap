import { useState, startTransition } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Upload, X, File, AlertCircle, Video as VideoIcon } from 'lucide-react'
import clsx from 'clsx'
import { CameraCapture } from './CameraCapture'

interface FileUploadProps {
  onFilesUploaded: (files: File[]) => void
  uploadedFiles: File[]
  maxFiles?: number
  maxSizeInMB?: number
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface UploadErrorsProps {
  errors: string[]
}

function UploadErrors({ errors }: UploadErrorsProps) {
  if (errors.length === 0) return null

  return (
    <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-3 fade-in backdrop-blur-sm">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-red-400 mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-red-300 mb-1">Upload errors:</h4>
          <ul className="text-sm text-red-400 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

interface UploadedFileItemProps {
  file: File
  index: number
  onRemove: (index: number) => void
}

function UploadedFileItem({ file, index, onRemove }: UploadedFileItemProps) {
  return (
    <div
      className="flex items-center justify-between p-3 bg-gray-800/40 rounded-lg border border-white/5 hover:bg-gray-800/60 transition-colors backdrop-blur-sm"
    >
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-brand-500/15 rounded-lg border border-brand-500/25">
          <File className="w-4 h-4 text-brand-300" />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-200 truncate max-w-[200px]">
            {file.name}
          </p>
          <p className="text-xs text-gray-400">
            {formatFileSize(file.size)}
          </p>
        </div>
      </div>

      <button
        onClick={() => { onRemove(index) }}
        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
        aria-label={`Remove ${file.name}`}
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}

function collectDropErrors(
  rejectedFiles: FileRejection[],
  maxSizeInMB: number,
  maxFiles: number
): string[] {
  const errors: string[] = []

  for (const file of rejectedFiles) {
    for (const error of file.errors) {
      if (error.code === 'file-too-large') {
        errors.push(`${file.file.name} is too large (max ${maxSizeInMB}MB)`)
        continue
      }

      if (error.code === 'file-invalid-type') {
        errors.push(`${file.file.name} is not a valid video file`)
        continue
      }

      if (error.code === 'too-many-files') {
        errors.push(`Too many files. Maximum ${maxFiles} files allowed`)
        continue
      }
    }
  }

  return errors
}

interface DropZoneProps {
  getRootProps: () => Record<string, unknown>
  getInputProps: () => Record<string, unknown>
  isDragActive: boolean
  dragActive: boolean
  uploadedFiles: File[]
  maxFiles: number
  maxSizeInMB: number
}

function DropZone({
  getRootProps,
  getInputProps,
  isDragActive,
  dragActive,
  uploadedFiles,
  maxFiles,
  maxSizeInMB
}: DropZoneProps) {
  return (
    <div
      {...getRootProps()}
      className={clsx(
        'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer fade-in backdrop-blur-sm',
        isDragActive || dragActive
          ? 'border-brand-500 bg-brand-900/20 scale-[1.02] shadow-lg shadow-brand-500/10'
          : 'border-white/10 hover:border-brand-500/50 hover:bg-gray-800/40',
        uploadedFiles.length >= maxFiles && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input {...getInputProps()} />

      <div className="flex flex-col items-center space-y-4">
        <div className={clsx(
          'p-4 rounded-full transition-all duration-300 shadow-lg',
          isDragActive || dragActive
            ? 'bg-brand-600 text-white scale-110 shadow-brand-500/30'
            : 'bg-gray-800 text-gray-400 shadow-black/20'
        )}>
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <p className="text-lg font-medium text-white">
            {isDragActive ? 'Drop the files here' : 'Drag & drop video files here'}
          </p>
          <p className="text-sm text-gray-400 mt-1">
            or click to browse files ({maxFiles - uploadedFiles.length} remaining)
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Supports MP4, AVI, MOV, MKV, WebM • Max {maxSizeInMB}MB per file
          </p>
        </div>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="absolute top-2 right-2">
          <div className="bg-green-900/30 text-green-400 border border-green-500/30 text-xs px-2 py-1 rounded-full">
            {uploadedFiles.length}/{maxFiles} files
          </div>
        </div>
      )}
    </div>
  )
}

export const FileUpload = ({
  onFilesUploaded,
  uploadedFiles,
  maxFiles = 5,
  maxSizeInMB = 100
}: FileUploadProps) => {
  const [dragActive, setDragActive] = useState(false)
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [showCamera, setShowCamera] = useState(false)

  const atCapacity = uploadedFiles.length >= maxFiles

  const handleCameraCapture = (file: File) => {
    setUploadErrors([])
    startTransition(() => {
      onFilesUploaded([...uploadedFiles, file].slice(0, maxFiles))
    })
  }

  const onDrop = (acceptedFiles: File[], rejectedFiles: FileRejection[]) => {
    const errors = collectDropErrors(rejectedFiles, maxSizeInMB, maxFiles)

    if (errors.length > 0) {
      setUploadErrors(errors)

      return
    }

    setUploadErrors([])

    startTransition(() => {
      const newFiles = [...uploadedFiles, ...acceptedFiles].slice(0, maxFiles)
      onFilesUploaded(newFiles)
    })
  }

  const removeFile = (indexToRemove: number) => {
    startTransition(() => {
      const newFiles = uploadedFiles.filter((_, index) => index !== indexToRemove)
      onFilesUploaded(newFiles)
    })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'video/*': ['.mp4', '.avi', '.mov', '.mkv', '.webm']
    },
    maxFiles: maxFiles - uploadedFiles.length,
    maxSize: maxSizeInMB * 1024 * 1024,
    multiple: true,
    onDragEnter: () => { setDragActive(true) },
    onDragLeave: () => { setDragActive(false) }
  })

  return (
    <div className="space-y-4">
      <DropZone
        getRootProps={getRootProps}
        getInputProps={getInputProps}
        isDragActive={isDragActive}
        dragActive={dragActive}
        uploadedFiles={uploadedFiles}
        maxFiles={maxFiles}
        maxSizeInMB={maxSizeInMB}
      />

      {/* Record-with-camera alternative to uploading a file. */}
      <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-gray-500">
        <span className="flex-1 h-px bg-white/10" />
        or
        <span className="flex-1 h-px bg-white/10" />
      </div>

      <button
        type="button"
        onClick={() => { setShowCamera(true) }}
        disabled={atCapacity}
        className={clsx(
          'tap group w-full flex items-center justify-center gap-3 rounded-xl px-6 py-4 font-semibold transition-all duration-300',
          atCapacity
            ? 'bg-gray-800 text-gray-500 cursor-not-allowed border border-white/5'
            : 'border border-brand-500/30 bg-brand-500/10 text-brand-200 hover:bg-brand-500/20 hover:border-brand-500/50 hover:-translate-y-0.5'
        )}
      >
        <VideoIcon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
        Record with camera
      </button>

      <UploadErrors errors={uploadErrors} />

      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => { setShowCamera(false) }} />
      )}

      {uploadedFiles.length > 0 && (
        <div className="space-y-2 fade-in">
          <h4 className="text-sm font-medium text-gray-300">Uploaded Files:</h4>
          <div className="space-y-2">
            {uploadedFiles.map((file, index) => (
              <UploadedFileItem
                key={`${file.name}-${index}`}
                file={file}
                index={index}
                onRemove={removeFile}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
