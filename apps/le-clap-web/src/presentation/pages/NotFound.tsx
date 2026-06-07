import { Link } from 'react-router-dom';
import { Home, Compass } from 'lucide-react';
import { Seo } from '@/presentation/components/Seo';
import { Button } from '@/presentation/components/ui';

export const NotFound = () => (
  <div className="min-h-[calc(100vh-4rem)] bg-background text-foreground relative overflow-hidden flex items-center justify-center px-4">
    <Seo title="Page Not Found" noindex />
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[32rem] h-[32rem] bg-brand-500/10 rounded-full blur-[120px]" />
    </div>

    <div className="relative text-center max-w-md fade-in">
      <p className="text-8xl font-bold font-display brand-gradient-text mb-2">404</p>
      <h1 className="text-2xl font-bold font-display text-foreground mb-2">Page not found</h1>
      <p className="text-gray-300 mb-8">The page you're looking for doesn't exist or has moved.</p>
      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Button asChild size="lg">
          <Link to="/">
            <Home /> Home
          </Link>
        </Button>
        <Button asChild variant="secondary" size="lg">
          <Link to="/builder">
            <Compass /> Open the builder
          </Link>
        </Button>
      </div>
    </div>
  </div>
);
