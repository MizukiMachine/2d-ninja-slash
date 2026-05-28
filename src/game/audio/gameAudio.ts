import Phaser from 'phaser';
import type { SettingsState } from '../../stores/settingsStore';
import {
  ALL_BGM_TRACKS,
  SFX_CUES,
  getBgmTrack,
  getSfxCue,
  type BgmTrackId,
  type SfxCueId
} from '../assets/audioAssetCatalog';

type VolumeAdjustableSound = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => unknown;
  volume?: number;
};

export interface GameAudio {
  queueAudioAssets(scene: Phaser.Scene): void;
  syncSettings(scene: Phaser.Scene, settings: SettingsState): void;
  playBgm(scene: Phaser.Scene, trackId: BgmTrackId): void;
  playSfx(scene: Phaser.Scene, cueId: SfxCueId): void;
  stopBgm(): void;
}

class PhaserGameAudio implements GameAudio {
  private activeBgmSound: Phaser.Sound.BaseSound | null = null;
  private activeBgmTrackId: BgmTrackId | null = null;
  private pendingBgmTrackId: BgmTrackId | null = null;
  private waitingForUnlock = false;
  private readonly bgmKeys = new Set(ALL_BGM_TRACKS.map((track) => track.key));

  queueAudioAssets(scene: Phaser.Scene): void {
    for (const track of ALL_BGM_TRACKS) {
      if (!scene.cache.audio.exists(track.key)) {
        scene.load.audio(track.key, [track.path]);
      }
    }

    for (const cue of SFX_CUES) {
      if (!scene.cache.audio.exists(cue.key)) {
        scene.load.audio(cue.key, [cue.path]);
      }
    }
  }

  syncSettings(scene: Phaser.Scene, settings: SettingsState): void {
    scene.sound.volume = settings.volume;
    scene.sound.mute = settings.muted;
  }

  playBgm(scene: Phaser.Scene, trackId: BgmTrackId): void {
    const track = getBgmTrack(trackId);

    this.pendingBgmTrackId = trackId;

    if (!scene.cache.audio.exists(track.key)) {
      this.loadBgmOnDemand(scene, trackId);
      return;
    }

    if (scene.sound.locked) {
      this.waitForUnlock(scene);
      return;
    }

    this.pendingBgmTrackId = null;

    const bgmSound = this.getOrCreateBgmSound(scene, trackId);

    this.removeOtherBgmSounds(scene, bgmSound);
    this.activeBgmSound = bgmSound;
    this.activeBgmTrackId = trackId;
    this.setBgmVolume(bgmSound, track.volume);

    if (!bgmSound.isPlaying) {
      bgmSound.play({
        loop: track.loop,
        volume: track.volume
      });
    }
  }

  private getOrCreateBgmSound(
    scene: Phaser.Scene,
    trackId: BgmTrackId
  ): Phaser.Sound.BaseSound {
    const track = getBgmTrack(trackId);
    const sounds = scene.sound.getAll<Phaser.Sound.BaseSound>(track.key);
    const trackedBgm =
      this.activeBgmTrackId === trackId &&
      this.activeBgmSound !== null &&
      sounds.includes(this.activeBgmSound)
        ? this.activeBgmSound
        : null;
    const reusableBgm = trackedBgm ?? sounds.find((sound) => sound.isPlaying) ?? sounds[0] ?? null;

    if (reusableBgm !== null) {
      return reusableBgm;
    }

    return scene.sound.add(track.key, {
      loop: track.loop,
      volume: track.volume
    });
  }

  private removeOtherBgmSounds(
    scene: Phaser.Scene,
    bgmToKeep: Phaser.Sound.BaseSound | null
  ): void {
    // BGM is a single managed channel. Selectable and game-over tracks must not coexist.
    for (const key of this.bgmKeys) {
      for (const sound of scene.sound.getAll<Phaser.Sound.BaseSound>(key)) {
        if (sound !== bgmToKeep) {
          scene.sound.remove(sound);
        }
      }
    }
  }

  private setBgmVolume(sound: Phaser.Sound.BaseSound, volume: number): void {
    const adjustableSound = sound as VolumeAdjustableSound;

    if (typeof adjustableSound.setVolume === 'function') {
      adjustableSound.setVolume(volume);
      return;
    }

    adjustableSound.volume = volume;
  }

  playSfx(scene: Phaser.Scene, cueId: SfxCueId): void {
    const cue = getSfxCue(cueId);

    if (scene.sound.locked || !scene.cache.audio.exists(cue.key)) {
      return;
    }

    const sound = scene.sound.add(cue.key, {
      loop: false,
      volume: cue.volume
    });

    sound.once(Phaser.Sound.Events.COMPLETE, sound.destroy, sound);

    if (!sound.play()) {
      sound.destroy();
    }
  }

  stopBgm(): void {
    this.activeBgmSound?.stop();
    this.activeBgmSound?.destroy();
    this.activeBgmSound = null;
    this.activeBgmTrackId = null;
  }

  private loadBgmOnDemand(scene: Phaser.Scene, trackId: BgmTrackId): void {
    const track = getBgmTrack(trackId);

    if (!scene.load.isReady()) {
      return;
    }

    scene.load.audio(track.key, [track.path]);
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (this.pendingBgmTrackId === trackId) {
        this.playBgm(scene, trackId);
      }
    });
    scene.load.start();
  }

  private waitForUnlock(scene: Phaser.Scene): void {
    if (this.waitingForUnlock) {
      return;
    }

    this.waitingForUnlock = true;
    scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      this.waitingForUnlock = false;
      const nextTrackId = this.pendingBgmTrackId;

      if (nextTrackId !== null) {
        this.playBgm(scene, nextTrackId);
      }
    });
  }
}

export function createGameAudio(): GameAudio {
  return new PhaserGameAudio();
}
