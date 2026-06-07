import { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { SwitchCamera, X, Check, RotateCcw, Loader2 } from 'lucide-react'
import clsx from 'clsx'

interface CameraCaptureProps {
  onCapture: (file: File) => void
  onClose: () => void
}

type Mode = 'loading' | 'ready' | 'recording' | 'preview' | 'error'

// Prefer an MP4 container when the browser can produce it (best downstream
// compatibility), otherwise fall back to WebM.
function pickMimeType(): string | undefined {
  const candidates = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']

  if (typeof MediaRecorder === 'undefined') return undefined

  return candidates.find((c) => MediaRecorder.isTypeSupported(c))
}

function describeCameraError(error: unknown): string {
  const name = error instanceof Error ? error.name : ''

  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was denied. Allow camera + microphone permissions and try again.'
  }

  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device.'
  }

  if (name === 'NotReadableError') {
    return 'The camera is already in use by another app.'
  }

  return 'Could not start the camera. Please check your browser permissions.'
}

function formatElapsed(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60

  return `${m}:${s.toString().padStart(2, '0')}`
}

export const CameraCapture = ({ onCapture, onClose }: CameraCaptureProps) => {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const fileRef = useRef<File | null>(null)

  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user')
  const [mode, setMode] = useState<Mode>('loading')
  const [error, setError] = useState<string>('')
  const [elapsed, setElapsed] = useState(0)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const startCamera = useCallback(async () => {
    setMode('loading')
    stopStream()

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream

      if (videoRef.current) {
        videoRef.current.srcObject = stream
        videoRef.current.muted = true
        await videoRef.current.play().catch(() => undefined)
      }

      setMode('ready')
    } catch (e) {
      setError(describeCameraError(e))
      setMode('error')
    }
  }, [facingMode, stopStream])

  // (Re)start the stream whenever the facing mode changes; tear down on unmount.
  useEffect(() => {
    void startCamera()

    return () => { stopStream() }
  }, [startCamera, stopStream])

  // Recording timer.
  useEffect(() => {
    if (mode !== 'recording') return

    const id = window.setInterval(() => { setElapsed((s) => s + 1) }, 1000)

    return () => { window.clearInterval(id) }
  }, [mode])

  // Revoke the preview object URL when it changes/unmounts.
  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  const startRecording = () => {
    if (!streamRef.current) return

    chunksRef.current = []
    const mimeType = pickMimeType()
    const recorder = new MediaRecorder(streamRef.current, mimeType ? { mimeType } : undefined)

    recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
    recorder.onstop = () => {
      const type = mimeType ?? 'video/webm'
      const blob = new Blob(chunksRef.current, { type })
      const ext = type.includes('mp4') ? 'mp4' : 'webm'
      fileRef.current = new File([blob], `recording-${Date.now()}.${ext}`, { type })
      setPreviewUrl(URL.createObjectURL(blob))
      setMode('preview')
    }

    recorderRef.current = recorder
    recorder.start()
    setElapsed(0)
    setMode('recording')
  }

  const stopRecording = () => { recorderRef.current?.stop() }

  const confirmCapture = () => {
    if (fileRef.current) onCapture(fileRef.current)
    stopStream()
    onClose()
  }

  const retake = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setPreviewUrl(null)
    fileRef.current = null
    void startCamera()
  }

  const cancel = () => {
    stopStream()
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-black/95 backdrop-blur-sm flex flex-col fade-in safe-b">
      {/* Top bar */}
      <div className="flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <button
          onClick={cancel}
          className="tap p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
          aria-label="Close camera"
        >
          <X className="w-5 h-5" />
        </button>

        {mode === 'recording' && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/50 border border-white/10">
            <span className="w-2.5 h-2.5 rounded-full bg-[var(--color-error)] animate-pulse" />
            <span className="text-sm font-semibold text-white tabular-nums">{formatElapsed(elapsed)}</span>
          </div>
        )}

        {(mode === 'ready' || mode === 'loading') && (
          <button
            onClick={() => { setFacingMode((m) => (m === 'user' ? 'environment' : 'user')) }}
            className="tap p-2.5 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors"
            aria-label="Switch camera"
          >
            <SwitchCamera className="w-5 h-5" />
          </button>
        )}

        {(mode === 'preview' || mode === 'error') && <span className="w-10" />}
      </div>

      {/* Stage */}
      <div className="relative flex-1 flex items-center justify-center overflow-hidden">
        {mode === 'error' ? (
          <div className="max-w-sm mx-auto text-center px-6">
            <div className="inline-flex p-4 rounded-2xl bg-[var(--color-error)]/15 border border-[var(--color-error)]/30 mb-4">
              <X className="w-8 h-8 text-[var(--color-error)]" />
            </div>
            <p className="text-white/90 mb-6">{error}</p>
            <button onClick={() => void startCamera()} className="tap brand-gradient px-6 py-3 rounded-xl font-semibold text-white shadow-lg shadow-brand-900/40">
              Try Again
            </button>
          </div>
        ) : (
          <>
            {/* Live preview (hidden while reviewing the recording) */}
            <video
              ref={videoRef}
              playsInline
              autoPlay
              muted
              className={clsx(
                'w-full h-full object-cover transition-opacity duration-300',
                facingMode === 'user' && '-scale-x-100',
                mode === 'preview' ? 'opacity-0 absolute' : 'opacity-100'
              )}
            />

            {mode === 'preview' && previewUrl && (
              <video src={previewUrl} controls autoPlay loop playsInline className="w-full h-full object-contain bg-black" />
            )}

            {mode === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80">
                <Loader2 className="w-8 h-8 animate-spin" />
                <p className="text-sm">Starting camera…</p>
              </div>
            )}
          </>
        )}
      </div>

      {/* Controls */}
      {mode !== 'error' && (
        <div className="px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-4">
          {mode === 'preview' ? (
            <div className="flex items-center justify-center gap-4">
              <button onClick={retake} className="tap flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 text-white font-semibold hover:bg-white/20 transition-colors">
                <RotateCcw className="w-5 h-5" /> Retake
              </button>
              <button onClick={confirmCapture} className="tap flex items-center gap-2 px-7 py-3.5 rounded-xl brand-gradient text-white font-semibold shadow-lg shadow-brand-900/40 hover:-translate-y-0.5 transition-transform">
                <Check className="w-5 h-5" /> Use Video
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-center">
              <button
                onClick={mode === 'recording' ? stopRecording : startRecording}
                disabled={mode === 'loading'}
                aria-label={mode === 'recording' ? 'Stop recording' : 'Start recording'}
                className={clsx(
                  'tap relative grid place-items-center w-[4.5rem] h-[4.5rem] rounded-full border-4 border-white/80 transition-all duration-300',
                  mode === 'loading' ? 'opacity-50' : 'hover:border-white active:scale-90'
                )}
              >
                <span
                  className={clsx(
                    'bg-[var(--color-error)] transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]',
                    mode === 'recording' ? 'w-7 h-7 rounded-md' : 'w-14 h-14 rounded-full'
                  )}
                />
              </button>
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
