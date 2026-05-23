import Phaser from 'phaser';
import { getAppContext, type AppContext } from '../../app/context';
import type { GameProfile } from '../profiles';
import type { SceneKey } from '../sceneKeys';
import type { ReadableStore, StoreListener, Unsubscribe } from '../../stores/store';

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
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '42px',
        fontStyle: '700',
        color: '#f7fbff'
      })
      .setOrigin(0.5);
  }

  protected addLabel(text: string, y: number): Phaser.GameObjects.Text {
    return this.add
      .text(this.centerX, y, text, {
        fontFamily: 'Arial, Helvetica, sans-serif',
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
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '22px',
        color: '#f7fbff'
      })
      .setOrigin(0.5);

    button.add([background, text]);
    button.setSize(width, height);
    button.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
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
      onClick();
    });

    return button;
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
