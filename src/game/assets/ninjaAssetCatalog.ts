import {
  BACKGROUND_FILE_NAMES as GENERATED_BACKGROUND_FILE_NAMES,
  BACKGROUND_URLS as GENERATED_BACKGROUND_URLS,
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME as GENERATED_DEFAULT_DEBUG_BACKGROUND_FILE_NAME
} from 'virtual:debug-backgrounds';

export const BACKGROUND_FILE_NAMES = GENERATED_BACKGROUND_FILE_NAMES satisfies readonly string[];

export const BACKGROUND_URLS = GENERATED_BACKGROUND_URLS satisfies Readonly<
  Record<string, string>
>;

export type DebugBackgroundFileName = string;

export const DEFAULT_DEBUG_BACKGROUND_FILE_NAME =
  GENERATED_DEFAULT_DEBUG_BACKGROUND_FILE_NAME satisfies DebugBackgroundFileName;

export function isDebugBackgroundFileName(value: string): value is DebugBackgroundFileName {
  return BACKGROUND_FILE_NAMES.some((fileName) => fileName === value);
}

export function getDebugBackgroundUrl(
  backgroundFileName: DebugBackgroundFileName
): string | undefined {
  return BACKGROUND_URLS[backgroundFileName];
}
