import { useState, useEffect } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, Monitor, Globe } from 'lucide-react'
import clsx from 'clsx'

interface CompatibilityCheck {
  name: string
  status: 'supported' | 'unsupported' | 'partial' | 'checking'
  description: string
  required: boolean
}

export const BrowserCompatibility = () => {
  const [checks, setChecks] = useState<CompatibilityCheck[]>([
    {
      name: 'WebAssembly',
      status: 'checking',
      description: 'Required for FFmpeg processing',
      required: true
    },
    {
      name: 'SharedArrayBuffer',
      status: 'checking',
      description: 'Enables multi-threaded processing',
      required: true
    },
    {
      name: 'Cross-Origin Isolation',
      status: 'checking',
      description: 'Enables advanced WebAssembly features',
      required: true
    },
    {
      name: 'File API',
      status: 'checking',
      description: 'Required for file uploads',
      required: true
    },
    {
      name: 'Web Workers',
      status: 'checking',
      description: 'Enables background processing',
      required: false
    }
  ])

  const [browserInfo, setBrowserInfo] = useState<{
    name: string
    version: string
    recommendation?: string
  } | null>(null)

  useEffect(() => {
    const runCompatibilityChecks = () => {
      const newChecks = [...checks]

      // WebAssembly check
      newChecks[0].status = typeof WebAssembly === 'object' ? 'supported' : 'unsupported'

      // SharedArrayBuffer check
      newChecks[1].status = typeof SharedArrayBuffer !== 'undefined' ? 'supported' : 'unsupported'

      // Cross-Origin Isolation check
      newChecks[2].status = crossOriginIsolated ? 'supported' : 'unsupported'

      // File API check
      newChecks[3].status = (window.File && window.FileReader && window.FileList && window.Blob)
        ? 'supported' : 'unsupported'

      // Web Workers check
      newChecks[4].status = typeof Worker !== 'undefined' ? 'supported' : 'unsupported'

      setChecks(newChecks)
    }

    const detectBrowser = () => {
      const userAgent = navigator.userAgent
      let browser: { name: string; version: string; recommendation?: string } = { name: 'Unknown', version: 'Unknown' }

      if (userAgent.includes('Chrome')) {
        const match = userAgent.match(/Chrome\/(\d+)/)
        browser = {
          name: 'Chrome',
          version: match ? match[1] : 'Unknown',
          ...(parseInt(match?.[1] || '0') < 88 && { recommendation: 'Please update to Chrome 88+ for optimal performance' })
        }
      } else if (userAgent.includes('Firefox')) {
        const match = userAgent.match(/Firefox\/(\d+)/)
        browser = {
          name: 'Firefox',
          version: match ? match[1] : 'Unknown',
          ...(parseInt(match?.[1] || '0') < 79 && { recommendation: 'Please update to Firefox 79+ for optimal performance' })
        }
      } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
        const match = userAgent.match(/Version\/(\d+)/)
        browser = {
          name: 'Safari',
          version: match ? match[1] : 'Unknown',
          ...(parseInt(match?.[1] || '0') < 14 && { recommendation: 'Please update to Safari 14+ for optimal performance' })
        }
      }

      setBrowserInfo(browser)
    }

    // Run checks after a short delay for better UX
    setTimeout(() => {
      runCompatibilityChecks()
      detectBrowser()
    }, 500)
  }, [])

  const supportedCount = checks.filter(check => check.status === 'supported').length
  const requiredCount = checks.filter(check => check.required).length
  const requiredSupported = checks.filter(check => check.required && check.status === 'supported').length

  const overallStatus = requiredSupported === requiredCount ? 'supported' : 'partial'

  const getBrowserIcon = (name: string) => {
    switch (name) {
      case 'Chrome': return Monitor
      case 'Safari': return Globe
      case 'Firefox': return Monitor
      default: return Info
    }
  }

  const BrowserIcon = browserInfo ? getBrowserIcon(browserInfo.name) : Info

  return (
    <div className="mb-8 fade-in">
      <div className={clsx(
        'p-6 rounded-lg border-2 transition-all duration-300',
        overallStatus === 'supported'
          ? 'bg-green-50 border-green-200'
          : 'bg-yellow-50 border-yellow-200'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className={clsx(
              'p-2 rounded-lg',
              overallStatus === 'supported' ? 'bg-green-500' : 'bg-yellow-500'
            )}>
              {overallStatus === 'supported' ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Browser Compatibility
              </h3>
              <p className="text-sm text-gray-600">
                {overallStatus === 'supported'
                  ? 'Your browser supports all required features!'
                  : 'Some features may not work optimally'
                }
              </p>
            </div>
          </div>

          {/* Browser Info */}
          {browserInfo && (
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <BrowserIcon className="w-4 h-4" />
              <span>{browserInfo.name} {browserInfo.version}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="font-medium text-gray-700">
              Compatibility: {supportedCount}/{checks.length} features supported
            </span>
            <span className={clsx(
              'font-semibold',
              overallStatus === 'supported' ? 'text-green-600' : 'text-yellow-600'
            )}>
              {Math.round((supportedCount / checks.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={clsx(
                'h-full transition-all duration-500',
                overallStatus === 'supported'
                  ? 'bg-green-500'
                  : 'bg-yellow-500'
              )}
              style={{ width: `${(supportedCount / checks.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Feature Checks */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          {checks.map((check) => (
            <div key={check.name} className="flex items-center space-x-3 p-2 rounded-lg bg-white/50">
              <div className={clsx(
                'flex-shrink-0',
                check.status === 'supported' && 'text-green-500',
                check.status === 'unsupported' && 'text-red-500',
                check.status === 'partial' && 'text-yellow-500',
                check.status === 'checking' && 'text-gray-400'
              )}>
                {check.status === 'supported' && <CheckCircle2 className="w-4 h-4" />}
                {check.status === 'unsupported' && <XCircle className="w-4 h-4" />}
                {check.status === 'partial' && <AlertTriangle className="w-4 h-4" />}
                {check.status === 'checking' && <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {check.name}
                  </p>
                  {check.required && (
                    <span className="px-1.5 py-0.5 text-xs font-medium bg-red-100 text-red-600 rounded">
                      Required
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  {check.description}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Recommendations */}
        {(browserInfo?.recommendation || overallStatus !== 'supported') && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              💡 Recommendations
            </h4>
            <ul className="text-sm text-blue-700 space-y-1">
              {browserInfo?.recommendation && (
                <li>• {browserInfo.recommendation}</li>
              )}
              {overallStatus !== 'supported' && (
                <>
                  <li>• For best performance, use Chrome 88+, Firefox 79+, or Safari 14+</li>
                  <li>• Ensure your browser supports WebAssembly and SharedArrayBuffer</li>
                  <li>• Some features require HTTPS or localhost for security reasons</li>
                </>
              )}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}