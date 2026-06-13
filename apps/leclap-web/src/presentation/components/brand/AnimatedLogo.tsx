import { useId } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface AnimatedLogoProps {
  /** Rendered width/height in px (the SVG is square). */
  size?: number;
  /** Play the one-shot "clap" intro (slate pops in, the clapper snaps shut with a flash). */
  play?: boolean;
  className?: string;
}

// The LeClap clapperboard mark (same geometry as public/favicon.svg) with the hinged clapper bar +
// teeth split into their own `.lc-clap` group so it can rotate at the hinge — the "clap!" beat.
// Motion lives in index.css (.lc-logo-play …); without `play` it renders the static closed board,
// which is also the reduced-motion end state.
export const AnimatedLogo = ({ size = 128, play = false, className }: AnimatedLogoProps) => {
  const { t } = useTranslation();
  const gradId = useId();

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label={t('brand')}
      className={cn('lc-logo', play && 'lc-logo-play', className)}
    >
      <defs>
        <linearGradient id={gradId} x1="80" y1="64" x2="432" y2="448" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C83FD" />
          <stop offset="1" stopColor="#FF8AAE" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${gradId})`} />
      <g transform="rotate(-9 256 248)">
        <g className="lc-slate">
          <rect x="124" y="172" width="264" height="200" rx="22" fill="#fff" />
          <path d="M230 232v96l82-48z" fill={`url(#${gradId})`} />
        </g>
        <g className="lc-clap">
          <rect x="112" y="100" width="288" height="58" rx="14" fill="#fff" />
          <g fill={`url(#${gradId})`}>
            <path d="M150 100h36l-24 58h-36z" />
            <path d="M214 100h36l-24 58h-36z" />
            <path d="M278 100h36l-24 58h-36z" />
            <path d="M342 100h30l-24 58h-30z" />
          </g>
        </g>
      </g>
      <rect className="lc-flash" width="512" height="512" rx="116" fill="#fff" opacity="0" />
    </svg>
  );
};
