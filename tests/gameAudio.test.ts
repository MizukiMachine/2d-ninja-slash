import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import {
  COMBAT_BGM_VOLUME,
  GAME_OVER_BGM_VOLUME
} from '../src/game/assets/audioAssetCatalog';

interface MockSound {
  readonly key: string;
  isPlaying: boolean;
  readonly setVolume: (value: number) => void;
  readonly play: (config?: unknown) => boolean;
  readonly stop: () => boolean;
  readonly destroy: () => void;
}

async function createTestGameAudio() {
  vi.resetModules();
  vi.doMock('phaser', () => ({
    default: {
      Loader: {
        Events: {
          COMPLETE: 'complete'
        }
      },
      Sound: {
        Events: {
          COMPLETE: 'complete'
        }
      }
    }
  }));

  const { createGameAudio } = await import('../src/game/audio/gameAudio');

  return createGameAudio();
}

function createMockSound(key: string, isPlaying = false): MockSound {
  let sound: MockSound;

  sound = {
    key,
    isPlaying,
    setVolume: vi.fn((_value: number) => undefined),
    play: vi.fn((_config?: unknown) => {
      sound.isPlaying = true;
      return true;
    }),
    stop: vi.fn(() => {
      sound.isPlaying = false;
      return true;
    }),
    destroy: vi.fn()
  };

  return sound;
}

function createAudioScene(initialSounds: MockSound[] = []) {
  const sounds = [...initialSounds];
  const add = vi.fn((key: string) => {
    const sound = createMockSound(key);

    sounds.push(sound);

    return sound;
  });
  const getAll = vi.fn((key?: string) => {
    if (key === undefined) {
      return sounds;
    }

    return sounds.filter((sound) => sound.key === key);
  });
  const remove = vi.fn((sound: MockSound) => {
    const index = sounds.indexOf(sound);

    if (index !== -1) {
      sounds.splice(index, 1);
    }

    sound.destroy();

    return index !== -1;
  });
  const scene = {
    cache: {
      audio: {
        exists: vi.fn(() => true)
      }
    },
    sound: {
      locked: false,
      add,
      getAll,
      remove
    }
  } as unknown as Phaser.Scene;

  return {
    add,
    getAll,
    remove,
    scene,
    sounds
  };
}

describe('gameAudio', () => {
  it('updates the active BGM volume even when the same track is already playing', async () => {
    const { add, scene, sounds } = createAudioScene();
    const audio = await createTestGameAudio();

    audio.playBgm(scene, 'boss-duel');
    const sound = sounds[0]!;

    audio.playBgm(scene, 'boss-duel');

    expect(add).toHaveBeenCalledTimes(1);
    expect(sound.setVolume).toHaveBeenCalledTimes(2);
    expect(sound.setVolume).toHaveBeenCalledWith(COMBAT_BGM_VOLUME);
    expect(sound.play).toHaveBeenCalledTimes(1);
  });

  it('adopts and quiets an already playing BGM sound from the sound manager', async () => {
    const playingSound = createMockSound('bgm.bossDuel', true);
    const duplicateSound = createMockSound('bgm.bossDuel', true);
    const { add, remove, scene, sounds } = createAudioScene([playingSound, duplicateSound]);
    const audio = await createTestGameAudio();

    audio.playBgm(scene, 'boss-duel');

    expect(add).not.toHaveBeenCalled();
    expect(remove).toHaveBeenCalledWith(duplicateSound);
    expect(sounds).toEqual([playingSound]);
    expect(playingSound.setVolume).toHaveBeenCalledWith(COMBAT_BGM_VOLUME);
    expect(playingSound.play).not.toHaveBeenCalled();
  });

  it('keeps BGM as one channel when switching between combat and game-over tracks', async () => {
    const combatSound = createMockSound('bgm.bossDuel', true);
    const staleGameOverSound = createMockSound('bgm.gameOverLament', true);
    const { add, remove, scene, sounds } = createAudioScene([combatSound, staleGameOverSound]);
    const audio = await createTestGameAudio();

    audio.playBgm(scene, 'boss-duel');

    expect(remove).toHaveBeenCalledWith(staleGameOverSound);
    expect(combatSound.setVolume).toHaveBeenCalledWith(COMBAT_BGM_VOLUME);

    add.mockClear();
    remove.mockClear();

    audio.playBgm(scene, 'game-over-lament');

    const gameOverSound = sounds.find((sound) => sound.key === 'bgm.gameOverLament')!;

    expect(add).toHaveBeenCalledWith('bgm.gameOverLament', {
      loop: true,
      volume: GAME_OVER_BGM_VOLUME
    });
    expect(remove).toHaveBeenCalledWith(combatSound);
    expect(combatSound.destroy).toHaveBeenCalledTimes(1);
    expect(gameOverSound.setVolume).toHaveBeenCalledWith(GAME_OVER_BGM_VOLUME);
    expect(gameOverSound.play).toHaveBeenCalledWith({
      loop: true,
      volume: GAME_OVER_BGM_VOLUME
    });
    expect(sounds.map((sound) => sound.key)).toEqual(['bgm.gameOverLament']);
  });

  it('plays SFX through an explicit sound instance with the cue volume', async () => {
    const sound = {
      once: vi.fn(),
      play: vi.fn(() => true),
      destroy: vi.fn()
    };
    const scene = {
      cache: {
        audio: {
          exists: vi.fn(() => true)
        }
      },
      sound: {
        locked: false,
        add: vi.fn(() => sound)
      }
    } as unknown as Phaser.Scene;

    const audio = await createTestGameAudio();

    audio.playSfx(scene, 'enemy-defeat');

    expect(scene.sound.add).toHaveBeenCalledWith('sfx.enemyDefeat', {
      loop: false,
      volume: 0.85
    });
    expect(sound.once).toHaveBeenCalledWith(
      'complete',
      sound.destroy,
      sound
    );
    expect(sound.play).toHaveBeenCalledWith({
      loop: false,
      volume: 0.85
    });
    expect(sound.destroy).not.toHaveBeenCalled();
  });

  it('destroys a one-shot SFX instance if playback cannot start', async () => {
    const sound = {
      once: vi.fn(),
      play: vi.fn(() => false),
      destroy: vi.fn()
    };
    const scene = {
      cache: {
        audio: {
          exists: vi.fn(() => true)
        }
      },
      sound: {
        locked: false,
        add: vi.fn(() => sound)
      }
    } as unknown as Phaser.Scene;

    const audio = await createTestGameAudio();

    audio.playSfx(scene, 'enemy-defeat');

    expect(sound.destroy).toHaveBeenCalledTimes(1);
  });
});
