import { useState, useEffect, useRef, useCallback } from 'react';
import { MenuIcon } from './icons/menu';
import { XIcon } from './icons/x';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import clsx from 'clsx';
import { Button } from '@/presentation/components/ui';
import { BottomSheet } from '@/presentation/components/ui/BottomSheet';
import { LogoMark, type LogoMarkHandle } from './LogoMark';
import { SunIcon } from './icons/sun';
import { MoonIcon } from './icons/moon';
import { GithubIcon, type GithubIconHandle } from './icons/github';
import { GlobeIcon } from './icons/globe';
import { useIconHover } from './icons/useIconHover';
import { getTheme, toggleTheme, watchSystemTheme, type Theme, type ToggleOrigin } from '../../lib/theme';
import { getLanguage, localePath, LANGUAGES, type Language } from '../../lib/language';

type ThemeToggleProps = {
  theme: Theme;
  onToggle: (origin: ToggleOrigin) => void;
  className?: string;
};

const ThemeToggle = ({ theme, onToggle, className }: ThemeToggleProps) => {
  const { t } = useTranslation();
  const { ref, hoverProps } = useIconHover();

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
      {...hoverProps}
    >
      {theme === 'dark' ? <SunIcon ref={ref} size={18} /> : <MoonIcon ref={ref} size={18} />}
    </Button>
  );
};

type LanguagePickerProps = {
  language: Language;
  onSelect: (language: Language) => void;
  className?: string;
};

// Globe-triggered popover listing the supported languages by their endonym. Styled to sit in the
// header's action cluster (same rounded-full ghost pill as the theme/GitHub buttons), with the
// dropdown borrowing the surface/divider tokens and brand highlight used across the app's menus.
const LanguagePicker = ({ language, onSelect, className }: LanguagePickerProps) => {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Dismiss on outside click or Escape; return focus to the trigger when keyboard-closed.
  useEffect(() => {
    if (!open) {
      return () => {};
    }

    const onPointerDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const choose = (code: Language) => {
    onSelect(code);
    setOpen(false);
    triggerRef.current?.focus();
  };

  const active = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];
  const { ref: globeRef, hoverProps } = useIconHover();

  const items = LANGUAGES.map(({ code, nativeName }) => {
    const isActive = code === language;

    return (
      <button
        key={code}
        type="button"
        role="menuitemradio"
        aria-checked={isActive}
        onClick={() => {
          choose(code);
        }}
        className={clsx(
          'tap flex w-full items-center justify-between gap-3 rounded-xl px-3 py-3 text-left text-sm transition-colors sm:py-2',
          isActive
            ? 'bg-brand-500/15 font-semibold text-foreground'
            : 'text-gray-400 hover:bg-foreground/5 hover:text-foreground'
        )}
      >
        <span>{nativeName}</span>
        <span className="text-[0.65rem] font-semibold uppercase tracking-wider text-gray-500">{code}</span>
      </button>
    );
  });

  return (
    <div ref={rootRef} className={clsx('relative', className)}>
      <Button
        ref={triggerRef}
        variant="ghost"
        size="icon"
        onClick={() => {
          setOpen((v) => !v);
        }}
        className="gap-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 border border-foreground/5 hover:border-foreground/10"
        aria-label={t('header.changeLanguage')}
        title={t('header.changeLanguage')}
        aria-haspopup="menu"
        aria-expanded={open}
        {...hoverProps}
      >
        <GlobeIcon ref={globeRef} size={18} />
        <span className="text-[0.7rem] font-semibold uppercase tracking-wide">{active.code}</span>
      </Button>

      {/* Anchored popover on sm+ (hidden on mobile, which uses the bottom sheet below). */}
      <div
        role="menu"
        aria-label={t('header.changeLanguage')}
        className={clsx(
          'absolute right-0 top-[calc(100%+0.5rem)] z-50 hidden w-44 origin-top-right rounded-2xl border border-foreground/10 bg-surface/95 p-1.5 shadow-[var(--shadow-lg)] backdrop-blur-xl transition duration-200 ease-[var(--ease-out-expo)] sm:block',
          open ? 'pointer-events-auto scale-100 opacity-100' : 'pointer-events-none scale-95 opacity-0'
        )}
      >
        {items}
      </div>

      {/* Drag-to-close bottom sheet on mobile. */}
      <BottomSheet
        open={open}
        onClose={() => {
          setOpen(false);
        }}
        hideClassName="sm:hidden"
        role="menu"
        ariaLabel={t('header.changeLanguage')}
        panelClassName="p-2"
      >
        {items}
      </BottomSheet>
    </div>
  );
};

// href carries the route; labelKey resolves to a common.nav.* translation.
const navigationItems = [
  { labelKey: 'nav.home', href: '/' },
  // Studio is the create-a-video flow; Templates is the template manager/authoring area.
  { labelKey: 'nav.studio', href: '/studio' },
  { labelKey: 'nav.templates', href: '/templates' },
  { labelKey: 'nav.projects', href: '/projects' },
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

const MobileMenu = ({ isOpen, currentPath, onClose }: MobileMenuProps) => {
  const { t } = useTranslation();

  return (
    <BottomSheet
      open={isOpen}
      onClose={onClose}
      hideClassName="md:hidden"
      role="menu"
      ariaLabel={t('header.toggleMenu')}
      panelClassName="space-y-1"
      id="mobile-menu"
    >
      {navigationItems.map((item) => (
        <NavLink key={item.href} item={item} isActive={currentPath === item.href} mobile onClick={onClose} />
      ))}

      {/* GitHub is an external, secondary action — separated from the in-app nav by a divider so it
          reads as "leave the app", and surfaced here because the header's GitHub button is sm-only. */}
      <div className="mt-2 border-t border-foreground/10 pt-2">
        <a
          href="https://github.com/heristop/leclap"
          target="_blank"
          rel="noopener noreferrer"
          onClick={onClose}
          className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-gray-400 transition-all duration-200 hover:bg-foreground/5 hover:text-foreground"
        >
          <GithubIcon size={16} />
          {t('header.github')}
        </a>
      </div>
    </BottomSheet>
  );
};

export const Header = () => {
  const { t } = useTranslation();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [theme, setThemeState] = useState<Theme>(() => getTheme());
  // Language is fixed for the lifetime of the page — switching it is a full navigation to the
  // locale-prefixed URL, which reloads with the new language resolved from the path.
  const language = getLanguage();
  const location = useLocation();
  // Drive the GitHub mark's animation from the whole button's hover (group hover), not just the
  // 16px icon — the icon's imperative handle is made for exactly this.
  const githubRef = useRef<GithubIconHandle>(null);
  const logoRef = useRef<LogoMarkHandle>(null);

  const onToggleTheme = (origin: ToggleOrigin) => {
    setThemeState(toggleTheme(origin));
  };

  const onSelectLanguage = (next: Language) => {
    if (next === language) {
      return;
    }
    // Full navigation (not client-side) so the app re-boots under the new locale prefix: the router
    // basename, i18n language and prerendered <head> all derive from the URL.
    const { pathname, search, hash } = window.location;
    window.location.assign(`${localePath(next, pathname)}${search}${hash}`);
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
  // The studio browsing pages (gallery / templates / projects) are always-dark app surfaces that
  // fill the viewport behind the fixed header. Force a dark header context on them too, so the nav
  // is legible in light mode (and the header reads as part of the dark app, like the editor).
  const darkSurfaceRoots = ['/studio', '/templates', '/projects', '/partials'];
  const onDarkSurface = darkSurfaceRoots.some(
    (root) => location.pathname === root || location.pathname.startsWith(`${root}/`)
  );

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
        (overHero || onDarkSurface) && 'dark',
        scrolled ? 'bg-background/80 backdrop-blur-md border-b border-divider py-2' : 'bg-transparent py-4'
      )}
    >
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link
            to="/"
            viewTransition
            className="flex items-center space-x-3 group"
            onMouseEnter={() => logoRef.current?.clap()}
          >
            <LogoMark
              ref={logoRef}
              className="tap w-10 h-10 cursor-pointer [filter:drop-shadow(0_6px_14px_rgba(91,97,214,0.35))] group-hover:-rotate-6 group-hover:scale-105 transition-transform duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
            />
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">{t('brand')}</h1>
            </div>
          </Link>

          {/* Desktop Navigation — magnetic sliding pill */}
          <DesktopNav pathname={location.pathname} />

          {/* Action Buttons */}
          <div className="flex items-center space-x-3">
            {/* Language Picker */}
            <LanguagePicker language={language} onSelect={onSelectLanguage} />

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
                href="https://github.com/heristop/leclap"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('header.viewSource')}
                onMouseEnter={() => {
                  githubRef.current?.startAnimation();
                }}
                onMouseLeave={() => {
                  githubRef.current?.stopAnimation();
                }}
              >
                <GithubIcon ref={githubRef} size={16} />
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
              {isMenuOpen ? <XIcon size={20} /> : <MenuIcon size={20} />}
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
