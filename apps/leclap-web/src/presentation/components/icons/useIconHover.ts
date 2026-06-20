import { useRef } from 'react';

// Every lucide-animated icon's imperative handle exposes these two controls.
export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

/**
 * Drives a lucide-animated icon's animation from an ancestor's hover (group hover). Spread `hoverProps`
 * on the interactive element (button/link) and pass `ref` to the icon, so the icon animates whenever the
 * whole control is hovered — not just the glyph (a shadcn Button's `[&_svg]:pointer-events-none` blocks
 * the glyph's own hover, which is why driving it from the control is required).
 */
export function useIconHover() {
  const ref = useRef<AnimatedIconHandle>(null);

  const hoverProps = {
    onMouseEnter: () => {
      ref.current?.startAnimation();
    },
    onMouseLeave: () => {
      ref.current?.stopAnimation();
    },
  };

  return { ref, hoverProps };
}
