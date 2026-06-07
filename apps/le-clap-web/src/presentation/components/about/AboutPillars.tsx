import { Shield, Zap, Cpu } from 'lucide-react'

const pillars = [
    {
        icon: Shield,
        title: 'Private by design',
        description: 'Your clips never leave your device. There is no upload, no account, no server in the loop.',
    },
    {
        icon: Cpu,
        title: 'Real FFmpeg, locally',
        description: 'The same FFmpeg engine the core library uses, compiled to WebAssembly and run on your machine.',
    },
    {
        icon: Zap,
        title: 'Template-driven',
        description: 'Compose from real JSON templates — filters, overlays, transitions and audio mixing included.',
    },
]

export const AboutPillars = () => {
    return (
        <div className="grid gap-5 sm:grid-cols-3 mb-16">
            {pillars.map((pillar, index) => {
                const Icon = pillar.icon

                return (
                    <div
                        key={pillar.title}
                        className="group glass-panel-dark rounded-2xl p-6 lift fade-in"
                        style={{ animationDelay: `${0.15 + index * 0.08}s` }}
                    >
                        <div className="inline-flex p-3 mb-4 rounded-xl bg-brand-500/10 text-brand-600 dark:text-brand-300 group-hover:bg-brand-500/20 transition-colors duration-300">
                            <Icon className="w-6 h-6" />
                        </div>
                        <h3 className="text-lg font-semibold text-foreground mb-2">{pillar.title}</h3>
                        <p className="text-sm text-gray-400 leading-relaxed">{pillar.description}</p>
                    </div>
                )
            })}
        </div>
    )
}
