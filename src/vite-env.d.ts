/// <reference types="vite/client" />

declare module 'virtual:debug-backgrounds' {
  export const BACKGROUND_FILE_NAMES: readonly string[];

  export const BACKGROUND_URLS: Readonly<Record<string, string>>;

  export const DEFAULT_DEBUG_BACKGROUND_FILE_NAME: string;
}
