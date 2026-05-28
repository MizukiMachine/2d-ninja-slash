import { readFileSync, statSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ALL_BGM_TRACKS,
  BGM_TRACKS,
  DEFAULT_BGM_TRACK_ID,
  GAME_OVER_BGM_TRACK,
  GAME_OVER_BGM_TRACK_ID,
  SFX_CUES,
  getBgmTrack,
  getSfxCue,
  isBgmTrackId
} from '../src/game/assets/audioAssetCatalog';
import assetIndex from '../public/assets/index.json';

interface AudioAssetIndexEntry {
  readonly key: string;
  readonly type: string;
  readonly path: string;
  readonly metadata?: {
    readonly requestedDurationMs?: number;
  };
  readonly phaser?: {
    readonly loader?: string;
    readonly audioKey?: string;
    readonly urls?: readonly string[];
  };
}

interface AudioAssetIndex {
  readonly assets: readonly AudioAssetIndexEntry[];
  readonly collections: {
    readonly bgm?: readonly string[];
    readonly sfx?: readonly string[];
  };
}

function getPublicFilePath(publicUrl: string): URL {
  return new URL(`../public/${publicUrl.replace(/^\//u, '')}`, import.meta.url);
}

function expectMp3File(publicUrl: string): number {
  const filePath = getPublicFilePath(publicUrl);
  const file = readFileSync(filePath);
  const fileSize = statSync(filePath).size;

  expect(fileSize).toBeGreaterThan(1024);
  expect(file.subarray(0, 3).toString('ascii')).toBe('ID3');

  return fileSize;
}

describe('audio asset catalog', () => {
  it('defines four selectable ninja combat BGM tracks', () => {
    expect(BGM_TRACKS).toHaveLength(4);
    expect(isBgmTrackId(DEFAULT_BGM_TRACK_ID)).toBe(true);
    expect(getBgmTrack(DEFAULT_BGM_TRACK_ID).label).toBe('Shadow Dojo');

    const ids = new Set(BGM_TRACKS.map((track) => track.id));
    const keys = new Set(BGM_TRACKS.map((track) => track.key));

    expect(ids.size).toBe(BGM_TRACKS.length);
    expect(keys.size).toBe(BGM_TRACKS.length);

    for (const track of BGM_TRACKS) {
      expect(track.durationMs).toBeGreaterThanOrEqual(90_000);
    }
  });

  it('defines a dedicated Game Over BGM outside the selectable debug tracks', () => {
    expect(BGM_TRACKS.map((track) => track.id)).not.toContain(GAME_OVER_BGM_TRACK_ID);
    expect(ALL_BGM_TRACKS.map((track) => track.id)).toContain(GAME_OVER_BGM_TRACK_ID);
    expect(getBgmTrack(GAME_OVER_BGM_TRACK_ID)).toEqual(GAME_OVER_BGM_TRACK);
    expect(GAME_OVER_BGM_TRACK.durationMs).toBeGreaterThanOrEqual(60_000);
  });

  it('defines major combat and UI sound effect cues', () => {
    expect(SFX_CUES.map((cue) => cue.id)).toEqual([
      'ui-select',
      'player-slash',
      'enemy-slash',
      'jump',
      'lane-dash',
      'hit',
      'player-hurt',
      'enemy-defeat',
      'player-defeat',
      'main-ninja-death',
      'round-clear',
      'round-start'
    ]);
    expect(getSfxCue('player-slash').key).toBe('sfx.playerSlash');
    expect(getSfxCue('main-ninja-death').key).toBe('sfx.mainNinjaDeath');
  });

  it('has generated mp3 files for every audio asset', () => {
    for (const track of ALL_BGM_TRACKS) {
      const minimumSize = track.id === GAME_OVER_BGM_TRACK_ID ? 600_000 : 900_000;

      expect(expectMp3File(track.path)).toBeGreaterThan(minimumSize);
    }

    for (const cue of SFX_CUES) {
      expectMp3File(cue.path);
    }
  });

  it('registers BGM and SFX in the shared asset index', () => {
    const index = assetIndex as AudioAssetIndex;
    const entriesByKey = new Map(index.assets.map((asset) => [asset.key, asset]));

    expect(index.collections.bgm).toEqual(ALL_BGM_TRACKS.map((track) => track.key));
    expect(index.collections.sfx).toEqual(SFX_CUES.map((cue) => cue.key));

    for (const track of ALL_BGM_TRACKS) {
      expect(entriesByKey.get(track.key)).toMatchObject({
        type: 'bgm-audio',
        path: track.path,
        phaser: {
          loader: 'audio',
          audioKey: track.key,
          urls: [track.path]
        },
        metadata: {
          requestedDurationMs: track.durationMs
        }
      });
    }

    for (const cue of SFX_CUES) {
      expect(entriesByKey.get(cue.key)).toMatchObject({
        type: 'sfx-audio',
        path: cue.path,
        phaser: {
          loader: 'audio',
          audioKey: cue.key,
          urls: [cue.path]
        }
      });
    }
  });
});
