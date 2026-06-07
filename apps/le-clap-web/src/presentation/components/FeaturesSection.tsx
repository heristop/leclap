import { FileCode, Users, Cog, Shield, Zap, Globe } from 'lucide-react'
import { Badge, Card, Reveal } from '@/presentation/components/ui'

const features = [
  {
    icon: FileCode,
    title: 'Real JSON Templates',
    description: 'Use actual template files from the core package with complex FFmpeg configurations, filters, and effects.',
    highlight: 'Production-ready',
  },
  {
    icon: Users,
    title: 'Interactive Forms',
    description: 'Dynamic form generation from template definitions with real-time validation and user input processing.',
    highlight: 'Dynamic',
  },
  {
    icon: Cog,
    title: 'Advanced Processing',
    description: 'Full FFmpeg pipeline with video filters, text overlays, transitions, and audio mixing.',
    highlight: 'Professional',
  },
  {
    icon: Shield,
    title: 'Complete Privacy',
    description: 'All processing happens locally in your browser. Your files never leave your device or touch any server.',
    highlight: 'Private',
  },
  {
    icon: Zap,
    title: 'WebAssembly Powered',
    description: 'Lightning-fast video processing using WebAssembly FFmpeg for near-native performance.',
    highlight: 'Fast',
  },
  {
    icon: Globe,
    title: 'Cross-Platform',
    description: 'Works in any modern browser on desktop, mobile, and tablet. No installation required.',
    highlight: 'Universal',
  },
]

export const FeaturesSection = () => {
  return (
    <section id="features" className="relative overflow-hidden py-24">
      {/* Soft, on-brand ambient wash */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <div className="absolute -top-24 right-0 h-80 w-80 rounded-full bg-brand-500/10 blur-[120px]" />
        <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-secondary-500/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto w-full max-w-6xl px-4">
        <Reveal className="max-w-2xl mb-14">
          <Badge variant="brand" className="tracking-[0.18em]">
            Everything, client-side
          </Badge>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold font-display text-foreground tracking-tight">
            A real video composer, in the browser
          </h2>
          <p className="mt-3 text-lg text-gray-400 leading-relaxed">
            Production-grade FFmpeg, real templates, and live forms — running entirely on your device.
          </p>
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature, index) => {
            const Icon = feature.icon

            return (
              <Reveal key={feature.title} delay={index * 80} className="h-full">
                <Card
                  elevation="flat"
                  gradientBorder
                  className="group h-full bg-surface/40 p-6 transition-all duration-300 hover:border-brand-500/40 hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-500/10"
                >
                  <div className="flex items-center gap-4 mb-4">
                    <span className="grid place-items-center w-12 h-12 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] group-hover:bg-brand-500/20 group-hover:scale-105 group-hover:-rotate-6">
                      <Icon className="w-6 h-6" />
                    </span>
                    <div className="min-w-0">
                      <span className="block text-[0.62rem] font-semibold uppercase tracking-[0.16em] text-brand-600/80 dark:text-brand-300/70">
                        {feature.highlight}
                      </span>
                      <h3 className="text-lg font-bold font-display text-foreground leading-tight">
                        {feature.title}
                      </h3>
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </Card>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
