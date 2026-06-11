/**
 * Build-time runtime flags, read from `EXPO_PUBLIC_*` env vars (Expo inlines these at bundle time).
 *
 * `EXPO_PUBLIC_ENABLE_SERVER` toggles whether the server compile option is offered at all:
 *   - unset / "true" / "1"  → server option available (the Settings switch is shown; default Local)
 *   - "false" / "0" / "off" → server option hidden; the app is on-device only and never calls the server
 *
 * Set it in `.env`/`.env.local` (e.g. `EXPO_PUBLIC_ENABLE_SERVER=false` for a pure-serverless build).
 */
const FALSY = new Set(['false', '0', 'off', 'no']);

export const isServerOptionEnabled = (): boolean => {
  const raw = process.env.EXPO_PUBLIC_ENABLE_SERVER;

  if (raw === undefined || raw === '') {
    return true; // server option available by default; the user still defaults to Local
  }

  return !FALSY.has(raw.trim().toLowerCase());
};
