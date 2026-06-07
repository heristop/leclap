import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, XCircle, AlertTriangle, Info, Monitor, Globe, ChevronDown, Lightbulb } from 'lucide-react'
import clsx from 'clsx'
import { Button, Card, Badge } from '@/presentation/components/ui'

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
  { name: 'WebAssembly', status: 'checking', description: 'Required for FFmpeg processing', required: true },
  { name: 'SharedArrayBuffer', status: 'checking', description: 'Required for multi-threaded processing', required: true },
  { name: 'Cross-Origin Isolation', status: 'checking', description: 'Required for SharedArrayBuffer support', required: true },
  { name: 'File API', status: 'checking', description: 'Required for file uploads', required: true },
  { name: 'Web Workers', status: 'checking', description: 'Allows background processing', required: false },
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

  if (userAgent.includes('Chrome')) return resolveChrome(userAgent)

  if (userAgent.includes('Firefox')) return resolveFirefox(userAgent)

  if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) return resolveSafari(userAgent)

  return { name: 'Unknown', version: 'Unknown' }
}

const getBrowserIcon = (name: string) => {
  switch (name) {
    case 'Safari': return Globe
    case 'Firefox': return Monitor
    case 'Chrome': return Monitor
    default: return Info
  }
}

const statusColor: Record<CompatibilityCheck['status'], string> = {
  supported: 'text-[var(--color-success)]',
  unsupported: 'text-[var(--color-error)]',
  partial: 'text-[var(--color-warning)]',
  checking: 'text-gray-500',
}

const CheckItem = ({ check }: { check: CompatibilityCheck }) => (
  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-foreground/[0.03] border border-foreground/10">
    <span className={clsx('shrink-0', statusColor[check.status])}>
      {check.status === 'supported' && <CheckCircle2 className="w-4 h-4" />}
      {check.status === 'unsupported' && <XCircle className="w-4 h-4" />}
      {check.status === 'partial' && <AlertTriangle className="w-4 h-4" />}
      {check.status === 'checking' && <span className="block w-4 h-4 border-2 border-gray-500 border-t-transparent rounded-full animate-spin" />}
    </span>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-foreground truncate">{check.name}</p>
        {check.required && (
          <Badge variant="neutral" className="px-1.5 py-0.5 text-[0.6rem] tracking-wide text-gray-500 rounded">
            Required
          </Badge>
        )}
      </div>
      <p className="text-xs text-gray-500">{check.description}</p>
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
    <div className="p-3.5 rounded-xl bg-brand-500/[0.06] border border-brand-500/20">
      <h4 className="flex items-center gap-1.5 text-sm font-semibold text-brand-600 dark:text-brand-300 mb-2">
        <Lightbulb className="w-4 h-4" /> Recommendations
      </h4>
      <ul className="text-sm text-gray-400 space-y-1">
        {browserInfo?.recommendation && <li>• {browserInfo.recommendation}</li>}
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
  <div className={clsx('grid transition-all duration-300 ease-in-out', isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0')}>
    <div className="overflow-hidden">
      <div className="p-4 pt-0 space-y-4 border-t border-foreground/10">
        <div className="pt-4">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="font-medium text-gray-400">{supportedCount}/{checks.length} features supported</span>
            <span className={clsx('font-semibold', overallStatus === 'supported' ? 'text-[var(--color-success)]' : 'text-[var(--color-warning)]')}>
              {Math.round((supportedCount / checks.length) * 100)}%
            </span>
          </div>
          <div className="w-full h-1.5 bg-foreground/10 rounded-full overflow-hidden">
            <div
              className={clsx('h-full rounded-full transition-all duration-500', overallStatus === 'supported' ? 'bg-[var(--color-success)]' : 'bg-[var(--color-warning)]')}
              style={{ width: `${(supportedCount / checks.length) * 100}%` }}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {checks.map((check) => (<CheckItem key={check.name} check={check} />))}
        </div>

        <Recommendations browserInfo={browserInfo} overallStatus={overallStatus} />
      </div>
    </div>
  </div>
)

export const BrowserCompatibility = () => {
  const [checks, setChecks] = useState<CompatibilityCheck[]>(INITIAL_CHECKS)
  const [browserInfo, setBrowserInfo] = useState<BrowserInfo | null>(null)
  const [isExpanded, setIsExpanded] = useState(false)
  const checksRef = useRef(checks)

  useEffect(() => {
    const timer = setTimeout(() => {
      const newChecks = runCompatibilityChecks(checksRef.current)
      setChecks(newChecks)
      setBrowserInfo(detectBrowser())
    }, 500)

    return () => { clearTimeout(timer) }
  }, [])

  const supportedCount = checks.filter((check) => check.status === 'supported').length
  const requiredCount = checks.filter((check) => check.required).length
  const requiredSupported = checks.filter((check) => check.required && check.status === 'supported').length
  const overallStatus: 'supported' | 'partial' = requiredSupported === requiredCount ? 'supported' : 'partial'
  const isOk = overallStatus === 'supported'

  const BrowserIcon = browserInfo ? getBrowserIcon(browserInfo.name) : Info

  return (
    <div className="mb-8 fade-in">
      <Card
        elevation="flat"
        className={clsx(
          'transition-colors duration-300 overflow-hidden',
          isOk ? 'bg-[var(--color-success)]/[0.07] border-[var(--color-success)]/25' : 'bg-[var(--color-warning)]/[0.07] border-[var(--color-warning)]/25'
        )}
      >
        <Button
          variant="ghost"
          type="button"
          onClick={() => { setIsExpanded(!isExpanded) }}
          aria-expanded={isExpanded}
          className="flex w-full items-center justify-between gap-4 p-4 text-left rounded-2xl rounded-b-none font-normal hover:bg-foreground/[0.03] [&_svg]:size-auto"
        >
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={clsx(
                'grid place-items-center w-10 h-10 rounded-xl shadow-sm shrink-0',
                isOk ? 'bg-[var(--color-success)] shadow-[var(--color-success)]/20' : 'bg-[var(--color-warning)] shadow-[var(--color-warning)]/20'
              )}
            >
              {isOk ? <CheckCircle2 className="w-5 h-5 text-white" /> : <AlertTriangle className="w-5 h-5 text-white" />}
            </span>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground">Browser compatibility</h3>
              <p className="text-xs text-gray-400 truncate">
                {isOk ? 'All systems go — ready to render locally' : 'Some features may be limited'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {browserInfo && (
              <Badge variant="neutral" className="hidden sm:inline-flex gap-1.5 text-xs normal-case tracking-normal font-normal text-gray-400 px-3 py-1.5">
                <BrowserIcon className="w-3.5 h-3.5" />
                {browserInfo.name} {browserInfo.version}
              </Badge>
            )}
            <ChevronDown className={clsx('w-5 h-5 text-gray-400 transition-transform duration-300', isExpanded && 'rotate-180')} />
          </div>
        </Button>

        <ExpandedContent
          checks={checks}
          supportedCount={supportedCount}
          overallStatus={overallStatus}
          isExpanded={isExpanded}
          browserInfo={browserInfo}
        />
      </Card>
    </div>
  )
}
