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
import { SFX_VOLUME_LIMITS } from './sfxBindings';

type VolumeAdjustableSound = Phaser.Sound.BaseSound & {
  setVolume?: (value: number) => unknown;
  volume?: number;
};

type ResumableAudioContext = {
  readonly state?: string;
  resume?: () => Promise<void>;
};

type ActiveAudioContext = ResumableAudioContext & {
  resume: () => Promise<void>;
};

type UnlockableSoundManager = Omit<Phaser.Sound.BaseSoundManager, 'locked'> & {
  locked: boolean;
  unlock?: () => void;
  unlocked?: boolean;
  context?: ResumableAudioContext | null;
};

interface PendingSfxRequest {
  readonly scene: Phaser.Scene;
  readonly cueId: SfxCueId;
  readonly volumeOverride?: number;
}

interface SfxPlaybackEvent {
  readonly type: 'sfx';
  readonly cueId: SfxCueId;
  readonly audioKey: string;
  readonly sceneKey: string;
  readonly requestedVolume: number;
  readonly volume: number;
  readonly capped: boolean;
  readonly at: number;
}

interface BgmPlaybackEvent {
  readonly type: 'bgm';
  readonly action: 'request' | 'play' | 'stop' | 'skip-disabled' | 'wait-unlock';
  readonly trackId?: BgmTrackId;
  readonly audioKey?: string;
  readonly sceneKey?: string;
  readonly volume?: number;
  readonly at: number;
}

type AudioDebugEvent = SfxPlaybackEvent | BgmPlaybackEvent;

type AudioDebugWindow = Window & {
  __ninjaSlashAudioEvents?: AudioDebugEvent[];
};

export const MAX_SFX_PLAYBACK_VOLUME = SFX_VOLUME_LIMITS.max;
const AUDIO_DEBUG_EVENT_LIMIT = 40;

function formatDebugDetails(details: object): string {
  try {
    return JSON.stringify(details);
  } catch {
    return '[unserializable]';
  }
}

function canResumeAudioContext(
  context: ResumableAudioContext | null | undefined
): context is ActiveAudioContext {
  return context !== null && context !== undefined && typeof context.resume === 'function';
}

export interface GameAudio {
  queueAudioAssets(scene: Phaser.Scene): void;
  syncSettings(scene: Phaser.Scene, settings: SettingsState): void;
  requestUnlock(scene: Phaser.Scene): void;
  playBgm(scene: Phaser.Scene, trackId: BgmTrackId): void;
  playSfx(scene: Phaser.Scene, cueId: SfxCueId, volumeOverride?: number): void;
  stopBgm(): void;
}

class PhaserGameAudio implements GameAudio {
  private activeBgmSound: Phaser.Sound.BaseSound | null = null;
  private activeBgmTrackId: BgmTrackId | null = null;
  private pendingBgmTrackId: BgmTrackId | null = null;
  // The track that should be playing when BGM is enabled. Retained across an
  // off→on toggle so the same track resumes without the scene re-requesting it.
  private desiredBgmTrackId: BgmTrackId | null = null;
  private bgmEnabled = true;
  private waitingForUnlock = false;
  private unlockRequested = false;
  private unlockScene: Phaser.Scene | null = null;
  private pendingSfxRequest: PendingSfxRequest | null = null;
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
    this.setBgmEnabled(scene, settings.bgmEnabled);
  }

  requestUnlock(scene: Phaser.Scene): void {
    if (!scene.sound.locked) {
      this.flushPendingAudio(scene);
      return;
    }

    const soundManager = scene.sound as UnlockableSoundManager;
    const context = soundManager.context;

    if (canResumeAudioContext(context)) {
      this.requestWebAudioUnlock(scene, soundManager, context);
      return;
    }

    this.waitForUnlock(scene);

    if (!this.unlockRequested) {
      this.unlockRequested = true;
      soundManager.unlock?.();
    }
  }

  private requestWebAudioUnlock(
    scene: Phaser.Scene,
    soundManager: UnlockableSoundManager,
    context: ActiveAudioContext
  ): void {
    if (context.state === 'running') {
      this.completeUnlock(scene, soundManager);
      return;
    }

    if (
      context.state !== undefined &&
      context.state !== 'suspended' &&
      context.state !== 'interrupted'
    ) {
      return;
    }

    this.unlockRequested = true;

    let resumePromise: Promise<void>;

    try {
      resumePromise = context.resume();
    } catch {
      this.unlockRequested = false;
      return;
    }

    // Start pending WebAudio sources during the same user gesture. The context
    // may still be resolving its resume promise, but scheduled sources will
    // become audible once the context is running.
    const flushedBgmTrackId = this.pendingBgmTrackId;
    const flushedSfxRequest = this.pendingSfxRequest;

    this.completeUnlock(scene, soundManager);

    void resumePromise.then(
      () => {
        this.completeUnlock(scene, soundManager);
      },
      () => {
        this.restoreFailedWebAudioUnlock(
          scene,
          soundManager,
          context,
          flushedBgmTrackId,
          flushedSfxRequest
        );
      }
    );
  }

  private setBgmEnabled(scene: Phaser.Scene, enabled: boolean): void {
    if (this.bgmEnabled === enabled) {
      return;
    }

    this.bgmEnabled = enabled;

    if (!enabled) {
      // Silence BGM but remember the desired track so it can resume on re-enable.
      this.pendingBgmTrackId = null;
      this.stopBgm();
      return;
    }

    if (this.desiredBgmTrackId !== null) {
      this.playBgm(scene, this.desiredBgmTrackId);
    }
  }

  playBgm(scene: Phaser.Scene, trackId: BgmTrackId): void {
    const track = getBgmTrack(trackId);

    this.recordBgmEvent(scene, 'request', trackId, track.key, track.volume);
    this.desiredBgmTrackId = trackId;

    if (!this.bgmEnabled) {
      this.recordBgmEvent(scene, 'skip-disabled', trackId, track.key, track.volume);
      return;
    }

    this.pendingBgmTrackId = trackId;

    if (!scene.cache.audio.exists(track.key)) {
      this.loadBgmOnDemand(scene, trackId);
      return;
    }

    if (scene.sound.locked) {
      this.recordBgmEvent(scene, 'wait-unlock', trackId, track.key, track.volume);
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
      this.recordBgmEvent(scene, 'play', trackId, track.key, track.volume);
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

  playSfx(scene: Phaser.Scene, cueId: SfxCueId, volumeOverride?: number): void {
    const cue = getSfxCue(cueId);

    const activeState = this.getDocumentActiveState();

    if (!activeState.active) {
      this.recordSfxSkipped(scene, cueId, cue.key, {
        reason: 'inactive-document',
        hidden: activeState.hidden,
        focused: activeState.focused
      });
      return;
    }

    const cached = scene.cache.audio.exists(cue.key);

    if (scene.sound.locked) {
      if (cached) {
        this.pendingSfxRequest = { scene, cueId, volumeOverride };
      }

      this.recordSfxSkipped(scene, cueId, cue.key, {
        reason: cached ? 'audio-locked-pending' : 'audio-unavailable',
        locked: true,
        cached
      });
      this.requestUnlock(scene);
      return;
    }

    if (!cached) {
      this.recordSfxSkipped(scene, cueId, cue.key, {
        reason: 'audio-unavailable',
        locked: false,
        cached
      });
      return;
    }

    // Defensive: only honour a finite override, otherwise fall back to the
    // catalog volume so a corrupt stored value can never mute or blow out a cue.
    const requestedVolume = Number.isFinite(volumeOverride)
      ? (volumeOverride as number)
      : cue.volume;
    const volume = this.getSafeSfxVolume(requestedVolume);
    const config = {
      loop: false,
      volume
    };

    this.recordSfxPlayback(scene, cueId, cue.key, requestedVolume, volume);

    const sound = scene.sound.add(cue.key, config);

    sound.once(Phaser.Sound.Events.COMPLETE, sound.destroy, sound);

    if (!sound.play(config)) {
      sound.destroy();
    }
  }

  private getSafeSfxVolume(volume: number): number {
    return Math.min(MAX_SFX_PLAYBACK_VOLUME, Math.max(0, volume));
  }

  private getDocumentActiveState(): {
    readonly active: boolean;
    readonly hidden: boolean;
    readonly focused: boolean;
  } {
    if (typeof document === 'undefined') {
      return { active: true, hidden: false, focused: true };
    }

    const hidden = document.hidden;
    const focused =
      typeof document.hasFocus === 'function' ? document.hasFocus() : true;

    return {
      active: !hidden,
      hidden,
      focused
    };
  }

  private recordSfxPlayback(
    scene: Phaser.Scene,
    cueId: SfxCueId,
    audioKey: string,
    requestedVolume: number,
    volume: number
  ): void {
    if (typeof window === 'undefined') {
      return;
    }

    const event: SfxPlaybackEvent = {
      type: 'sfx',
      cueId,
      audioKey,
      sceneKey: scene.scene.key,
      requestedVolume,
      volume,
      capped: volume !== requestedVolume,
      at: Date.now()
    };
    const targetWindow = window as AudioDebugWindow;

    targetWindow.__ninjaSlashAudioEvents = [
      ...(targetWindow.__ninjaSlashAudioEvents ?? []),
      event
    ].slice(-AUDIO_DEBUG_EVENT_LIMIT);
    targetWindow.dispatchEvent(
      new CustomEvent('ninja-slash:sfx', { detail: event })
    );
    console.info(
      `[ninja-slash:sfx] cue=${event.cueId} key=${event.audioKey} scene=${event.sceneKey} requested=${event.requestedVolume} volume=${event.volume} capped=${event.capped} at=${event.at}`,
      event
    );
  }

  private recordSfxSkipped(
    scene: Phaser.Scene,
    cueId: SfxCueId,
    audioKey: string,
    reason: object
  ): void {
    if (typeof window === 'undefined') {
      return;
    }

    const event = {
      cueId,
      audioKey,
      sceneKey: scene.scene.key,
      reason,
      at: Date.now()
    };

    console.info(
      `[ninja-slash:sfx-skip] cue=${cueId} key=${audioKey} scene=${scene.scene.key} reason=${formatDebugDetails(reason)} at=${event.at}`,
      event
    );
  }

  private recordBgmEvent(
    scene: Phaser.Scene | null,
    action: BgmPlaybackEvent['action'],
    trackId?: BgmTrackId,
    audioKey?: string,
    volume?: number
  ): void {
    if (typeof window === 'undefined') {
      return;
    }

    const event: BgmPlaybackEvent = {
      type: 'bgm',
      action,
      trackId,
      audioKey,
      sceneKey: scene?.scene.key,
      volume,
      at: Date.now()
    };
    const targetWindow = window as AudioDebugWindow;

    targetWindow.__ninjaSlashAudioEvents = [
      ...(targetWindow.__ninjaSlashAudioEvents ?? []),
      event
    ].slice(-AUDIO_DEBUG_EVENT_LIMIT);
    console.info(
      `[ninja-slash:bgm] action=${event.action} track=${event.trackId ?? ''} key=${event.audioKey ?? ''} scene=${event.sceneKey ?? ''} volume=${event.volume ?? ''} at=${event.at}`,
      event
    );
  }

  stopBgm(): void {
    this.recordBgmEvent(null, 'stop', this.activeBgmTrackId ?? undefined);
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
    this.unlockScene = scene;

    if (this.waitingForUnlock) {
      return;
    }

    this.waitingForUnlock = true;
    scene.sound.once(Phaser.Sound.Events.UNLOCKED, () => {
      this.waitingForUnlock = false;
      this.unlockRequested = false;

      const unlockedScene = this.unlockScene ?? scene;
      this.unlockScene = null;
      this.flushPendingAudio(unlockedScene);
    });
  }

  private completeUnlock(scene: Phaser.Scene, soundManager: UnlockableSoundManager): void {
    const wasLocked = soundManager.locked;

    this.waitingForUnlock = false;
    this.unlockRequested = false;
    this.unlockScene = null;
    soundManager.locked = false;

    if (wasLocked) {
      soundManager.unlocked = true;
    }

    this.flushPendingAudio(scene);
  }

  private restoreFailedWebAudioUnlock(
    scene: Phaser.Scene,
    soundManager: UnlockableSoundManager,
    context: ActiveAudioContext,
    flushedBgmTrackId: BgmTrackId | null,
    flushedSfxRequest: PendingSfxRequest | null
  ): void {
    this.unlockRequested = false;

    if (context.state === 'running') {
      return;
    }

    soundManager.locked = true;
    soundManager.unlocked = false;

    const bgmTrackIdToRetry = flushedBgmTrackId ?? this.activeBgmTrackId;

    if (bgmTrackIdToRetry !== null) {
      this.removeActiveBgmSound(scene);
      this.pendingBgmTrackId = bgmTrackIdToRetry;
    }

    if (flushedSfxRequest !== null) {
      this.removeSfxSoundInstances(flushedSfxRequest.scene, flushedSfxRequest.cueId);
      this.pendingSfxRequest = flushedSfxRequest;
    }
  }

  private removeActiveBgmSound(scene: Phaser.Scene): void {
    if (this.activeBgmSound === null) {
      return;
    }

    this.activeBgmSound.stop();
    scene.sound.remove(this.activeBgmSound);
    this.activeBgmSound = null;
    this.activeBgmTrackId = null;
  }

  private removeSfxSoundInstances(scene: Phaser.Scene, cueId: SfxCueId): void {
    const cue = getSfxCue(cueId);

    for (const sound of scene.sound.getAll<Phaser.Sound.BaseSound>(cue.key)) {
      scene.sound.remove(sound);
    }
  }

  private flushPendingAudio(scene: Phaser.Scene): void {
    const pendingSfxRequest = this.pendingSfxRequest;
    this.pendingSfxRequest = null;

    if (pendingSfxRequest !== null) {
      this.playSfx(
        pendingSfxRequest.scene,
        pendingSfxRequest.cueId,
        pendingSfxRequest.volumeOverride
      );
    }

    const nextTrackId = this.pendingBgmTrackId;

    if (nextTrackId !== null) {
      this.playBgm(scene, nextTrackId);
    }
  }
}

export function createGameAudio(): GameAudio {
  return new PhaserGameAudio();
}
