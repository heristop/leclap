import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, Monitor, Globe, ChevronDown, ChevronUp } from 'lucide-react'
import clsx from 'clsx'

interface CompatibilityCheck {
  name: string
  status: 'supported' | 'unsupported' | 'partial' | 'checking'
  description: string
  required: boolean
}

interface BrowserInfo {
  name: string
  version: string
  recommendation?: string
}

const INITIAL_CHECKS: CompatibilityCheck[] = [
  {
    name: 'WebAssembly',
    status: 'checking',
    description: 'Required for FFmpeg processing',
    required: true
  },
  {
    name: 'SharedArrayBuffer',
    status: 'checking',
    description: 'Required for multi-threaded processing',
    required: true
  },
  {
    name: 'Cross-Origin Isolation',
    status: 'checking',
    description: 'Required for SharedArrayBuffer support',
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
    description: 'Allows background processing',
    required: false
  }
]

const runCompatibilityChecks = (current: CompatibilityCheck[]): CompatibilityCheck[] => {
  const newChecks = [...current]
  newChecks[0] = { ...newChecks[0], status: typeof WebAssembly === 'object' ? 'supported' : 'unsupported' }
  newChecks[1] = { ...newChecks[1], status: typeof SharedArrayBuffer === 'undefined' ? 'unsupported' : 'supported' }
  newChecks[2] = { ...newChecks[2], status: crossOriginIsolated ? 'supported' : 'unsupported' }
  newChecks[3] = { ...newChecks[3], status: typeof File !== 'undefined' && typeof FileReader !== 'undefined' ? 'supported' : 'unsupported' }
  newChecks[4] = { ...newChecks[4], status: typeof Worker === 'undefined' ? 'unsupported' : 'supported' }

  return newChecks
}

const resolveBrowserVersion = (userAgent: string, pattern: RegExp): string =>
  userAgent.match(pattern)?.[1] ?? 'Unknown'

const resolveChrome = (userAgent: string): BrowserInfo => {
  const version = resolveBrowserVersion(userAgent, /Chrome\/(\d+)/)
  const versionNum = parseInt(version, 10)

  return { name: 'Chrome', version, ...(versionNum < 88 && { recommendation: 'Please update to Chrome 88+ for optimal performance' }) }
}

const resolveFirefox = (userAgent: string): BrowserInfo => {
  const version = resolveBrowserVersion(userAgent, /Firefox\/(\d+)/)
  const versionNum = parseInt(version, 10)

  return { name: 'Firefox', version, ...(versionNum < 79 && { recommendation: 'Please update to Firefox 79+ for optimal performance' }) }
}

const resolveSafari = (userAgent: string): BrowserInfo => {
  const version = resolveBrowserVersion(userAgent, /Version\/(\d+)/)
  const versionNum = parseInt(version, 10)

  return { name: 'Safari', version, ...(versionNum < 14 && { recommendation: 'Please update to Safari 14+ for optimal performance' }) }
}

const detectBrowser = (): BrowserInfo => {
  const userAgent = navigator.userAgent

  if (userAgent.includes('Chrome')) {
    return resolveChrome(userAgent)
  }

  if (userAgent.includes('Firefox')) {
    return resolveFirefox(userAgent)
  }

  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    return resolveSafari(userAgent)
  }

  return { name: 'Unknown', version: 'Unknown' }
}

const getBrowserIcon = (name: string) => {
  switch (name) {
    case 'Chrome': return Monitor
    case 'Safari': return Globe
    case 'Firefox': return Monitor
    default: return Info
  }
}

interface CheckItemProps {
  check: CompatibilityCheck
}

const CheckItem = ({ check }: CheckItemProps) => (
  <div className="flex items-center space-x-3 p-2 rounded-lg bg-gray-800/40 border border-white/5">
    <div className={clsx(
      'flex-shrink-0',
      check.status === 'supported' && 'text-green-400',
      check.status === 'unsupported' && 'text-red-400',
      check.status === 'partial' && 'text-yellow-400',
      check.status === 'checking' && 'text-gray-500'
    )}>
      {check.status === 'supported' && <CheckCircle2 className="w-4 h-4" />}
      {check.status === 'unsupported' && <XCircle className="w-4 h-4" />}
      {check.status === 'partial' && <AlertTriangle className="w-4 h-4" />}
      {check.status === 'checking' && <div className="w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center space-x-2">
        <p className="text-sm font-medium text-gray-200 truncate">
          {check.name}
        </p>
        {check.required && (
          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-red-900/30 text-red-300 border border-red-500/20 rounded">
            Required
          </span>
        )}
      </div>
      <p className="text-xs text-gray-500">
        {check.description}
      </p>
    </div>
  </div>
)

interface RecommendationsProps {
  browserInfo: BrowserInfo | null
  overallStatus: 'supported' | 'partial'
}

const Recommendations = ({ browserInfo, overallStatus }: RecommendationsProps) => {
  if (!browserInfo?.recommendation && overallStatus === 'supported') {
    return null
  }

  return (
    <div className="p-3 bg-blue-900/20 border border-blue-500/30 rounded-lg">
      <h4 className="text-sm font-medium text-blue-300 mb-2">
        💡 Recommendations
      </h4>
      <ul className="text-sm text-blue-200/70 space-y-1">
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
  )
}

interface ExpandedContentProps {
  checks: CompatibilityCheck[]
  supportedCount: number
  overallStatus: 'supported' | 'partial'
  isExpanded: boolean
  browserInfo: BrowserInfo | null
}

const ExpandedContent = ({ checks, supportedCount, overallStatus, isExpanded, browserInfo }: ExpandedContentProps) => (
  <div className={clsx(
    'transition-all duration-300 ease-in-out overflow-hidden',
    isExpanded ? 'max-h-[500px] opacity-100 border-t border-white/5' : 'max-h-0 opacity-0'
  )}>
    <div className="p-4 space-y-4">
      {/* Progress Bar */}
      <div>
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="font-medium text-gray-300">
            {supportedCount}/{checks.length} features supported
          </span>
          <span className={clsx(
            'font-semibold',
            overallStatus === 'supported' ? 'text-green-400' : 'text-yellow-400'
          )}>
            {Math.round((supportedCount / checks.length) * 100)}%
          </span>
        </div>
        <div className="w-full h-1.5 bg-gray-700 rounded-full overflow-hidden">
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
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {checks.map((check) => (
          <CheckItem key={check.name} check={check} />
        ))}
      </div>

      {/* Recommendations */}
      <Recommendations browserInfo={browserInfo} overallStatus={overallStatus} />
    </div>
  </div>
)

export const BrowserCompatibility = () => {
  const [checks, setChecks] = useState<CompatibilityCheck[]>(INITIAL_CHECKS)
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null)
  const [isVisible, setIsVisible] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const checksRef = useRef(checks)

  useEffect(() => {
    // Delay checks slightly to avoid flash during page load
    const timer = setTimeout(() => {
      const newChecks = runCompatibilityChecks(checksRef.current)
      setChecks(newChecks)

      // Auto-hide if all required checks pass
      const allRequiredPassed = newChecks.every(check => !check.required || check.status === 'supported')

      if (allRequiredPassed) {
        setTimeout(() => {
          setIsVisible(false)
        }, 3000)
      }

      setBrowserInfo(detectBrowser())
    }, 500)

    return () => {
      clearTimeout(timer)
    }
  }, [])

  if (!isVisible) return null

  const supportedCount = checks.filter(check => check.status === 'supported').length
  const requiredCount = checks.filter(check => check.required).length
  const requiredSupported = checks.filter(check => check.required && check.status === 'supported').length

  const overallStatus: 'supported' | 'partial' = requiredSupported === requiredCount ? 'supported' : 'partial'

  const BrowserIcon = browserInfo ? getBrowserIcon(browserInfo.name) : Info

  return (
    <div className="mb-8 fade-in">
      <div className={clsx(
        'rounded-xl border transition-all duration-300 backdrop-blur-sm overflow-hidden',
        overallStatus === 'supported'
          ? 'bg-green-900/20 border-green-500/30'
          : 'bg-yellow-900/20 border-yellow-500/30'
      )}>
        {/* Header - Always Visible */}
        <div
          className="flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 transition-colors"
          onClick={() => { setIsExpanded(!isExpanded); }}
        >
          <div className="flex items-center space-x-3">
            <div className={clsx(
              'p-2 rounded-lg shadow-lg',
              overallStatus === 'supported' ? 'bg-green-600 shadow-green-500/20' : 'bg-yellow-600 shadow-yellow-500/20'
            )}>
              {overallStatus === 'supported' ? (
                <CheckCircle2 className="w-5 h-5 text-white" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-white" />
              )}
            </div>
            <div>
              <h3 className="text-base font-semibold text-white">
                Browser Compatibility
              </h3>
              <p className="text-xs text-gray-400">
                {overallStatus === 'supported'
                  ? 'All systems go'
                  : 'Some features may be limited'
                }
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Browser Info */}
            {browserInfo && (
              <div className="hidden sm:flex items-center space-x-2 text-xs text-gray-400 bg-gray-800/50 px-3 py-1.5 rounded-full border border-white/5">
                <BrowserIcon className="w-3 h-3" />
                <span>{browserInfo.name} {browserInfo.version}</span>
              </div>
            )}

            {isExpanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>

        {/* Expanded Content */}
        <ExpandedContent
          checks={checks}
          supportedCount={supportedCount}
          overallStatus={overallStatus}
          isExpanded={isExpanded}
          browserInfo={browserInfo}
        />
      </div>
    </div>
  )
}
