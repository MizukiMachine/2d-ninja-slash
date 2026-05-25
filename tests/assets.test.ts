import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_FILE_NAMES_BY_SPRITE_SET,
  DEFAULT_DEBUG_BACKGROUND_FILE_NAMES,
  type DebugSpriteSheetSet
} from '../src/game/assets/ninjaAssetCatalog';

interface SpriteSheetSetExpectation {
  readonly id: DebugSpriteSheetSet;
  readonly width: number;
  readonly height: number;
}

const SPRITE_SHEET_SETS: readonly SpriteSheetSetExpectation[] = [
  {
    id: 'current',
    width: 4096,
    height: 2048
  },
  {
    id: 'legacy',
    width: 1728,
    height: 864
  }
];

const MAIN_NINJA_ACTIONS_BY_SPRITE_SET = {
  current: ['idle', 'run', 'jump', 'slash', 'slash2', 'slash3', 'impact'],
  legacy: ['idle', 'run', 'jump', 'slash', 'slash2', 'impact']
} as const satisfies Record<DebugSpriteSheetSet, readonly string[]>;
const ENEMY_NINJA_ACTIONS = ['idle', 'run', 'jump', 'slash'] as const;
const DIRECTIONS = ['left', 'right'] as const;
const ACTORS = ['main-ninja', 'enemy-ninja'] as const;
const STANDALONE_ANCHOR_FILES = ['anchor-left-native.png', 'anchor-right-native.png'] as const;

function getPngSize(filePath: URL): { width: number; height: number } {
  const png = readFileSync(filePath);

  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
}

describe('ninja sprite sheet assets', () => {
  it.each(SPRITE_SHEET_SETS)('has complete $id sprite sheets with expected dimensions', (set) => {
    for (const action of MAIN_NINJA_ACTIONS_BY_SPRITE_SET[set.id]) {
      for (const direction of DIRECTIONS) {
        const filePath = new URL(
          `../public/assets/${set.id}/actors/main-ninja/${action}-${direction}.png`,
          import.meta.url
        );

        expect(getPngSize(filePath)).toEqual({ width: set.width, height: set.height });
      }
    }

    for (const action of ENEMY_NINJA_ACTIONS) {
      for (const direction of DIRECTIONS) {
        const filePath = new URL(
          `../public/assets/${set.id}/actors/enemy-ninja/${action}-${direction}.png`,
          import.meta.url
        );

        expect(getPngSize(filePath)).toEqual({ width: set.width, height: set.height });
      }
    }
  });

  it.each(SPRITE_SHEET_SETS)('derives $id actor anchors from idle sprite sheets', (set) => {
    for (const actor of ACTORS) {
      for (const fileName of STANDALONE_ANCHOR_FILES) {
        const filePath = new URL(
          `../public/assets/${set.id}/actors/${actor}/${fileName}`,
          import.meta.url
        );

        expect(() => readFileSync(filePath)).toThrow();
      }
    }
  });

  it.each(SPRITE_SHEET_SETS)('has selectable $id backgrounds', (set) => {
    for (const backgroundFileName of BACKGROUND_FILE_NAMES_BY_SPRITE_SET[set.id]) {
      const filePath = new URL(
        `../public/assets/${set.id}/backgrounds/${backgroundFileName}`,
        import.meta.url
      );

      const size = getPngSize(filePath);
      expect(size.width).toBeGreaterThanOrEqual(1280);
      expect(size.height).toBeGreaterThanOrEqual(720);
    }
  });

  it.each(SPRITE_SHEET_SETS)('uses a valid default $id background', (set) => {
    expect(BACKGROUND_FILE_NAMES_BY_SPRITE_SET[set.id]).toContain(
      DEFAULT_DEBUG_BACKGROUND_FILE_NAMES[set.id]
    );
  });
});
