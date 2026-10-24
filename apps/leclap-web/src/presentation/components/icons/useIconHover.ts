import { useRef } from 'react';
import type { AnimatedIconHandle } from './leclap-icon';

export type { AnimatedIconHandle } from './leclap-icon';

/**
 * Plays an icon's gesture from an ancestor's hover (group hover). Spread `hoverProps` on the interactive element
 * (button/link) and pass `ref` to the icon, so the icon moves whenever the whole control is hovered, not just
 * the glyph (a shadcn Button's `[&_svg]:pointer-events-none` blocks the glyph's own hover).
 */
export function useIconHover() {
  const ref = useRef<AnimatedIconHandle>(null);

  const hoverProps = {
    onMouseEnter: () => ref.current?.startAnimation(),
    onMouseLeave: () => ref.current?.stopAnimation(),
  };

  return { ref, hoverProps };
}
