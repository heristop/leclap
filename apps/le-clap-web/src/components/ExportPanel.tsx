import { useState, useRef, startTransition } from 'react'
import { Download, Play, Pause, Share2, Copy, Check, FileVideo, HardDrive } from 'lucide-react'
import clsx from 'clsx'

interface ProcessedVideo {
  blob: Blob
  url: string
  size: number
  duration?: number
}

interface ExportPanelProps {
  processedVideo: ProcessedVideo
}

export const ExportPanel = ({ processedVideo }: ExportPanelProps) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [showCopied, setShowCopied] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState(0)
  const videoRef = useRef<HTMLVideoElement>(null)

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = Math.floor(seconds % 60)
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`
  }

  const handlePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause()
      } else {
        videoRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleDownload = () => {
    // Simulate download progress for better UX
    setDownloadProgress(0)
    const interval = setInterval(() => {
      setDownloadProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval)
          return 100
        }
        return prev + 10
      })
    }, 50)

    // Actual download
    const link = document.createElement('a')
    link.href = processedVideo.url
    link.download = `processed-video-${Date.now()}.mp4`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)

    setTimeout(() => setDownloadProgress(0), 2000)
  }

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(processedVideo.url)
      startTransition(() => {
        setShowCopied(true)
      })
      setTimeout(() => setShowCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  const handleShare = async () => {
    if (navigator.share) {
      try {
        const file = new File([processedVideo.blob], 'processed-video.mp4', {
          type: 'video/mp4'
        })
        await navigator.share({
          title: 'Processed Video',
          text: 'Check out this video I created with FFmpeg Video Composer!',
          files: [file]
        })
      } catch (err) {
        console.error('Error sharing:', err)
      }
    }
  }

  return (
    <div className="space-y-6 fade-in">
      {/* Video Preview */}
      <div className="relative bg-black rounded-lg overflow-hidden shadow-xl">
        <video
          ref={videoRef}
          src={processedVideo.url}
          className="w-full h-auto max-h-96 object-contain"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          controls={false}
          preload="metadata"
        />

        {/* Custom Play/Pause Overlay */}
        <div className="absolute inset-0 flex items-center justify-center">
          <button
            onClick={handlePlayPause}
            className="p-4 bg-black/50 rounded-full text-white hover:bg-black/70 transition-all duration-200 hover:scale-110"
          >
            {isPlaying ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 ml-1" />
            )}
          </button>
        </div>

        {/* Video Controls Bar */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4">
          <div className="flex items-center justify-between text-white text-sm">
            <div className="flex items-center space-x-2">
              <FileVideo className="w-4 h-4" />
              <span>Processed Video</span>
            </div>
            {processedVideo.duration && (
              <span>{formatDuration(processedVideo.duration)}</span>
            )}
          </div>
        </div>
      </div>

      {/* Video Information */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <HardDrive className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">File Size</p>
            <p className="text-lg font-semibold text-blue-600">
              {formatFileSize(processedVideo.size)}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <FileVideo className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">Format</p>
            <p className="text-lg font-semibold text-green-600">MP4</p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        {/* Primary Download Button */}
        <button
          onClick={handleDownload}
          disabled={downloadProgress > 0 && downloadProgress < 100}
          className={clsx(
            'w-full flex items-center justify-center space-x-3 px-6 py-4 rounded-xl font-semibold text-lg transition-all duration-200',
            'bg-gradient-to-r from-green-500 to-emerald-600 text-white hover:from-green-600 hover:to-emerald-700',
            'focus:outline-none focus:ring-4 focus:ring-green-200 hover:scale-105 shadow-lg hover:shadow-xl',
            downloadProgress > 0 && downloadProgress < 100 && 'cursor-wait opacity-75'
          )}
        >
          <div className="p-2 bg-white/20 rounded-lg">
            <Download className="w-6 h-6" />
          </div>
          <span>
            {downloadProgress > 0 && downloadProgress < 100
              ? `Downloading... ${downloadProgress}%`
              : 'Download Video'
            }
          </span>
        </button>

        {/* Progress Bar for Download */}
        {downloadProgress > 0 && downloadProgress < 100 && (
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-emerald-600 transition-all duration-300"
              style={{ width: `${downloadProgress}%` }}
            />
          </div>
        )}

        {/* Secondary Actions */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleCopyLink}
            className={clsx(
              'flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200',
              'border-2 border-gray-300 text-gray-700 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50',
              showCopied && 'border-green-400 text-green-600 bg-green-50'
            )}
          >
            {showCopied ? (
              <>
                <Check className="w-4 h-4" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Link</span>
              </>
            )}
          </button>

          {'share' in navigator && (
            <button
              onClick={handleShare}
              className="flex items-center justify-center space-x-2 px-4 py-3 rounded-lg font-medium transition-all duration-200 border-2 border-gray-300 text-gray-700 hover:border-brand-400 hover:text-brand-600 hover:bg-brand-50"
            >
              <Share2 className="w-4 h-4" />
              <span>Share</span>
            </button>
          )}
        </div>
      </div>

      {/* Success Message */}
      <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
        <h4 className="font-semibold text-green-800 mb-2">
          🎉 Video Processing Complete!
        </h4>
        <ul className="text-sm text-green-700 space-y-1">
          <li>• Your video has been processed successfully</li>
          <li>• All processing was done locally in your browser</li>
          <li>• No data was sent to external servers</li>
          <li>• You can download and share your video now</li>
        </ul>
      </div>
    </div>
  )
}