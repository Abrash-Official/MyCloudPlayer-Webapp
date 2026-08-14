/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_YOUTUBE_API_KEY?: string;
  readonly VITE_EXTRACT_API_URL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
