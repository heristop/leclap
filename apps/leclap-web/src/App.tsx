import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/lib/haptics';
import { Header } from '@/presentation/components/Header';
import { Home } from '@/presentation/pages/Home';
import { Builder } from '@/presentation/pages/Builder';
import { About } from '@/presentation/pages/About';
import { Admin } from '@/presentation/pages/Admin';
import { TemplateEditorPage } from '@/presentation/pages/TemplateEditorPage';
import { Design } from '@/presentation/pages/Design';
import { Doc } from '@/presentation/pages/Doc';
import { NotFound } from '@/presentation/pages/NotFound';
import { Onboarding } from '@/presentation/components/Onboarding';
import { BrandIntro } from '@/presentation/components/brand/BrandIntro';
import { useOnboarding } from '@/hooks/useOnboarding';

function App() {
  const { t } = useTranslation();
  const { show, dismiss } = useOnboarding();

  // App-wide tactile feedback: a subtle haptic on every press of an interactive
  // element gives the web app a native, responsive feel (web-haptics).
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const el = event.target as Element | null;

      if (el?.closest('button, a, [role="button"], input[type="range"], .tap')) {
        haptic('selection');
      }
    };
    document.addEventListener('pointerdown', onPointerDown, { passive: true });

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return (
    <Router>
      <div className="min-h-screen bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-600 focus:text-white"
        >
          {t('skipToContent')}
        </a>
        <Header />

        <main id="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/builder" element={<Builder />} />
            <Route path="/templates" element={<Admin />} />
            <Route path="/templates/new" element={<TemplateEditorPage />} />
            <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
            {/* Legacy path kept so existing bookmarks/links keep working. */}
            <Route path="/admin" element={<Navigate to="/templates" replace />} />
            <Route path="/design" element={<Design />} />
            <Route path="/doc" element={<Doc />} />
            <Route path="/about" element={<About />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </main>

        {/* Footer */}
        <footer className="bg-surface text-foreground py-8 mt-auto border-t border-foreground/5">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-gray-400">{t('footer')}</p>
          </div>
        </footer>
      </div>

      {/* Once-per-session brand sting (clapperboard claps in), above the onboarding. */}
      <BrandIntro />

      {/* First-visit guided intro (record → compile a sample → download). */}
      {show && <Onboarding onDone={dismiss} />}
    </Router>
  );
}

export default App;
