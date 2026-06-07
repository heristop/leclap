import { Clapperboard, ArrowRight, Play, Film, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { FeaturesSection } from '@/presentation/components/FeaturesSection'
import { Seo } from '@/presentation/components/Seo'
import { Button } from '@/presentation/components/ui'
import { OPEN_ONBOARDING_EVENT } from '@/hooks/useOnboarding'

export const Home = () => {
    return (
        <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground overflow-hidden">
            <Seo />
            {/* Hero Section — always-dark "stage": force dark tokens regardless of theme */}
            <div className="dark relative min-h-[90vh] flex items-center justify-center overflow-hidden">
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
                        <span className="text-gradient-animated">
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
                        <Button asChild size="lg" className="group rounded-full glow-brand hover:scale-105">
                            <Link to="/builder">
                                Start Creating
                                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                            </Link>
                        </Button>

                        <Button
                            type="button"
                            variant="ghost"
                            size="lg"
                            onClick={() => { window.dispatchEvent(new Event(OPEN_ONBOARDING_EVENT)) }}
                            className="rounded-full"
                        >
                            <Play />
                            See How It Works
                        </Button>
                    </div>
                </div>
            </div>

            {/* Features Section */}
            <FeaturesSection />
        </div>
    )
}
