// Shared orientation presentation metadata — one icon per format, reused by the editor's orientation
// toggle, the template detail row, and the template card so they never drift. Labels come from i18n
// (`orientation.<value>`); the union itself is the shared `Orientation` (landscape | portrait | square).
import type { Ionicons } from '@expo/vector-icons';
import type { Orientation } from '@/src/types';

type IoniconName = keyof typeof Ionicons.glyphMap;

export const ORIENTATION_ICON: Record<Orientation, IoniconName> = {
  landscape: 'phone-landscape-outline',
  portrait: 'phone-portrait-outline',
  square: 'square-outline',
};

// Display order for the editor's orientation toggle.
export const ORIENTATION_ORDER: Orientation[] = ['landscape', 'portrait', 'square'];

// Frame aspect ratio (width / height) per orientation — drives preview/overlay sizing across the app.
export const ASPECT_RATIO: Record<Orientation, number> = {
  landscape: 16 / 9,
  portrait: 9 / 16,
  square: 1,
};

// Coerce a free-form descriptor/route string into the orientation union (defaults to portrait, the
// app's mobile-first default).
export const parseOrientation = (value: string | undefined): Orientation => {
  if (value === 'landscape') return 'landscape';

  if (value === 'square') return 'square';

  return 'portrait';
};

// The device orientation to lock the camera to while recording. A square clip is shot with the phone
// held upright (portrait device); the engine then center-crops the frame to 1:1.
export const toDeviceOrientation = (orientation: Orientation): 'portrait' | 'landscape' =>
  orientation === 'landscape' ? 'landscape' : 'portrait';
