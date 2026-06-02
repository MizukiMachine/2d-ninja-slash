import Phaser from 'phaser';
import { getAppContext, type AppContext } from '../../app/context';
import type { SfxTriggerId } from '../audio/sfxBindings';
import type { GameProfile } from '../profiles';
import type { SceneKey } from '../sceneKeys';
import type { ReadableStore, StoreListener, Unsubscribe } from '../../stores/store';
import { GAME_DISPLAY_FONT_FAMILY, GAME_UI_FONT_FAMILY } from '../gameFonts';

interface TextButtonConfig {
  readonly x: number;
  readonly y: number;
  readonly label: string;
  readonly onClick: () => void;
  readonly width?: number;
  readonly height?: number;
}

const LOADING_TEXT = '読み込み中…';
const LOAD_ERROR_TEXT = '読み込みに失敗しました\n画面をタップして再読み込み';

export abstract class BaseScene extends Phaser.Scene {
  private cleanupCallbacks: Unsubscribe[] = [];
  /** Centered loading / error overlay shown while assets stream in. */
  private loadingOverlay: Phaser.GameObjects.Text | null = null;
  /** Set when any file errors during the current load batch. */
  private loadHadError = false;

  protected constructor(sceneKey: SceneKey) {
    super(sceneKey);
  }

  init(): void {
    this.debug.setActiveScene(this.scene.key);
    this.cleanupCallbacks = [];
    this.events.once('shutdown', this.disposeScene, this);
    this.events.once('destroy', this.disposeScene, this);
    this.onStore(this.settings, (settings) => {
      this.app.audio.syncSettings(this, settings);
    });
    this.armAudioUnlockGesture();

    if (this.scene.key !== 'Boot') {
      let syncedBgmTrackId: string | null = null;

      this.onStore(this.debug, (state) => {
        if (!this.shouldSyncDebugBgm() || syncedBgmTrackId === state.bgmTrackId) {
          return;
        }

        syncedBgmTrackId = state.bgmTrackId;
        this.app.audio.playBgm(this, state.bgmTrackId);
      });
    }
  }

  protected get app(): AppContext {
    return getAppContext();
  }

  protected get profile(): GameProfile {
    return this.app.getProfile();
  }

  protected get debug() {
    return this.app.debugStore;
  }

  protected get settings() {
    return this.app.settingsStore;
  }

  protected get centerX(): number {
    return this.profile.width / 2;
  }

  protected get centerY(): number {
    return this.profile.height / 2;
  }

  protected isTouchPrimaryInput(): boolean {
    return (
      window.matchMedia('(pointer: coarse)').matches ||
      navigator.maxTouchPoints > 0
    );
  }

  protected addTitle(text: string, y: number): Phaser.GameObjects.Text {
    return this.add
      .text(this.centerX, y, text, {
        fontFamily: GAME_DISPLAY_FONT_FAMILY,
        fontSize: '42px',
        fontStyle: '700',
        color: '#f7fbff'
      })
      .setOrigin(0.5);
  }

  protected addLabel(text: string, y: number): Phaser.GameObjects.Text {
    return this.add
      .text(this.centerX, y, text, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '20px',
        color: '#9fb3c9'
      })
      .setOrigin(0.5);
  }

  protected createTextButton({
    x,
    y,
    label,
    onClick,
    width = 260,
    height = 58
  }: TextButtonConfig): Phaser.GameObjects.Container {
    const button = this.add.container(x, y);
    const background = this.add
      .rectangle(0, 0, width, height, 0x182235, 1)
      .setStrokeStyle(2, 0x3c8edb, 0.9);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '22px',
        color: '#f7fbff'
      })
      .setOrigin(0.5);

    button.add([background, text]);
    button.setSize(width, height);
    button.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, width, height),
      Phaser.Geom.Rectangle.Contains
    );

    button.on('pointerover', () => {
      background.setFillStyle(0x223150, 1);
    });
    button.on('pointerout', () => {
      background.setFillStyle(0x182235, 1);
    });
    button.on('pointerdown', () => {
      background.setFillStyle(0x2d5f91, 1);
    });
    button.on('pointerup', () => {
      background.setFillStyle(0x223150, 1);
      this.playSfx('ui-select');
      onClick();
    });

    return button;
  }

  protected preloadAudioAssets(): void {
    this.app.audio.queueAudioAssets(this);
  }

  protected playSfx(triggerId: SfxTriggerId): void {
    // Resolve the trigger through the (normalized) debug bindings so the
    // SFX Assign panel can re-route events and tweak per-cue volume. The config
    // is normalized on load, so both lookups always yield valid values.
    const { bindings, volumes } = this.app.debugStore.get().sfxBindings;
    const cueId = bindings[triggerId];
    const event = {
      sceneKey: this.scene.key,
      triggerId,
      cueId,
      configuredVolume: volumes[cueId],
      masterVolume: this.settings.get().volume,
      muted: this.settings.get().muted,
      at: Date.now()
    };

    console.info(
      `[ninja-slash:sfx-trigger] scene=${event.sceneKey} trigger=${triggerId} cue=${cueId} configured=${event.configuredVolume} master=${event.masterVolume} muted=${event.muted} at=${event.at}`,
      event
    );
    this.app.audio.playSfx(this, cueId, volumes[cueId]);
  }

  protected shouldSyncDebugBgm(): boolean {
    return true;
  }

  protected goTo(sceneKey: SceneKey): void {
    this.scene.start(sceneKey);
  }

  protected trackCleanup(cleanup: Unsubscribe): void {
    this.cleanupCallbacks.push(cleanup);
  }

  protected onStore<T>(store: ReadableStore<T>, listener: StoreListener<T>, immediate = true): void {
    this.trackCleanup(store.subscribe(listener, { immediate }));
  }

  private armAudioUnlockGesture(): void {
    const requestUnlock = (): void => {
      this.app.audio.requestUnlock(this);
    };
    const keyboard = this.input.keyboard;

    this.input.once(Phaser.Input.Events.POINTER_DOWN, requestUnlock);
    keyboard?.once(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, requestUnlock);
    this.trackCleanup(() => {
      this.input.off(Phaser.Input.Events.POINTER_DOWN, requestUnlock);
      keyboard?.off(Phaser.Input.Keyboard.Events.ANY_KEY_DOWN, requestUnlock);
    });
  }

  /**
   * Show a centered "loading" overlay and keep its percentage synced with the
   * scene loader, so a slow first load (or a cold CDN on a fresh deploy) shows
   * visible feedback instead of a blank/black screen. Also tracks per-file load
   * errors so {@link didLoadFail} can report whether assets actually arrived.
   *
   * Call from a scene's preload() (the loader auto-runs afterward) or right
   * before a manual load.start(). Listeners self-clean on the loader's COMPLETE.
   */
  protected showLoadingOverlay(): void {
    this.loadHadError = false;

    if (!this.loadingOverlay) {
      this.loadingOverlay = this.add
        .text(this.centerX, this.centerY, LOADING_TEXT, {
          fontFamily: GAME_UI_FONT_FAMILY,
          fontSize: '24px',
          color: '#f5e6c8',
          align: 'center'
        })
        .setOrigin(0.5)
        .setDepth(10_000);
    }

    const onProgress = (value: number): void => {
      const percent = Math.round(Phaser.Math.Clamp(value, 0, 1) * 100);
      this.loadingOverlay?.setText(`${LOADING_TEXT} ${percent}%`);
    };
    const onError = (): void => {
      this.loadHadError = true;
    };

    this.load.on(Phaser.Loader.Events.PROGRESS, onProgress);
    this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    this.load.once(Phaser.Loader.Events.COMPLETE, () => {
      this.load.off(Phaser.Loader.Events.PROGRESS, onProgress);
      this.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    });
  }

  /** Remove the loading overlay (no-op if none is showing). */
  protected hideLoadingOverlay(): void {
    this.loadingOverlay?.destroy();
    this.loadingOverlay = null;
  }

  /** True when at least one file errored during the last load batch. */
  protected didLoadFail(): boolean {
    return this.loadHadError;
  }

  /**
   * Replace the loading overlay with a tappable retry message. Used when assets
   * fail to arrive (network blip / misconfigured host) so the player sees a clear
   * prompt instead of a silent black screen. Tapping reloads the page, which
   * re-fetches against a now-warm cache.
   */
  protected showLoadErrorOverlay(message: string = LOAD_ERROR_TEXT): void {
    this.hideLoadingOverlay();
    this.loadingOverlay = this.add
      .text(this.centerX, this.centerY, message, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '22px',
        color: '#c9b48a',
        align: 'center',
        lineSpacing: 8
      })
      .setOrigin(0.5)
      .setDepth(10_000);

    this.input.once(Phaser.Input.Events.POINTER_DOWN, () => {
      window.location.reload();
    });
  }

  private disposeScene(): void {
    const callbacks = this.cleanupCallbacks.splice(0);

    for (const cleanup of callbacks) {
      cleanup();
    }
  }
}
