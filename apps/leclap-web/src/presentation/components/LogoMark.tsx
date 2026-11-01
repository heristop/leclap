import { forwardRef, useId, useImperativeHandle, useRef } from 'react';

export interface LogoMarkHandle {
  clap: () => void;
}

// The LeClap mark, inlined so the clapper top can clap on hover. Mirrors public/favicon.svg;
// hovering the disc fires the SMIL `animateTransform` (open → slam shut → settle open).
// Exposes `clap()` imperatively so a parent (e.g. the header link) can trigger it from its own hover.
export const LogoMark = forwardRef<LogoMarkHandle, { className?: string }>(({ className }, ref) => {
  const id = useId();
  const animRef = useRef<SVGAnimateTransformElement>(null);

  useImperativeHandle(ref, () => ({
    clap: () => animRef.current?.beginElement(),
  }));

  return (
    <svg
      viewBox="0 0 600 600"
      aria-hidden="true"
      className={`logo-mark ${className ?? ''}`}
      onMouseEnter={() => animRef.current?.beginElement()}
    >
      <defs>
        <linearGradient id={`${id}-lcg`} x1="110" y1="90" x2="490" y2="510" gradientUnits="userSpaceOnUse">
          <stop stopColor="var(--logo-disc-start)" />
          <stop offset="1" stopColor="var(--logo-disc-end)" />
        </linearGradient>
        <pattern id={`${id}-lcs`} width="96" height="96" patternUnits="userSpaceOnUse" patternTransform="rotate(-26)">
          <rect width="96" height="96" fill="var(--logo-stripe-light)" />
          <rect x="48" width="48" height="96" fill="var(--logo-stripe-dark)" />
        </pattern>
        <linearGradient id={`${id}-lcBoard`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#FFA0B7" />
          <stop offset="1" stopColor="#EE6184" />
        </linearGradient>
        <linearGradient id={`${id}-lcRing`} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--logo-ring-start)" />
          <stop offset="0.55" stopColor="var(--logo-ring-middle)" />
          <stop offset="1" stopColor="var(--logo-ring-end)" />
        </linearGradient>
        <radialGradient id={`${id}-lcSheen`} cx="0.5" cy="0.14" r="0.64">
          <stop stopColor="#FFFFFF" stopOpacity="var(--logo-sheen)" />
          <stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-lsh`} x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0" stdDeviation="10" floodColor="#1C1540" floodOpacity="var(--logo-shadow)" />
        </filter>
      </defs>
      <circle
        cx="300"
        cy="300"
        r="278"
        fill={`url(#${id}-lcg)`}
        stroke={`url(#${id}-lcRing)`}
        strokeWidth="var(--logo-ring-width)"
      />
      <circle cx="300" cy="300" r="264" fill={`url(#${id}-lcSheen)`} />
      <circle cx="300" cy="300" r="263" fill="none" stroke="#5A4E9A" strokeOpacity="0.12" strokeWidth="3" />
      <g transform="translate(300 300) scale(0.68) translate(-298 -304)" filter={`url(#${id}-lsh)`}>
        <rect
          x="96"
          y="302"
          width="408"
          height="194"
          rx="40"
          fill={`url(#${id}-lcBoard)`}
          stroke="var(--logo-outline)"
          strokeWidth="24"
          strokeLinejoin="round"
        />
        <rect
          x="132"
          y="252"
          width="372"
          height="58"
          rx="18"
          fill={`url(#${id}-lcs)`}
          stroke="var(--logo-outline)"
          strokeWidth="24"
          strokeLinejoin="round"
        />
        <g transform="rotate(-25 140 250)">
          <animateTransform
            ref={animRef}
            attributeName="transform"
            type="rotate"
            values="-25 140 250; 4 140 250; -30 140 250; -25 140 250"
            keyTimes="0; 0.34; 0.7; 1"
            dur="0.55s"
            calcMode="spline"
            keySplines="0.5 0 0.4 1; 0.3 0 0.2 1; 0.35 0 0.2 1"
            begin="indefinite"
            fill="freeze"
          />
          <rect
            x="132"
            y="192"
            width="372"
            height="58"
            rx="18"
            fill={`url(#${id}-lcs)`}
            stroke="var(--logo-outline)"
            strokeWidth="24"
            strokeLinejoin="round"
          />
        </g>
        <rect
          x="90"
          y="216"
          width="80"
          height="96"
          rx="24"
          fill={`url(#${id}-lcBoard)`}
          stroke="var(--logo-outline)"
          strokeWidth="24"
          strokeLinejoin="round"
        />
        <circle cx="130" cy="264" r="17" fill="var(--logo-hinge)" stroke="var(--logo-outline)" strokeWidth="6" />
      </g>
    </svg>
  );
});

LogoMark.displayName = 'LogoMark';
