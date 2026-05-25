import {
  BACKGROUND_FILE_NAMES_BY_SPRITE_SET as GENERATED_BACKGROUND_FILE_NAMES_BY_SPRITE_SET,
  BACKGROUND_URLS_BY_SPRITE_SET as GENERATED_BACKGROUND_URLS_BY_SPRITE_SET,
  DEFAULT_DEBUG_BACKGROUND_FILE_NAMES as GENERATED_DEFAULT_DEBUG_BACKGROUND_FILE_NAMES
} from 'virtual:debug-backgrounds';

export const DEBUG_SPRITE_SHEET_SET_OPTIONS = [
  { id: 'current', label: 'Current 512px' },
  { id: 'legacy', label: 'Legacy 216px' }
] as const;

export type DebugSpriteSheetSet = (typeof DEBUG_SPRITE_SHEET_SET_OPTIONS)[number]['id'];

export const DEBUG_SPRITE_SHEET_SET_IDS = DEBUG_SPRITE_SHEET_SET_OPTIONS.map(
  (option) => option.id
) as readonly DebugSpriteSheetSet[];

export const BACKGROUND_FILE_NAMES_BY_SPRITE_SET =
  GENERATED_BACKGROUND_FILE_NAMES_BY_SPRITE_SET satisfies Record<
    DebugSpriteSheetSet,
    readonly string[]
  >;

export const BACKGROUND_URLS_BY_SPRITE_SET =
  GENERATED_BACKGROUND_URLS_BY_SPRITE_SET satisfies Record<
    DebugSpriteSheetSet,
    Readonly<Record<string, string>>
  >;

export type DebugBackgroundFileName = string;

export type DebugBackgroundFileNamesBySpriteSet = Record<
  DebugSpriteSheetSet,
  DebugBackgroundFileName
>;

export const DEFAULT_DEBUG_BACKGROUND_FILE_NAMES =
  GENERATED_DEFAULT_DEBUG_BACKGROUND_FILE_NAMES satisfies DebugBackgroundFileNamesBySpriteSet;

export function isDebugSpriteSheetSet(value: string): value is DebugSpriteSheetSet {
  return DEBUG_SPRITE_SHEET_SET_IDS.includes(value as DebugSpriteSheetSet);
}

export function isDebugBackgroundFileName(
  spriteSheetSet: DebugSpriteSheetSet,
  value: string
): value is DebugBackgroundFileName {
  return BACKGROUND_FILE_NAMES_BY_SPRITE_SET[spriteSheetSet].some(
    (fileName) => fileName === value
  );
}

export function getDebugBackgroundUrl(
  spriteSheetSet: DebugSpriteSheetSet,
  backgroundFileName: DebugBackgroundFileName
): string | undefined {
  return BACKGROUND_URLS_BY_SPRITE_SET[spriteSheetSet][backgroundFileName];
}
