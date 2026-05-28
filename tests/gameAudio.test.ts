import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';

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

describe('gameAudio', () => {
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
    expect(sound.play).toHaveBeenCalledWith();
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
