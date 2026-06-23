// Small monochrome marks for the Copy-page menu rows. lucide has no brand logos, so these are simple,
// recognisable glyphs drawn in `currentColor` to match the muted icon treatment of the surrounding UI.

type MarkProps = { className?: string };

// The CommonMark "M↓" badge.
export const MarkdownMark = ({ className }: MarkProps) => (
  <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <rect x="0.75" y="2.75" width="14.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3.4 11V5h1.4l1.6 2 1.6-2h1.4v6H8.6V7.1L7 9.05 5.4 7.1V11H3.4Z" fill="currentColor" />
    <path
      d="M12 5v3.4M12 8.4 10.7 7.1M12 8.4l1.3-1.3"
      stroke="currentColor"
      strokeWidth="1.3"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

// OpenAI flower, simplified to a single interlocked outline.
export const ChatGptMark = ({ className }: MarkProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M22.28 9.82a5.98 5.98 0 0 0-.52-4.91 6.05 6.05 0 0 0-6.51-2.9A5.98 5.98 0 0 0 10.74 0a6.05 6.05 0 0 0-5.77 4.19 5.98 5.98 0 0 0-4 2.9 6.05 6.05 0 0 0 .74 7.1 5.98 5.98 0 0 0 .52 4.91 6.05 6.05 0 0 0 6.51 2.9A5.98 5.98 0 0 0 13.26 24a6.05 6.05 0 0 0 5.77-4.2 5.98 5.98 0 0 0 4-2.9 6.05 6.05 0 0 0-.75-7.08Zm-9.02 12.6a4.48 4.48 0 0 1-2.88-1.04l.14-.08 4.78-2.76a.78.78 0 0 0 .4-.68V11.1l2.02 1.17a.07.07 0 0 1 .04.06v5.58a4.5 4.5 0 0 1-4.5 4.5Zm-9.66-4.13a4.47 4.47 0 0 1-.54-3.01l.14.09 4.78 2.76a.78.78 0 0 0 .78 0l5.84-3.37v2.33a.07.07 0 0 1-.03.06l-4.83 2.79a4.5 4.5 0 0 1-6.14-1.65ZM2.34 7.9a4.48 4.48 0 0 1 2.34-1.97V11.6a.78.78 0 0 0 .39.68l5.81 3.36-2.02 1.17a.07.07 0 0 1-.07 0l-4.83-2.79A4.5 4.5 0 0 1 2.34 7.9Zm16.6 3.86-5.84-3.4 2.02-1.16a.07.07 0 0 1 .07 0l4.83 2.78a4.5 4.5 0 0 1-.68 8.12v-5.66a.78.78 0 0 0-.4-.68Zm2.01-3.02-.14-.09-4.77-2.78a.78.78 0 0 0-.79 0L9.42 9.24V6.91a.07.07 0 0 1 .03-.06l4.83-2.79a4.5 4.5 0 0 1 6.68 4.66ZM8.32 12.86 6.3 11.7a.07.07 0 0 1-.04-.06V6.07a4.5 4.5 0 0 1 7.38-3.45l-.14.08L8.72 5.46a.78.78 0 0 0-.4.68v6.71Zm1.1-2.36L12 9.01l2.59 1.49v2.99L12 14.98l-2.59-1.49v-2.99Z" />
  </svg>
);

// Anthropic / Claude burst mark.
export const ClaudeMark = ({ className }: MarkProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M4.7 15.5 9.2 13l.08-.22-.08-.13H8.97l-.74-.04-2.5-.07-2.18-.09-2.1-.11-.53-.11L.4 11.6l.05-.32.44-.3.64.06 1.4.1 2.1.14 1.53.09 2.26.23h.36l.05-.15-.12-.09-.1-.09-2.18-1.48-2.36-1.56-1.24-.9-.67-.46-.34-.42-.14-.94.6-.66.82.05.2.06.83.64 1.78 1.38 2.32 1.7.34.29.14-.1.02-.07-.15-.26L8.1 5.8l-1.3-2.23-.58-.93-.15-.56a2.7 2.7 0 0 1-.1-.66l.7-.94L7.26 0l.93.13.4.34.57 1.32 .94 2.08 1.45 2.84.43.84.23.78.08.24h.15v-.14l.12-1.62.22-1.99.22-2.56.07-.72.36-.86.7-.47.55.27.46.65-.06.42-.27 1.77-.54 2.8-.35 1.87h.2l.24-.24.95-1.27 1.6-2 .71-.8.83-.88.53-.42h1l.74 1.1-.33 1.13-1.03 1.31-.86 1.11-1.23 1.66-.77 1.32.07.1.18-.02 2.8-.6 1.51-.27 1.8-.31.82.38.09.39-.32.79-1.94.48-2.27.45-3.39.8-.04.03.05.06 1.52.14.65.04h1.6l2.96.22.78.51.46.63-.08.47-1.2.6-1.6-.37-3.76-.9-1.29-.32h-.18v.1l1.07 1.05 1.97 1.78 2.46 2.29.13.57-.32.45-.34-.05-2.2-1.66-.85-.74-1.92-1.62h-.13v.17l.45.65 2.33 3.5.12 1.07-.17.35-.6.21-.66-.12-1.36-1.9-1.4-2.15-1.13-1.92-.14.08-.66 7.16-.31.36-.72.27-.6-.45-.31-.72.31-1.45.39-1.9.31-1.51.28-1.87.17-.62-.01-.04-.14.02-1.4 1.92-2.12 2.87-1.68 1.8-.4.16-.7-.36.06-.65.4-.57 2.32-2.95 1.4-1.83.9-1.06v-.15h-.05L4.97 18.4l-1.43.18-.62-.58.08-.94.29-.3 2.4-1.65Z" />
  </svg>
);

// Cursor cube.
export const CursorMark = ({ className }: MarkProps) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M12 2 3 7v10l9 5 9-5V7l-9-5Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M12 12 3 7M12 12v10M12 12l9-5" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M12 12 21 7" stroke="currentColor" strokeWidth="1.4" opacity="0.5" />
  </svg>
);

// VS Code chevron logo.
export const VscodeMark = ({ className }: MarkProps) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path d="M17 2 8.5 10.2 4 6.7 2 7.7v8.6l2 1 4.5-3.5L17 22l5-2.3V4.3L17 2Zm0 4.7v10.6L10.3 12 17 6.7Z" />
  </svg>
);
