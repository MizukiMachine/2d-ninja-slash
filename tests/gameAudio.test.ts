import type Phaser from 'phaser';
import { afterEach, describe, expect, it, vi } from 'vitest';
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

interface AudioSceneOptions {
  readonly locked?: boolean;
  readonly cacheExists?: boolean;
  readonly context?: {
    readonly state?: string;
    readonly resume?: () => Promise<void>;
  };
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
          COMPLETE: 'complete',
          UNLOCKED: 'unlocked'
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

function createAudioScene(
  initialSounds: MockSound[] = [],
  options: AudioSceneOptions = {}
) {
  const sounds = [...initialSounds];
  const unlockCallbacks: Array<() => void> = [];
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
  const soundManager = {
    locked: options.locked ?? false,
    unlocked: false,
    add,
    getAll,
    remove,
    once: vi.fn((event: string, callback: () => void) => {
      if (event === 'unlocked') {
        unlockCallbacks.push(callback);
      }

      return soundManager;
    }),
    unlock: vi.fn(),
    context: options.context ?? null
  };
  const scene = {
    scene: { key: 'TestScene' },
    cache: {
      audio: {
        exists: vi.fn(() => options.cacheExists ?? true)
      }
    },
    sound: soundManager
  } as unknown as Phaser.Scene;

  return {
    add,
    getAll,
    remove,
    once: soundManager.once,
    scene,
    soundManager,
    sounds,
    unlock: soundManager.unlock,
    unlockSound: () => {
      soundManager.locked = false;
      const callbacks = unlockCallbacks.splice(0);

      callbacks.forEach((callback) => {
        callback();
      });
    }
  };
}

describe('gameAudio', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it('plays a pending BGM request after the sound manager unlocks', async () => {
    const { add, once, scene, sounds, unlock, unlockSound } = createAudioScene([], {
      locked: true
    });
    const audio = await createTestGameAudio();

    audio.playBgm(scene, 'boss-duel');

    expect(add).not.toHaveBeenCalled();
    expect(once).toHaveBeenCalledWith('unlocked', expect.any(Function));

    audio.requestUnlock(scene);

    expect(unlock).toHaveBeenCalledTimes(1);

    unlockSound();

    const bgmSound = sounds[0]!;

    expect(add).toHaveBeenCalledWith('bgm.bossDuel', {
      loop: true,
      volume: COMBAT_BGM_VOLUME
    });
    expect(bgmSound.play).toHaveBeenCalledWith({
      loop: true,
      volume: COMBAT_BGM_VOLUME
    });
  });

  it('primes pending BGM immediately while WebAudio resumes from a gesture', async () => {
    const resume = vi.fn(() => Promise.resolve());
    const { add, scene, soundManager, sounds, unlock } = createAudioScene([], {
      locked: true,
      context: { state: 'suspended', resume }
    });
    const audio = await createTestGameAudio();

    audio.playBgm(scene, 'boss-duel');

    expect(add).not.toHaveBeenCalled();

    audio.requestUnlock(scene);

    const bgmSound = sounds[0]!;

    expect(unlock).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(scene.sound.locked).toBe(false);
    expect(soundManager.unlocked).toBe(true);
    expect(add).toHaveBeenCalledWith('bgm.bossDuel', {
      loop: true,
      volume: COMBAT_BGM_VOLUME
    });
    expect(bgmSound.play).toHaveBeenCalledWith({
      loop: true,
      volume: COMBAT_BGM_VOLUME
    });
  });

  it('does not re-arm Phaser unlock after the resume promise resolves', async () => {
    let resolveResume!: () => void;
    const resume = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          resolveResume = resolve;
        })
    );
    const { scene, soundManager } = createAudioScene([], {
      locked: true,
      context: { state: 'suspended', resume }
    });
    const audio = await createTestGameAudio();

    audio.requestUnlock(scene);

    expect(scene.sound.locked).toBe(false);
    expect(soundManager.unlocked).toBe(true);

    // Phaser's BaseSoundManager consumes this flag during its next update.
    soundManager.unlocked = false;

    resolveResume();
    await Promise.resolve();

    expect(scene.sound.locked).toBe(false);
    expect(soundManager.unlocked).toBe(false);
  });

  it('requeues active BGM if WebAudio resume rejects after gesture playback', async () => {
    let contextState = 'suspended';
    const resume = vi.fn(() => Promise.reject(new Error('gesture rejected')));
    const context = {
      get state() {
        return contextState;
      },
      resume
    };
    const { add, scene, soundManager, sounds, unlock } = createAudioScene([], {
      locked: true,
      context
    });
    const audio = await createTestGameAudio();

    audio.requestUnlock(scene);
    audio.playBgm(scene, 'boss-duel');

    expect(add).toHaveBeenCalledTimes(1);
    expect(sounds).toHaveLength(1);

    await Promise.resolve();
    await Promise.resolve();

    expect(unlock).not.toHaveBeenCalled();
    expect(resume).toHaveBeenCalledTimes(1);
    expect(scene.sound.locked).toBe(true);
    expect(soundManager.unlocked).toBe(false);
    expect(sounds).toHaveLength(0);

    contextState = 'running';
    audio.requestUnlock(scene);

    const bgmSound = sounds[0]!;

    expect(scene.sound.locked).toBe(false);
    expect(add).toHaveBeenCalledTimes(2);
    expect(bgmSound.play).toHaveBeenCalledWith({
      loop: true,
      volume: COMBAT_BGM_VOLUME
    });
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
      volume: 0.211
    });
    expect(sound.once).toHaveBeenCalledWith(
      'complete',
      sound.destroy,
      sound
    );
    expect(sound.play).toHaveBeenCalledWith({
      loop: false,
      volume: 0.211
    });
    expect(sound.destroy).not.toHaveBeenCalled();
  });

  it('retries the first cached SFX after the sound manager unlocks', async () => {
    const sound = {
      once: vi.fn(),
      play: vi.fn(() => true),
      destroy: vi.fn()
    };
    const unlockCallbacks: Array<() => void> = [];
    const soundManager = {
      locked: true,
      add: vi.fn(() => sound),
      once: vi.fn((event: string, callback: () => void) => {
        if (event === 'unlocked') {
          unlockCallbacks.push(callback);
        }

        return soundManager;
      }),
      unlock: vi.fn()
    };
    const scene = {
      scene: { key: 'MainMenu' },
      cache: { audio: { exists: vi.fn(() => true) } },
      sound: soundManager
    } as unknown as Phaser.Scene;
    const audio = await createTestGameAudio();

    audio.playSfx(scene, 'ui-select', 0.2);

    expect(soundManager.add).not.toHaveBeenCalled();
    expect(soundManager.unlock).toHaveBeenCalledTimes(1);

    soundManager.locked = false;
    unlockCallbacks.splice(0).forEach((callback) => {
      callback();
    });

    expect(soundManager.add).toHaveBeenCalledWith('sfx.uiSelect', {
      loop: false,
      volume: 0.2
    });
    expect(sound.play).toHaveBeenCalledWith({
      loop: false,
      volume: 0.2
    });
  });

  it('caps a one-shot SFX with a loud finite volume override', async () => {
    const sound = {
      once: vi.fn(),
      play: vi.fn(() => true),
      destroy: vi.fn()
    };
    const scene = {
      cache: { audio: { exists: vi.fn(() => true) } },
      sound: { locked: false, add: vi.fn(() => sound) }
    } as unknown as Phaser.Scene;

    const audio = await createTestGameAudio();

    audio.playSfx(scene, 'enemy-defeat', 1.4);

    expect(scene.sound.add).toHaveBeenCalledWith('sfx.enemyDefeat', {
      loop: false,
      volume: 0.75
    });
  });

  it('skips SFX playback while the document is inactive', async () => {
    vi.stubGlobal('document', {
      hidden: true,
      hasFocus: vi.fn(() => false)
    });
    vi.stubGlobal('window', {});

    const sound = {
      once: vi.fn(),
      play: vi.fn(() => true),
      destroy: vi.fn()
    };
    const scene = {
      scene: { key: 'Multiplayer' },
      cache: { audio: { exists: vi.fn(() => true) } },
      sound: { locked: false, add: vi.fn(() => sound) }
    } as unknown as Phaser.Scene;

    const audio = await createTestGameAudio();

    audio.playSfx(scene, 'player-hurt', 0.16);

    expect(scene.sound.add).not.toHaveBeenCalled();
    expect(sound.play).not.toHaveBeenCalled();
  });

  it('allows SFX while visible even if mobile focus reporting is false', async () => {
    vi.stubGlobal('document', {
      hidden: false,
      hasFocus: vi.fn(() => false)
    });
    vi.stubGlobal('window', {
      dispatchEvent: vi.fn()
    });
    vi.stubGlobal('CustomEvent', class {
      constructor(
        public readonly type: string,
        public readonly init?: unknown
      ) {}
    });

    const sound = {
      once: vi.fn(),
      play: vi.fn(() => true),
      destroy: vi.fn()
    };
    const scene = {
      scene: { key: 'MainMenu' },
      cache: { audio: { exists: vi.fn(() => true) } },
      sound: { locked: false, add: vi.fn(() => sound) }
    } as unknown as Phaser.Scene;

    const audio = await createTestGameAudio();

    audio.playSfx(scene, 'ui-select', 0.2);

    expect(scene.sound.add).toHaveBeenCalledWith('sfx.uiSelect', {
      loop: false,
      volume: 0.2
    });
    expect(sound.play).toHaveBeenCalledWith({
      loop: false,
      volume: 0.2
    });
  });

  it('ignores a non-finite volume override and uses the catalog volume', async () => {
    const sound = {
      once: vi.fn(),
      play: vi.fn(() => true),
      destroy: vi.fn()
    };
    const scene = {
      cache: { audio: { exists: vi.fn(() => true) } },
      sound: { locked: false, add: vi.fn(() => sound) }
    } as unknown as Phaser.Scene;

    const audio = await createTestGameAudio();

    audio.playSfx(scene, 'enemy-defeat', Number.NaN);

    expect(scene.sound.add).toHaveBeenCalledWith('sfx.enemyDefeat', {
      loop: false,
      volume: 0.211
    });
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
