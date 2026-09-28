import { MotionConfig } from 'motion/react';
import { FeaturesSection } from '@/presentation/components/FeaturesSection';
import { HomeShowcase } from '@/presentation/components/HomeShowcase';
import { Seo } from '@/presentation/components/Seo';
import { AgenticDeepDive } from '@/presentation/components/home/agentic-deep-dive';
import { CinematicHero } from '@/presentation/components/home/cinematic-hero';
import { FilmSection } from '@/presentation/components/home/film-section';
import { MobileDeepDive } from '@/presentation/components/home/mobile-deep-dive';
import { RenderTrack } from '@/presentation/components/home/render-track';

// The landing follows the visitor's theme like the rest of the site: a lavender-grey page in light, near-black
// in dark. What stays dark in both is what is a screen: the hero's monitor over its film, the video frames and
// the phone, so in light they read as screens lit on a bright page. overflow-x-clip, not overflow-hidden: a
// hidden overflow on an ancestor becomes the box sticky children stick to, and the deep dives' pinned visuals
// would scroll away.
// MotionConfig carries the visitor's reduced-motion setting into the motion/react animations too (the hover
// icons, the arrows), which the global CSS reset can't reach.
export const Home = () => (
  <MotionConfig reducedMotion="user">
    <div className="min-h-[calc(100vh-4rem)] overflow-x-clip bg-background text-foreground">
      <Seo />

      {/* Hero — the "living program monitor": the product previewing itself, with a scrubbable film. */}
      <CinematicHero />

      {/* The film — the 78-second showcase, localized, click to play. */}
      <FilmSection />

      {/* Deep dive: the on-device story, chapters scrolling past a pinned phone. */}
      <MobileDeepDive />

      {/* Deep dive: agentic development, chapters beside a pinned pull request, then its film. */}
      <AgenticDeepDive />

      {/* The render track — scrolling is the render: Clappy runs the loader's lane into the finished render. */}
      <RenderTrack />

      {/* Showcase — an actual in-browser render */}
      <HomeShowcase />

      {/* Features Section */}
      <FeaturesSection />
    </div>
  </MotionConfig>
);
