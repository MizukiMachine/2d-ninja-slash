/// <reference types="vite/client" />

declare module 'virtual:debug-backgrounds' {
  export const BACKGROUND_FILE_NAMES_BY_SPRITE_SET: {
    readonly current: readonly string[];
    readonly legacy: readonly string[];
  };

  export const BACKGROUND_URLS_BY_SPRITE_SET: {
    readonly current: Readonly<Record<string, string>>;
    readonly legacy: Readonly<Record<string, string>>;
  };

  export const DEFAULT_DEBUG_BACKGROUND_FILE_NAMES: {
    readonly current: string;
    readonly legacy: string;
  };
}
