import {
  createElement,
  forwardRef,
  useId,
  useImperativeHandle,
  useRef,
  type CSSProperties,
  type ForwardRefExoticComponent,
  type RefAttributes,
  type SVGProps,
} from 'react';
import { GLYPHS, glyphParts, hasTint, type Glyph, type IconName, type PartRole } from '@leclap/creative-kit/icons';
import { cn } from '@/lib/utils';

// The LeClap icons on the web: the shared glyph table (@leclap/creative-kit/icons) drawn as an inline SVG, in the
// duotone style and with the glyph's one gesture (icons.css). The gesture plays while the icon is hovered, while
// the button or link it sits in is hovered, and while a parent holds it through the handle (useIconHover).

/** The handle a parent uses to play an icon's gesture from its own hover. */
export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'ref'> {
  /** Width and height, in px or any CSS length; 24 by default. */
  size?: number | string;
  /** Keep the line the same width on screen whatever the size. */
  absoluteStrokeWidth?: boolean;
}

export type IconComponent = ForwardRefExoticComponent<IconProps & RefAttributes<AnimatedIconHandle>>;

const partClass = ({ tint, solid, group }: PartRole): string | undefined =>
  cn(tint && 'lc-f', solid && 'lc-s', group === 1 && 'lc-m', group === 2 && 'lc-m2') || undefined;

const strokeOf = (strokeWidth: number | string, size: number | string, absolute: boolean | undefined) => {
  if (!absolute || typeof size !== 'number') return strokeWidth;

  return (Number(strokeWidth) * 24) / size;
};

/** One named icon component: size, color, strokeWidth and className like any SVG icon, plus the gesture handle. */
export const createIcon = (name: IconName, displayName: string): IconComponent => {
  const Icon = forwardRef<AnimatedIconHandle, IconProps>(
    ({ size = 24, color = 'currentColor', strokeWidth = 2, absoluteStrokeWidth, className, style, ...rest }, ref) => {
      const svg = useRef<SVGSVGElement>(null);
      const gradient = `lc-icon-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
      const glyph: Glyph = GLYPHS[name];
      const tinted = hasTint(name);
      const [ox, oy] = glyph.origin ?? [12, 12];
      const labelled = rest['aria-label'] !== undefined || rest['aria-labelledby'] !== undefined;

      useImperativeHandle(ref, () => ({
        startAnimation: () => svg.current?.setAttribute('data-animate', ''),
        stopAnimation: () => svg.current?.removeAttribute('data-animate'),
      }));

      const vars = {
        '--lc-origin': `${ox}px ${oy}px`,
        ...(tinted ? { '--lc-gradient': `url(#${gradient})` } : {}),
      } as CSSProperties;

      return (
        <svg
          ref={svg}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          width={size}
          height={size}
          fill="none"
          stroke={color}
          strokeWidth={strokeOf(strokeWidth, size, absoluteStrokeWidth)}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden={labelled ? undefined : true}
          data-motion={glyph.motion}
          className={cn('lc-icon', `lc-icon-${name}`, className)}
          style={{ ...vars, ...style }}
          {...rest}
        >
          {tinted ? (
            <defs>
              <linearGradient id={gradient} x1="2" y1="2" x2="22" y2="22" gradientUnits="userSpaceOnUse">
                <stop className="lc-stop-a" />
                <stop className="lc-stop-b" offset="1" />
              </linearGradient>
            </defs>
          ) : null}
          {glyphParts(name).map(([[tag, attrs], role], index) =>
            createElement(tag, {
              key: index,
              ...attrs,
              className: partClass(role),
              fill: role.solid ? color : undefined,
              pathLength: glyph.motion === 'draw' && role.group === 1 ? 1 : undefined,
            })
          )}
        </svg>
      );
    }
  );

  Icon.displayName = displayName;

  return Icon;
};
