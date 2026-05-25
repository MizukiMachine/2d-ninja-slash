export const DEBUG_SPRITE_SHEET_SET_OPTIONS = [
  { id: 'current', label: 'Current 512px' },
  { id: 'legacy', label: 'Legacy 216px' }
] as const;

export type DebugSpriteSheetSet = (typeof DEBUG_SPRITE_SHEET_SET_OPTIONS)[number]['id'];

export const DEBUG_SPRITE_SHEET_SET_IDS = DEBUG_SPRITE_SHEET_SET_OPTIONS.map(
  (option) => option.id
) as readonly DebugSpriteSheetSet[];

export const BACKGROUND_FILE_NAMES_BY_SPRITE_SET = {
  current: [
    'bamboo-ravine-lanes-tight.png',
    'three-lane-hq-rain-village.png',
    'three-lane-hq-rain-village-slightly-rough.png'
  ],
  legacy: [
    'bamboo-ravine-lanes-tight.png',
    'rain-village-alley.png',
    'three-lane-rough-bamboo-shrine.png',
    'three-lane-rough-castle-courtyard.png',
    'three-lane-rough-rain-village.png',
    'three-lane-rough-snow-dojo.png'
  ]
} as const satisfies Record<DebugSpriteSheetSet, readonly string[]>;

export type DebugBackgroundFileName =
  (typeof BACKGROUND_FILE_NAMES_BY_SPRITE_SET)[DebugSpriteSheetSet][number];

export type DebugBackgroundFileNamesBySpriteSet = Record<
  DebugSpriteSheetSet,
  DebugBackgroundFileName
>;

export const DEFAULT_DEBUG_BACKGROUND_FILE_NAMES = {
  current: 'bamboo-ravine-lanes-tight.png',
  legacy: 'bamboo-ravine-lanes-tight.png'
} as const satisfies DebugBackgroundFileNamesBySpriteSet;

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
