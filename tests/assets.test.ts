import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BACKGROUND_FILE_NAMES,
  BACKGROUND_URLS,
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME
} from '../src/game/assets/ninjaAssetCatalog';
import assetIndex from '../public/assets/index.json';

const SPRITE_SHEET_SIZE = {
  width: 1024,
  height: 512
} as const;
const MAIN_NINJA_ACTIONS = [
  'attack',
  'death',
  'idle',
  'impact',
  'jump',
  'run',
  'slash',
  'walk'
] as const;
const ENEMY_NINJA_ACTIONS = [
  'crouching',
  'death',
  'idle',
  'jump',
  'run',
  'slash',
  'walk'
] as const;
const DIRECTIONS = ['left', 'right'] as const;
const MAIN_NINJA_ACTORS = ['main-ninja', 'main-ninja-2p'] as const;
const ACTORS = [...MAIN_NINJA_ACTORS, 'enemy-ninja'] as const;
const STANDALONE_ANCHOR_FILES = ['anchor-left-native.png', 'anchor-right-native.png'] as const;

interface AssetIndexEntry {
  readonly key: string;
  readonly actor?: string;
  readonly action?: string;
}

interface AssetIndex {
  readonly assets: readonly AssetIndexEntry[];
  readonly collections: {
    readonly actors?: {
      readonly mainNinja?: readonly string[];
    };
  };
}

function getPngSize(filePath: URL): { width: number; height: number } {
  const png = readFileSync(filePath);

  expect(png.subarray(1, 4).toString('ascii')).toBe('PNG');

  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20)
  };
}

function getPublicFilePath(publicUrl: string): URL {
  return new URL(`../public/${publicUrl.replace(/^\//u, '')}`, import.meta.url);
}

function getAssetIndex(): AssetIndex {
  return assetIndex as AssetIndex;
}

function getBackgroundFileNamesFromDirectory(directory: URL): readonly string[] {
  return readdirSync(directory)
    .filter((fileName) => fileName.toLowerCase().endsWith('.png'))
    .sort((a, b) => a.localeCompare(b));
}

describe('ninja sprite sheet assets', () => {
  it('has complete 128px sprite sheets with expected dimensions', () => {
    for (const actor of MAIN_NINJA_ACTORS) {
      for (const action of MAIN_NINJA_ACTIONS) {
        for (const direction of DIRECTIONS) {
          const filePath = new URL(
            `../public/assets/actors/${actor}/${action}-${direction}.png`,
            import.meta.url
          );

          expect(getPngSize(filePath)).toEqual(SPRITE_SHEET_SIZE);
        }
      }
    }

    for (const action of ENEMY_NINJA_ACTIONS) {
      for (const direction of DIRECTIONS) {
        const filePath = new URL(
          `../public/assets/actors/enemy-ninja/${action}-${direction}.png`,
          import.meta.url
        );

        expect(getPngSize(filePath)).toEqual(SPRITE_SHEET_SIZE);
      }
    }
  });

  it('does not expose main ninja crouching assets', () => {
    const index = getAssetIndex();
    const mainNinjaCrouchingAssets = index.assets.filter(
      (asset) => asset.actor === 'mainNinja' && asset.action === 'crouching'
    );
    const mainNinjaCollection = index.collections.actors?.mainNinja ?? [];

    expect(mainNinjaCrouchingAssets).toEqual([]);
    expect(mainNinjaCollection).not.toContain(
      'character.mainNinja.left.crouching.spritesheet'
    );
    expect(mainNinjaCollection).not.toContain(
      'character.mainNinja.right.crouching.spritesheet'
    );

    for (const actor of MAIN_NINJA_ACTORS) {
      for (const direction of DIRECTIONS) {
        const filePath = new URL(
          `../public/assets/actors/${actor}/crouching-${direction}.png`,
          import.meta.url
        );

        expect(() => readFileSync(filePath)).toThrow();
      }
    }
  });

  it('derives actor anchors from idle sprite sheets', () => {
    for (const actor of ACTORS) {
      for (const fileName of STANDALONE_ANCHOR_FILES) {
        const filePath = new URL(
          `../public/assets/actors/${actor}/${fileName}`,
          import.meta.url
        );

        expect(() => readFileSync(filePath)).toThrow();
      }
    }
  });

  it('has selectable backgrounds', () => {
    for (const backgroundFileName of BACKGROUND_FILE_NAMES) {
      const backgroundUrl = BACKGROUND_URLS[backgroundFileName];

      expect(backgroundUrl).toBeDefined();

      const size = getPngSize(getPublicFilePath(backgroundUrl));
      expect(size.width).toBeGreaterThanOrEqual(1280);
      expect(size.height).toBeGreaterThanOrEqual(720);
    }
  });

  it('selects every background from the shared background directory', () => {
    const backgroundDirectory = new URL('../public/assets/backgrounds/', import.meta.url);
    const expectedFileNames = getBackgroundFileNamesFromDirectory(backgroundDirectory);

    expect(BACKGROUND_FILE_NAMES).toEqual(expectedFileNames);
  });

  it('uses the adopted castle courtyard default background', () => {
    expect(DEFAULT_DEBUG_BACKGROUND_FILE_NAME).toBe(
      'three-lane-rough-castle-courtyard.png'
    );
    expect(BACKGROUND_FILE_NAMES).toContain(DEFAULT_DEBUG_BACKGROUND_FILE_NAME);
  });
});
