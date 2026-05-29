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

export abstract class BaseScene extends Phaser.Scene {
  private cleanupCallbacks: Unsubscribe[] = [];

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

  private disposeScene(): void {
    const callbacks = this.cleanupCallbacks.splice(0);

    for (const cleanup of callbacks) {
      cleanup();
    }
  }
}
