// Pure class-map resolvers for the design-system primitives. Kept free of any
// imports so they're trivially unit-testable in a node env (see tests/ui-variants).

const join = (...parts: Array<string | false | undefined>): string => parts.filter(Boolean).join(' ');

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger';
export type ButtonSize = 'sm' | 'md' | 'lg';

const BUTTON_BASE =
  'tap inline-flex items-center justify-center gap-2 font-semibold rounded-xl transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] focus:outline-none focus:ring-4 focus:ring-brand-500/30 disabled:opacity-50 disabled:pointer-events-none';

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: 'brand-gradient text-white shadow-lg shadow-brand-900/30 hover:-translate-y-0.5 hover:shadow-brand-500/40',
  secondary: 'bg-surface-2 text-foreground border border-divider hover:bg-surface-2/70 hover:-translate-y-0.5',
  ghost: 'text-gray-300 hover:text-foreground hover:bg-foreground/10',
  accent: 'bg-accent-400 text-gray-900 shadow-lg shadow-accent-500/20 hover:-translate-y-0.5',
  danger: 'bg-[var(--color-error)] text-white hover:-translate-y-0.5',
};

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'text-sm px-3 py-1.5',
  md: 'px-5 py-2.5',
  lg: 'text-lg px-7 py-3.5',
};

export function buttonVariants(opts: { variant?: ButtonVariant; size?: ButtonSize } = {}): string {
  const { variant = 'primary', size = 'md' } = opts;

  return join(BUTTON_BASE, BUTTON_VARIANTS[variant], BUTTON_SIZES[size]);
}

export type BadgeVariant = 'brand' | 'secondary' | 'accent' | 'neutral' | 'success';

const BADGE_BASE =
  'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider';

const BADGE_VARIANTS: Record<BadgeVariant, string> = {
  brand: 'bg-brand-500/20 text-brand-200 border border-brand-500/30',
  secondary: 'bg-secondary-500/15 text-secondary-300 border border-secondary-500/25',
  accent: 'bg-accent-400 text-gray-900',
  neutral: 'bg-foreground/10 text-gray-300 border border-foreground/10',
  success: 'bg-success/15 text-success border border-success/30',
};

export function badgeVariants(opts: { variant?: BadgeVariant } = {}): string {
  return join(BADGE_BASE, BADGE_VARIANTS[opts.variant ?? 'neutral']);
}

export type CardElevation = 'flat' | 'raised' | 'floating';

const CARD_BASE = 'bg-surface border border-divider rounded-2xl';

const CARD_ELEVATIONS: Record<CardElevation, string> = {
  flat: '',
  raised: 'shadow-md',
  floating: 'shadow-lg',
};

export function cardVariants(
  opts: { elevation?: CardElevation; interactive?: boolean; gradientBorder?: boolean } = {}
): string {
  const { elevation = 'raised', interactive = false, gradientBorder = false } = opts;

  return join(
    CARD_BASE,
    CARD_ELEVATIONS[elevation],
    interactive && 'hover-pop cursor-pointer',
    gradientBorder && 'gradient-border'
  );
}

const HEADING_SIZES: Record<number, string> = {
  1: 'text-[length:var(--text-display)] leading-[1.05]',
  2: 'text-[length:var(--text-display-sm)] leading-tight',
  3: 'text-2xl sm:text-3xl',
  4: 'text-xl',
};

export function headingVariants(opts: { level?: 1 | 2 | 3 | 4; gradient?: boolean; animated?: boolean } = {}): string {
  const { level = 2, gradient = false, animated = false } = opts;

  // animated takes precedence over gradient (set last so it wins).
  let color = 'text-foreground';

  if (gradient) color = 'brand-gradient-text';

  if (animated) color = 'text-gradient-animated';

  return join('font-display font-bold tracking-tight', HEADING_SIZES[level], color);
}
