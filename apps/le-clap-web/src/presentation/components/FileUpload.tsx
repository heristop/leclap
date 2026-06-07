import { useState, startTransition } from 'react'
import { useDropzone, type FileRejection } from 'react-dropzone'
import { Upload, X, File, AlertCircle, Video as VideoIcon } from 'lucide-react'
import clsx from 'clsx'
import { CameraCapture } from '@/presentation/components/CameraCapture'
import { Button, Card, Badge } from '@/presentation/components/ui'

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
    <Card elevation="flat" className="bg-[var(--color-error)]/10 border-[var(--color-error)]/30 rounded-lg p-3 fade-in backdrop-blur-sm">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-[var(--color-error)] mt-0.5 mr-2 flex-shrink-0" />
        <div>
          <h4 className="text-sm font-medium text-[var(--color-error)] mb-1">Upload errors:</h4>
          <ul className="text-sm text-[var(--color-error)]/90 space-y-1">
            {errors.map((error, index) => (
              <li key={index}>• {error}</li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
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
      className="flex items-center justify-between p-3 bg-surface/40 rounded-lg border border-foreground/5 hover:bg-surface/60 transition-colors backdrop-blur-sm"
    >
      <div className="flex items-center space-x-3">
        <div className="p-2 bg-brand-500/15 rounded-lg border border-brand-500/25">
          <File className="w-4 h-4 text-brand-700 dark:text-brand-300" />
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

      <Button
        variant="ghost"
        size="icon"
        onClick={() => { onRemove(index) }}
        className="p-1 text-gray-500 hover:text-[var(--color-error)] [&_svg]:size-4"
        aria-label={`Remove ${file.name}`}
      >
        <X />
      </Button>
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
      aria-label="Upload video files"
      className={clsx(
        'relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer fade-in backdrop-blur-sm',
        isDragActive || dragActive
          ? 'border-brand-500 bg-brand-900/20 scale-[1.02] shadow-lg shadow-brand-500/10'
          : 'border-foreground/10 hover:border-brand-500/50 hover:bg-surface/40',
        uploadedFiles.length >= maxFiles && 'opacity-50 cursor-not-allowed'
      )}
    >
      <input {...getInputProps()} aria-label="Upload video files" />

      <div className="flex flex-col items-center space-y-4">
        <div className={clsx(
          'p-4 rounded-full transition-all duration-300 shadow-lg',
          isDragActive || dragActive
            ? 'bg-brand-600 text-foreground scale-110 shadow-brand-500/30'
            : 'bg-surface text-gray-400 shadow-black/20'
        )}>
          <Upload className="w-8 h-8" />
        </div>

        <div>
          <p className="text-lg font-medium text-foreground">
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
          <Badge variant="success" className="normal-case tracking-normal">
            {uploadedFiles.length}/{maxFiles} files
          </Badge>
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
        <span className="flex-1 h-px bg-foreground/10" />
        or
        <span className="flex-1 h-px bg-foreground/10" />
      </div>

      <Button
        type="button"
        variant="outline"
        onClick={() => { setShowCamera(true) }}
        disabled={atCapacity}
        className={clsx(
          'group w-full px-6 py-4',
          !atCapacity && 'border-brand-500/30 bg-brand-500/10 text-brand-700 dark:text-brand-200 hover:bg-brand-500/20 hover:border-brand-500/50 hover:-translate-y-0.5'
        )}
      >
        <VideoIcon className="transition-transform duration-300 group-hover:scale-110" />
        Record with camera
      </Button>

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
