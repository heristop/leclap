/**
 * Pure helpers for the media selection step — no Expo / native imports, so these
 * can be exercised by the ts-jest unit-test suite (jest.unit.config.cjs) without
 * the Metro bundler or Expo native modules.
 */

/**
 * Returns true when the template's global section offers any media selection
 * (library shortlist or free upload), so the UI knows whether to show the Media row.
 */
export function needsMediaStep(global?: {
  allowedMusic?: string[];
  allowUploadMusic?: boolean;
  allowedBackgrounds?: string[];
  allowUploadBackground?: boolean;
}): boolean {
  if (!global) return false;

  return (
    (global.allowedMusic?.length ?? 0) > 0 ||
    Boolean(global.allowUploadMusic) ||
    (global.allowedBackgrounds?.length ?? 0) > 0 ||
    Boolean(global.allowUploadBackground)
  );
}
