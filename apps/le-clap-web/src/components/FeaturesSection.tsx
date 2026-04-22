import { FileCode, Users, Cog, Shield, Zap, Globe } from 'lucide-react'

const features = [
  {
    icon: FileCode,
    title: 'Real JSON Templates',
    description: 'Use actual template files from the core package with complex FFmpeg configurations, filters, and effects.',
    highlight: 'Production-ready'
  },
  {
    icon: Users,
    title: 'Interactive Forms',
    description: 'Dynamic form generation from template definitions with real-time validation and user input processing.',
    highlight: 'Dynamic'
  },
  {
    icon: Cog,
    title: 'Advanced Processing',
    description: 'Full FFmpeg processing pipeline with video filters, text overlays, transitions, and audio mixing.',
    highlight: 'Professional'
  },
  {
    icon: Shield,
    title: 'Complete Privacy',
    description: 'All processing happens locally in your browser. Your files never leave your device or touch any server.',
    highlight: 'Private'
  },
  {
    icon: Zap,
    title: 'WebAssembly Powered',
    description: 'Lightning-fast video processing using WebAssembly FFmpeg for near-native performance.',
    highlight: 'Fast'
  },
  {
    icon: Globe,
    title: 'Cross-Platform',
    description: 'Works in any modern browser on desktop, mobile, and tablet. No installation required.',
    highlight: 'Universal'
  }
]

export const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-gray-900 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-0 right-0 w-1/2 h-1/2 bg-blue-900/20 rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-1/2 h-1/2 bg-purple-900/20 rounded-full blur-[100px]" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="text-center mb-16">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6 tracking-tight">
            Real Video Composer Features
          </h2>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto font-light">
            Experience the full power of LeClap running directly in your browser
            with real templates and production-grade processing capabilities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative p-8 glass-panel-dark rounded-2xl transition-all duration-500 hover:bg-white/5 hover:-translate-y-2 fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Highlight Badge */}
                <div className="absolute -top-3 -right-3">
                  <span className="px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-bold rounded-full shadow-lg">
                    {feature.highlight}
                  </span>
                </div>

                {/* Icon */}
                <div className="flex items-center mb-6">
                  <div className="p-4 bg-white/5 rounded-xl mr-4 group-hover:bg-blue-500/20 transition-colors duration-300">
                    <IconComponent className="w-8 h-8 text-blue-400 group-hover:text-blue-300 transition-colors duration-300" />
                  </div>
                  <h3 className="text-2xl font-semibold text-white">
                    {feature.title}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-gray-400 leading-relaxed group-hover:text-gray-300 transition-colors duration-300">
                  {feature.description}
                </p>

                {/* Decorative Border */}
                <div className="absolute bottom-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-blue-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            )
          })}
        </div>

      </div>
    </section>
  )
}