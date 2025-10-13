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
    <section id="features" className="py-16 bg-gradient-to-br from-gray-50 to-blue-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Real Video Composer Features
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Experience the full power of FFmpeg Video Composer running directly in your browser
            with real templates and production-grade processing capabilities.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => {
            const IconComponent = feature.icon
            return (
              <div
                key={feature.title}
                className="relative p-6 bg-white rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 fade-in"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                {/* Highlight Badge */}
                <div className="absolute -top-3 -right-3">
                  <span className="px-3 py-1 bg-gradient-to-r from-brand-500 to-purple-600 text-white text-xs font-bold rounded-full">
                    {feature.highlight}
                  </span>
                </div>

                {/* Icon */}
                <div className="flex items-center mb-4">
                  <div className="p-3 bg-gradient-to-r from-brand-100 to-purple-100 rounded-lg mr-4">
                    <IconComponent className="w-6 h-6 text-brand-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    {feature.title}
                  </h3>
                </div>

                {/* Description */}
                <p className="text-gray-600 leading-relaxed">
                  {feature.description}
                </p>

                {/* Decorative Border */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-500 to-purple-600 rounded-b-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            )
          })}
        </div>

        {/* Tech Stack */}
        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">
            Built with Modern Technologies
          </h3>
          <div className="flex flex-wrap justify-center items-center gap-8 text-gray-600">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="font-medium">React 19</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="font-medium">Tailwind CSS v4</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="font-medium">WebAssembly FFmpeg</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="font-medium">TypeScript</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="font-medium">Template Engine</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}