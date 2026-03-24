/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_META_PIXEL_ID?: string;
  readonly PUBLIC_SITE_URL?: string;
  readonly PUBLIC_ACCOUNT_URL?: string;
  readonly PUBLIC_APP_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
