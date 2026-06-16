/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the compile server (`/compile`, `/templates`, `/health`). Defaults to the local dev server. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
