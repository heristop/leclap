/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the compile server (`/compile`, `/templates`, `/health`). Defaults to the local dev server. */
  readonly VITE_API_URL?: string;
  /** Self-hosted Umami. Both together switch analytics away from GA — see config/analytics-mode.ts. */
  readonly VITE_UMAMI_SRC?: string;
  readonly VITE_UMAMI_WEBSITE_ID?: string;
  /** Only when the collect API answers on another origin than the script. */
  readonly VITE_UMAMI_HOST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
