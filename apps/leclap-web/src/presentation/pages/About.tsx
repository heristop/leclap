import { ArrowRight, Shield } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AboutStats } from '@/presentation/components/about/AboutStats';
import { AboutPillars } from '@/presentation/components/about/AboutPillars';
import { AboutAuthor } from '@/presentation/components/about/AboutAuthor';
import { AboutThanks } from '@/presentation/components/about/AboutThanks';
import { Seo } from '@/presentation/components/Seo';
import { Badge, Button, Reveal } from '@/presentation/components/ui';

export const About = () => {
  const { t } = useTranslation('about');

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden pt-24 pb-20">
      <Seo title={t('about.title', { ns: 'seo' })} description={t('about.description', { ns: 'seo' })} path="/about" />
      {/* Ambient background */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-brand-500/10 rounded-full blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-secondary-500/10 rounded-full blur-[120px] animate-pulse delay-1000" />
      </div>

      <div className="container mx-auto px-4 relative z-10">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <header className="text-center mb-14 fade-in">
            <Badge variant="brand" className="mb-6 px-4 py-1.5 tracking-[0.18em]">
              <Shield className="w-3.5 h-3.5" />
              {t('hero.badge')}
            </Badge>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 brand-gradient-text font-display tracking-tight">
              {t('hero.title')}
            </h1>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto leading-relaxed">{t('hero.tagline')}</p>
          </header>

          {/* Stats strip */}
          <Reveal>
            <AboutStats />
          </Reveal>

          {/* Pillars — each card self-reveals with an internal cascade */}
          <AboutPillars />

          {/* Author */}
          <Reveal delay={160}>
            <AboutAuthor />
          </Reveal>

          {/* Thanks to FFmpeg */}
          <Reveal delay={240}>
            <AboutThanks />
          </Reveal>

          {/* CTA */}
          <Reveal delay={320} className="mt-16 text-center">
            <p className="text-gray-400 mb-6">{t('cta.prompt')}</p>
            <Button asChild size="lg" className="group rounded-full lift">
              <Link to="/studio">
                {t('cta.start')}
                <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </Button>
          </Reveal>
        </div>
      </div>
    </div>
  );
};
