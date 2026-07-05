import { FeaturesSection } from '@/presentation/components/FeaturesSection';
import { HomeShowcase } from '@/presentation/components/HomeShowcase';
import { CreateShowcase } from '@/presentation/components/CreateShowcase';
import { BuilderShowcase } from '@/presentation/components/BuilderShowcase';
import { Seo } from '@/presentation/components/Seo';
import { CinematicHero } from '@/presentation/components/home/cinematic-hero';

export const Home = () => (
  <div className="min-h-[calc(100vh-4rem)] overflow-hidden bg-background text-foreground">
    <Seo />

    {/* Hero — the "living program monitor": the product previewing itself, with a scrubbable film. */}
    <CinematicHero />

    {/* Showcase — an actual in-browser render */}
    <HomeShowcase />

    {/* Create showcase — the studio video-creation flow (pick a template, add a clip, render) */}
    <CreateShowcase />

    {/* Builder showcase — a promo of the template builder (landscape on desktop, portrait on phones) */}
    <BuilderShowcase />

    {/* Mobile section hidden until the iOS/Android app ships on the stores. Re-add <PhoneShowcase />. */}

    {/* Features Section */}
    <FeaturesSection />
  </div>
);
