import { useState, useEffect, useRef, useCallback } from 'react';
import { Clapperboard, Code2, Menu, X, Sun, Moon } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Button } from '@/presentation/components/ui';
import { getTheme, toggleTheme, watchSystemTheme, type Theme, type ToggleOrigin } from '../../lib/theme';

type ThemeToggleProps = {
  theme: Theme;
  onToggle: (origin: ToggleOrigin) => void;
  className?: string;
};

const ThemeToggle = ({ theme, onToggle, className }: ThemeToggleProps) => {
  const { t } = useTranslation();

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={(e) => {
        onToggle({ x: e.clientX, y: e.clientY });
      }}
      className={clsx(
        'rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 hover:border-foreground/10',
        className
      )}
      aria-label={theme === 'dark' ? t('header.switchToLight') : t('header.switchToDark')}
      title={t('header.toggleTheme')}
    >
      {theme === 'dark' ? <Sun /> : <Moon />}
    </Button>
  );
};

// href carries the route; labelKey resolves to a common.nav.* translation.
const navigationItems = [
  { labelKey: 'nav.home', href: '/' },
  { labelKey: 'nav.builder', href: '/builder' },
  { labelKey: 'nav.templates', href: '/templates' },
  { labelKey: 'nav.docs', href: '/doc' },
  { labelKey: 'nav.about', href: '/about' },
] as const;

type NavItem = (typeof navigationItems)[number];

type NavLinkProps = {
  item: NavItem;
  isActive: boolean;
  mobile?: boolean;
  onClick?: () => void;
};

const getNavLinkClass = (mobile: boolean | undefined, isActive: boolean): string => {
  if (mobile) {
    const base = 'block px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200';
    const state = isActive
      ? 'text-foreground bg-brand-500/20 border border-brand-500/25'
      : 'text-gray-400 hover:text-foreground hover:bg-foreground/5';

    return clsx(base, state);
  }

  const base = 'px-4 py-2 text-sm font-medium rounded-full transition-all duration-200';
  const state = isActive
    ? 'text-foreground bg-foreground/10'
    : 'text-gray-400 hover:text-foreground hover:bg-foreground/5';

  return clsx(base, state);
};

const NavLink = ({ item, isActive, mobile, onClick }: NavLinkProps) => {
  const { t } = useTranslation();

  return (
    <Link to={item.href} viewTransition className={getNavLinkClass(mobile, isActive)} onClick={onClick}>
      {t(item.labelKey)}
    </Link>
  );
};

type Indicator = { left: number; width: number; opacity: number };

/** Desktop nav with a magnetic pill that glides between items and follows hover. */
const DesktopNav = ({ pathname }: { pathname: string }) => {
  const { t } = useTranslation();
  const navRef = useRef<HTMLElement>(null);
  const [pill, setPill] = useState<Indicator>({ left: 0, width: 0, opacity: 0 });

  const moveTo = useCallback((el: HTMLElement | null) => {
    if (el) setPill({ left: el.offsetLeft, width: el.offsetWidth, opacity: 1 });
  }, []);

  const snapToActive = useCallback(() => {
    const active = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');

    if (active) {
      moveTo(active);

      return;
    }

    setPill((p) => ({ ...p, opacity: 0 }));
  }, [moveTo]);

  useEffect(() => {
    snapToActive();
  }, [pathname, snapToActive]);
  useEffect(() => {
    window.addEventListener('resize', snapToActive);

    return () => {
      window.removeEventListener('resize', snapToActive);
    };
  }, [snapToActive]);

  return (
    <nav
      ref={navRef}
      aria-label={t('nav.primaryLabel')}
      className="relative hidden md:flex items-center gap-1"
      onMouseLeave={snapToActive}
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 h-9 -translate-y-1/2 rounded-full bg-foreground/10 transition-[left,width,opacity] duration-300 ease-[var(--ease-out-expo)]"
        style={{ left: pill.left, width: pill.width, opacity: pill.opacity }}
      />
      {navigationItems.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            key={item.href}
            to={item.href}
            viewTransition
            data-active={isActive}
            onMouseEnter={(e) => {
              moveTo(e.currentTarget);
            }}
            className={clsx(
              'relative z-10 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-200',
              isActive ? 'text-foreground' : 'text-gray-400 hover:text-foreground'
            )}
          >
            {t(item.labelKey)}
          </Link>
        );
      })}
    </nav>
  );
};

type MobileMenuProps = {
  isOpen: boolean;
  currentPath: string;
  onClose: () => void;
};

const MobileMenu = ({ isOpen, currentPath, onClose }: MobileMenuProps) => (
  <div
    className={clsx(
      'md:hidden transition-all duration-300 ease-in-out overflow-hidden',
      isOpen ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0'
    )}
  >
    <nav
      id="mobile-menu"
      className="p-4 space-y-2 bg-surface/90 backdrop-blur-xl rounded-2xl border border-foreground/10"
    >
      {navigationItems.map((item) => (
        <NavLink key={item.href} item={item} isActive={currentPath === item.href} mobile onClick={onClose} />
      ))}
    </nav>
  </div>
);

export const Header = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  const location = useLocation();

  const onToggleTheme = (origin: ToggleOrigin) => {
    setThemeState(toggleTheme(origin));
  };

  // While the user is still on the system default, mirror live OS color-scheme changes into the
  // toggle's state so its icon stays in sync (the class is applied globally in main.tsx).
  useEffect(() => watchSystemTheme(setThemeState), []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // The Home hero is an always-dark band. While the transparent header overlays
  // it (home route, not scrolled), force a dark context so the nav stays legible
  // regardless of the active theme.
  const overHero = location.pathname === '/' && !scrolled;

  return (
    <header
      // A `position: fixed` element is viewport-relative, so it is NOT covered by the body
      // scrollbar-width compensation Radix overlays apply on open (react-remove-scroll sets
      // `--removed-body-scroll-bar-size` and pads the body). Without this the navbar shifts right
      // when a dropdown/dialog removes the scrollbar; padding-right by the same var keeps it put
      // (0px when nothing is open) while leaving the header background full-width.
      style={{ paddingRight: 'var(--removed-body-scroll-bar-size, 0px)' }}
      className={clsx(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-300',
        overHero && 'dark',
        scrolled ? 'bg-background/80 backdrop-blur-md border-b border-foreground/10 py-2' : 'bg-transparent py-4'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" viewTransition className="flex items-center space-x-3 group">
            <div className="tap p-2 brand-gradient rounded-xl shadow-lg shadow-brand-900/30 group-hover:shadow-brand-500/30 group-hover:-rotate-6 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]">
              <Clapperboard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{t('brand')}</h1>
            </div>
          </Link>

          {/* Desktop Navigation — magnetic sliding pill */}
          <DesktopNav pathname={location.pathname} />

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <ThemeToggle theme={theme} onToggle={onToggleTheme} />

            {/* GitHub Link */}
            <Button
              asChild
              variant="ghost"
              size="sm"
              className="hidden sm:flex rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 hover:border-foreground/10"
            >
              <a
                href="https://github.com/heristop/ffmpeg-video-composer"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('header.viewSource')}
              >
                <Code2 className="w-4 h-4" />
                <span>{t('header.github')}</span>
              </a>
            </Button>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setIsMenuOpen(!isMenuOpen);
              }}
              className="md:hidden"
              aria-label={t('header.toggleMenu')}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-menu"
            >
              {isMenuOpen ? <X /> : <Menu />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        <MobileMenu
          isOpen={isMenuOpen}
          currentPath={location.pathname}
          onClose={() => {
            setIsMenuOpen(false);
          }}
        />
      </div>
    </header>
  );
};
