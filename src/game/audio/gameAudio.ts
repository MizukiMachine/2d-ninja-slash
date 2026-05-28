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

export interface GameAudio {
  queueAudioAssets(scene: Phaser.Scene): void;
  syncSettings(scene: Phaser.Scene, settings: SettingsState): void;
  playBgm(scene: Phaser.Scene, trackId: BgmTrackId): void;
  playSfx(scene: Phaser.Scene, cueId: SfxCueId): void;
  stopBgm(): void;
}

class PhaserGameAudio implements GameAudio {
  private activeBgm: Phaser.Sound.BaseSound | null = null;
  private activeBgmKey: string | null = null;
  private pendingBgmTrackId: BgmTrackId | null = null;
  private waitingForUnlock = false;

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

    if (this.activeBgmKey !== track.key) {
      this.stopBgm();
      this.activeBgm = scene.sound.add(track.key, {
        loop: track.loop,
        volume: track.volume
      });
      this.activeBgmKey = track.key;
    }

    if (this.activeBgm !== null && !this.activeBgm.isPlaying) {
      this.activeBgm.play({
        loop: track.loop,
        volume: track.volume
      });
    }
  }

  playSfx(scene: Phaser.Scene, cueId: SfxCueId): void {
    const cue = getSfxCue(cueId);

    if (scene.sound.locked || !scene.cache.audio.exists(cue.key)) {
      return;
    }

    scene.sound.play(cue.key, {
      loop: false,
      volume: cue.volume
    });
  }

  stopBgm(): void {
    this.activeBgm?.stop();
    this.activeBgm?.destroy();
    this.activeBgm = null;
    this.activeBgmKey = null;
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
