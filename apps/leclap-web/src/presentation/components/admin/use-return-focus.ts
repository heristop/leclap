import { useRef } from 'react';

const canTakeFocus = (element: HTMLElement | null): element is HTMLElement =>
  element?.isConnected === true && !element.matches(':disabled');

// Radix's modal dialog hands focus back to its DialogTrigger on close. These dialogs open from state —
// a card's icon button, a titlebar action — with no trigger, so focus would drop to <body> and a
// keyboard user would restart from the top of the page. Spread the handlers on DialogContent: the
// opener is captured as the dialog opens (before Radix moves focus into it) and gets focus back on
// close, or `fallback()` does when the opener is gone or disabled (the card that was just deleted).
export function useReturnFocus(fallback?: () => HTMLElement | null) {
  const opener = useRef<HTMLElement | null>(null);

  return {
    onOpenAutoFocus: () => {
      opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    },
    onCloseAutoFocus: (event: Event) => {
      event.preventDefault();
      const target = canTakeFocus(opener.current) ? opener.current : (fallback?.() ?? null);
      opener.current = null;
      target?.focus();
    },
  };
}
