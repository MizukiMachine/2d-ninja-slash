import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type SpriteSheetSetId = 'current' | 'legacy';

interface SpriteSheetSetExpectation {
  readonly id: SpriteSheetSetId;
  readonly backgroundFileName: string;
  readonly backgroundWidth: number;
  readonly backgroundHeight: number;
  readonly width: number;
  readonly height: number;
}

const SPRITE_SHEET_SETS: readonly SpriteSheetSetExpectation[] = [
  {
    id: 'current',
    backgroundFileName: 'three-lane-hq-rain-village.png',
    backgroundWidth: 1672,
    backgroundHeight: 941,
    width: 4096,
    height: 2048
  },
  {
    id: 'legacy',
    backgroundFileName: 'three-lane-rough-rain-village.png',
    backgroundWidth: 1280,
    backgroundHeight: 720,
    width: 1728,
    height: 864
  }
];

const MAIN_NINJA_ACTIONS = [
  'idle',
  'run',
  'jump',
  'slash',
  'slash2',
  'slash3',
  'impact'
] as const;
const ENEMY_NINJA_ACTIONS = ['idle', 'run', 'jump', 'slash'] as const;
const DIRECTIONS = ['left', 'right'] as const;

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
    for (const action of MAIN_NINJA_ACTIONS) {
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

  it.each(SPRITE_SHEET_SETS)('has a $id background with expected dimensions', (set) => {
    const filePath = new URL(
      `../public/assets/${set.id}/backgrounds/${set.backgroundFileName}`,
      import.meta.url
    );

    expect(getPngSize(filePath)).toEqual({
      width: set.backgroundWidth,
      height: set.backgroundHeight
    });
  });
});
