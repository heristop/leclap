// Simple/Advanced builder mode — pure persistence helpers, framework-free so they're unit-testable.
// Simple shows only essentials (name, orientation, scenes, add-section, save); Advanced reveals the
// per-section disclosure toggles + the global Advanced area.
export type BuilderMode = 'simple' | 'advanced';

export const BUILDER_MODE_KEY = 'leclap.builder.mode';

const isMode = (value: string | null): value is BuilderMode => value === 'simple' || value === 'advanced';

// Read the persisted mode, defaulting to 'simple' (the noob-friendly default) when absent or invalid.
// Tolerant of a missing/throwing storage (SSR, privacy mode) — never throws.
export function readBuilderMode(storage: Pick<Storage, 'getItem'> | undefined): BuilderMode {
  if (!storage) return 'simple';

  try {
    const raw = storage.getItem(BUILDER_MODE_KEY);

    return isMode(raw) ? raw : 'simple';
  } catch {
    return 'simple';
  }
}

// Persist the mode, swallowing storage errors so a blocked localStorage never breaks the editor.
export function writeBuilderMode(storage: Pick<Storage, 'setItem'> | undefined, mode: BuilderMode): void {
  if (!storage) return;

  try {
    storage.setItem(BUILDER_MODE_KEY, mode);
  } catch {
    // ignore — persistence is best-effort.
  }
}
