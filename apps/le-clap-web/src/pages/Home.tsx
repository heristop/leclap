import { Clapperboard, ArrowRight, Play, Film, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FeaturesSection } from '../components/FeaturesSection'

export const Home = () => {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-gray-900 text-white overflow-hidden">
            {/* Hero Section */}
            <div className="relative min-h-[90vh] flex items-center justify-center overflow-hidden">
                {/* Animated Background */}
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 opacity-80 z-0" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1536440136628-849c177e76a1?q=80&w=2525&auto=format&fit=crop')] bg-cover bg-center opacity-20 mix-blend-overlay z-0" />

                {/* Floating Elements */}
                <div className="absolute top-1/4 left-1/4 animate-float opacity-20" style={{ animationDelay: '0s' }}>
                    <Film className="w-24 h-24 text-blue-400" />
                </div>
                <div className="absolute bottom-1/4 right-1/4 animate-float opacity-20" style={{ animationDelay: '2s' }}>
                    <Clapperboard className="w-32 h-32 text-purple-400" />
                </div>
                <div className="absolute top-1/3 right-1/3 animate-float opacity-20" style={{ animationDelay: '4s' }}>
                    <Wand2 className="w-16 h-16 text-pink-400" />
                </div>

                <div className="container mx-auto px-4 text-center relative z-10">
                    <h1 className="text-7xl md:text-9xl font-bold mb-6 tracking-tighter fade-in" style={{ animationDelay: '0.2s' }}>
                        <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                            LeClap
                        </span>
                    </h1>

                    <p className="text-2xl md:text-3xl text-gray-300 mb-12 max-w-3xl mx-auto font-light leading-relaxed fade-in" style={{ animationDelay: '0.4s' }}>
                        The cinematic video composer that runs entirely in your browser.
                        <span className="block mt-2 text-lg text-gray-400">
                            Powered by WebAssembly & FFmpeg. No servers. No limits.
                        </span>
                    </p>

                    <div className="flex flex-col md:flex-row justify-center gap-6 fade-in" style={{ animationDelay: '0.6s' }}>
                        <Link
                            to="/builder"
                            className="group relative inline-flex items-center justify-center px-8 py-4 text-lg font-bold text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-full overflow-hidden transition-all duration-300 hover:bg-white/20 hover:scale-105 hover:shadow-[0_0_40px_rgba(124,131,253,0.5)]"
                        >
                            <span className="relative z-10 flex items-center">
                                Start Creating
                                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
                            </span>
                            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        </Link>

                        <a
                            href="#features"
                            className="inline-flex items-center justify-center px-8 py-4 text-lg font-medium text-gray-300 hover:text-white transition-colors duration-300"
                        >
                            <Play className="mr-2 w-5 h-5" />
                            See How It Works
                        </a>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <FeaturesSection />
        </div>
    )
}
