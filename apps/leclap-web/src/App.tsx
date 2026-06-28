import { useEffect } from 'react';
import {
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
  Route,
  Navigate,
  Outlet,
  ScrollRestoration,
} from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { haptic } from '@/lib/haptics';
import { Header } from '@/presentation/components/Header';
import { Home } from '@/presentation/pages/Home';
import { Builder } from '@/presentation/pages/Builder';
import { StudioHome } from '@/presentation/pages/StudioHome';
import { StudioTemplateBuilderPage } from '@/presentation/pages/StudioTemplateBuilderPage';
import { About } from '@/presentation/pages/About';
import { Admin } from '@/presentation/pages/Admin';
import { TemplateEditorPage } from '@/presentation/pages/TemplateEditorPage';
import { PartialsPage } from '@/presentation/pages/PartialsPage';
import { ProjectsPage } from '@/presentation/pages/ProjectsPage';
import { Design } from '@/presentation/pages/Design';
import {
  DocLayout,
  DocOverview,
  DocSections,
  DocTransitions,
  DocLooks,
  DocGrade,
  DocMotion,
  DocAudio,
  DocCaptions,
  DocAnimations,
  DocFilters,
  DocExamples,
  DocSchema,
} from '@/presentation/pages/doc';
import { NotFound } from '@/presentation/pages/NotFound';
import { RouteError } from '@/presentation/components/RouteError';
import { Onboarding } from '@/presentation/components/Onboarding';
import { useOnboarding } from '@/hooks/useOnboarding';
import { LOCALE_PREFIXES } from '@/lib/language';

// Non-English languages are served under a path prefix (/fr, /de, …). Mounting the router under a
// matching basename lets every existing route work unchanged within the active locale — `/fr/studio`
// resolves to the Studio route. English has no prefix (basename undefined). The locale is read from
// the URL once at load; switching language is a full navigation to the new prefix (see LanguagePicker).
function detectBasename(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const segment = window.location.pathname.split('/')[1];

  return LOCALE_PREFIXES.includes(segment as never) ? `/${segment}` : undefined;
}

// The shared chrome (skip link, header, footer, onboarding) wraps every route via <Outlet />.
// <ScrollRestoration /> gives native scroll behavior: top on forward navigations, restored position
// on back/forward — the browser default that client-side routing otherwise loses.
function RootLayout() {
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
    <>
      <ScrollRestoration />
      <div className="flex min-h-screen flex-col bg-background">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-[60] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-brand-600 focus:text-white focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-white/80"
        >
          {t('skipToContent')}
        </a>
        <Header />

        {/* tabIndex={-1} so the skip link can move keyboard focus here, not just scroll — without it
            focus stays on the link and the next Tab falls back into the header nav. */}
        <main id="main-content" tabIndex={-1} className="outline-none">
          <Outlet />
        </main>

        {/* Footer */}
        <footer className="bg-surface text-foreground py-8 mt-auto border-t border-foreground/5">
          <div className="container mx-auto px-4 text-center">
            <p className="text-sm text-gray-400">{t('footer')}</p>
          </div>
        </footer>
      </div>

      {/* First-visit guided intro (record → compile a sample → download). */}
      {show && <Onboarding onDone={dismiss} />}
    </>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />} errorElement={<RouteError />}>
      <Route path="/" element={<Home />} />
      <Route path="/studio" element={<StudioHome />} />
      <Route path="/studio/new" element={<Builder />} />
      <Route path="/studio/builder" element={<StudioTemplateBuilderPage />} />
      {/* Legacy path kept so existing bookmarks/links keep working. */}
      <Route path="/builder" element={<Navigate to="/studio/new" replace />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/templates" element={<Admin />} />
      <Route path="/templates/new" element={<TemplateEditorPage />} />
      <Route path="/templates/:id/edit" element={<TemplateEditorPage />} />
      <Route path="/partials" element={<PartialsPage />} />
      {/* Legacy path kept so existing bookmarks/links keep working. */}
      <Route path="/admin" element={<Navigate to="/templates" replace />} />
      <Route path="/design" element={<Design />} />
      <Route path="/doc" element={<DocLayout />}>
        <Route index element={<DocOverview />} />
        <Route path="sections" element={<DocSections />} />
        <Route path="transitions" element={<DocTransitions />} />
        <Route path="looks" element={<DocLooks />} />
        <Route path="grade" element={<DocGrade />} />
        <Route path="motion" element={<DocMotion />} />
        <Route path="audio" element={<DocAudio />} />
        <Route path="captions" element={<DocCaptions />} />
        <Route path="animations" element={<DocAnimations />} />
        <Route path="filters" element={<DocFilters />} />
        <Route path="examples" element={<DocExamples />} />
        <Route path="schema" element={<DocSchema />} />
      </Route>
      <Route path="/about" element={<About />} />
      <Route path="*" element={<NotFound />} />
    </Route>
  ),
  { basename: detectBasename() }
);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
