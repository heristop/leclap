import { Code2, Globe, AtSign } from 'lucide-react'

export const About = () => {
    return (
        <div className="min-h-screen bg-background text-foreground relative overflow-hidden pt-24 pb-12">
            {/* Background Elements */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px] animate-pulse" />
                <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-[100px] animate-pulse delay-1000" />
            </div>

            <div className="container mx-auto px-4 relative z-10">
                <div className="max-w-4xl mx-auto">
                    {/* Header */}
                    <div className="text-center mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-400 font-display tracking-tight">
                            About LeClap
                        </h1>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">
                            A powerful, cinematic video composition tool built for the modern web.
                            Create stunning videos with ease using the power of FFmpeg and WebAssembly.
                        </p>
                    </div>

                    {/* Author Profile */}
                    <div className="glass-panel-dark rounded-2xl p-8 md:p-12 shadow-2xl border border-white/10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
                        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-12">
                            {/* Avatar/Profile Image Placeholder */}
                            <div className="relative group">
                                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full blur opacity-75 group-hover:opacity-100 transition duration-1000 group-hover:duration-200" />
                                <div className="relative w-40 h-40 rounded-full overflow-hidden border-4 border-gray-900 bg-gray-800 flex items-center justify-center">
                                    <span className="text-4xl font-bold text-gray-600">AM</span>
                                </div>
                            </div>

                            <div className="flex-1 text-center md:text-left">
                                <h2 className="text-3xl font-bold mb-2 text-white">Alexandre Mogère</h2>
                                <p className="text-blue-400 font-medium mb-4 text-lg">@heristop</p>
                                <p className="text-gray-300 mb-6 leading-relaxed text-lg">
                                    Passionate about JavaScript, TypeScript, and PHP. Creator of Zazen Code, sharing practical tips and the latest trends in web development. Building tools that empower creators.
                                </p>

                                <div className="flex flex-wrap justify-center md:justify-start gap-4">
                                    <a
                                        href="https://heristop.github.io"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all duration-300 hover:scale-105 border border-white/5 cursor-pointer"
                                    >
                                        <Globe className="w-5 h-5" />
                                        <span>Website</span>
                                    </a>
                                    <a
                                        href="https://github.com/heristop"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all duration-300 hover:scale-105 border border-white/5 cursor-pointer"
                                    >
                                        <Code2 className="w-5 h-5" />
                                        <span>GitHub</span>
                                    </a>
                                    <a
                                        href="https://twitter.com/heristop"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center space-x-2 px-6 py-3 bg-white/5 hover:bg-white/10 rounded-full text-white transition-all duration-300 hover:scale-105 border border-white/5 cursor-pointer"
                                    >
                                        <AtSign className="w-5 h-5" />
                                        <span>Twitter</span>
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tech Stack */}
                    <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-300">
                        <div className="glass-panel-dark p-6 rounded-xl border border-white/5 text-center hover:bg-white/5 transition-colors duration-300">
                            <h3 className="text-xl font-bold text-blue-400 mb-2">React 19</h3>
                            <p className="text-gray-400">Built with the latest React features for optimal performance.</p>
                        </div>
                        <div className="glass-panel-dark p-6 rounded-xl border border-white/5 text-center hover:bg-white/5 transition-colors duration-300">
                            <h3 className="text-xl font-bold text-purple-400 mb-2">FFmpeg.wasm</h3>
                            <p className="text-gray-400">Client-side video processing power without server costs.</p>
                        </div>
                        <div className="glass-panel-dark p-6 rounded-xl border border-white/5 text-center hover:bg-white/5 transition-colors duration-300">
                            <h3 className="text-xl font-bold text-green-400 mb-2">Tailwind CSS 4</h3>
                            <p className="text-gray-400">Styled with the newest utility-first CSS framework.</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
