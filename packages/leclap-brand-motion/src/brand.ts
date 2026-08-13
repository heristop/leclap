// The single source of the LeClap palette for every motion composition. Values mirror the app's
// `@theme` tokens in apps/leclap-web/src/index.css, so a rendered video and the site it promotes can
// never drift apart. Each entry names the token it tracks; change it there first, then here.
//
// Bumper.tsx and Kinetic.tsx used to carry their own copies, which had already diverged: two
// different inks, and a yellow predating the pastel accent. They import from here now.

/** `--color-brand-500` — Bleu lavande. Primary. */
export const LAVENDER = '#7C83FD';

/** `--color-secondary-500` — Rose clair. Reserved for playheads and accents on dark. */
export const PINK = '#FF8AAE';

/** `--color-accent-500` — Jaune pastel. The clapper's border and stripes. */
export const YELLOW = '#FFF685';

/** A lighter tint of the accent for the clapper's alternating stripes. Derived, not a token. */
export const STRIPE_YELLOW = '#FFFAC4';

/** `--color-background` in dark mode — the ground every composition sits on. */
export const INK = '#111215';

// The signature lavender→pink brand gradient (logo + primary CTAs), at 135°.
export const BRAND_GRADIENT = `linear-gradient(135deg, ${LAVENDER}, ${PINK})`;
