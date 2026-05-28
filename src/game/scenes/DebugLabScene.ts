import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys, type SceneKey } from '../sceneKeys';
import {
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
  getDebugBackgroundUrl,
  type DebugBackgroundFileName
} from '../assets/ninjaAssetCatalog';
import type { BackgroundFitMode } from '../debugFeatures';
import { GAME_UI_FONT_FAMILY } from '../gameFonts';

const BACKGROUND_DEPTH = -20;

function getBackgroundTextureKey(backgroundFileName: DebugBackgroundFileName): string {
  return `debug.lab.background.${backgroundFileName}`;
}

function getBackgroundUrl(backgroundFileName: DebugBackgroundFileName): string {
  const backgroundUrl = getDebugBackgroundUrl(backgroundFileName);

  if (backgroundUrl === undefined) {
    throw new Error(`Unknown background: ${backgroundFileName}`);
  }

  return backgroundUrl;
}

export abstract class DebugLabScene extends BaseScene {
  private backgroundImage: Phaser.GameObjects.Image | null = null;
  private activeBackgroundFileName: DebugBackgroundFileName =
    DEFAULT_DEBUG_BACKGROUND_FILE_NAME;
  private loadingBackground = false;
  private queuedBackgroundFileName: DebugBackgroundFileName | null = null;

  protected constructor(sceneKey: SceneKey) {
    super(sceneKey);
  }

  protected get activeDebugBackgroundFileName(): DebugBackgroundFileName {
    return this.activeBackgroundFileName;
  }

  protected get debugBackgroundImage(): Phaser.GameObjects.Image | null {
    return this.backgroundImage;
  }

  protected getDebugBackgroundTextureKey(
    backgroundFileName = this.activeBackgroundFileName
  ): string {
    return getBackgroundTextureKey(backgroundFileName);
  }

  protected preloadDebugBackground(): void {
    const backgroundFileName = this.debug.get().backgroundFileName;

    this.activeBackgroundFileName = backgroundFileName;
    this.queueDebugBackground(backgroundFileName);
  }

  protected createDebugBackground(fitMode: BackgroundFitMode = 'cover'): void {
    const { width, height } = this.profile;

    this.backgroundImage = this.add
      .image(width / 2, height / 2, getBackgroundTextureKey(this.activeBackgroundFileName))
      .setDepth(BACKGROUND_DEPTH);
    this.fitDebugBackground(fitMode);
  }

  protected syncDebugBackground(fitMode: BackgroundFitMode = 'cover'): void {
    const nextBackgroundFileName = this.debug.get().backgroundFileName;

    if (nextBackgroundFileName !== this.activeBackgroundFileName) {
      this.applyDebugBackground(nextBackgroundFileName, fitMode);
      return;
    }

    this.fitDebugBackground(fitMode);
  }

  protected createBackInput(): void {
    const keyboard = this.input.keyboard;
    const escape = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const backspace = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    const goBack = (): void => this.goTo(SceneKeys.MainMenu);

    escape?.on('down', goBack);
    backspace?.on('down', goBack);
    this.trackCleanup(() => {
      escape?.off('down', goBack);
      backspace?.off('down', goBack);
    });
  }

  protected createLabTitle(title: string, detail: string): Phaser.GameObjects.Text {
    this.add
      .text(24, 24, title, {
        backgroundColor: 'rgba(2, 6, 23, 0.62)',
        color: '#f8fafc',
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '20px',
        fontStyle: '700',
        padding: { x: 12, y: 8 }
      })
      .setDepth(120)
      .setScrollFactor(0);

    return this.add
      .text(24, 70, detail, {
        backgroundColor: 'rgba(2, 6, 23, 0.48)',
        color: '#cbd5e1',
        fontFamily: 'Consolas, monospace',
        fontSize: '14px',
        padding: { x: 12, y: 8 }
      })
      .setDepth(120)
      .setScrollFactor(0);
  }

  protected drawGrid(
    graphics: Phaser.GameObjects.Graphics,
    spacing: number,
    color = 0xffffff,
    alpha = 0.16
  ): void {
    const { width, height } = this.profile;

    graphics.lineStyle(1, color, alpha);

    for (let x = 0; x <= width; x += spacing) {
      graphics.lineBetween(x, 0, x, height);
    }

    for (let y = 0; y <= height; y += spacing) {
      graphics.lineBetween(0, y, width, y);
    }
  }

  private queueDebugBackground(backgroundFileName: DebugBackgroundFileName): void {
    const textureKey = getBackgroundTextureKey(backgroundFileName);

    if (!this.textures.exists(textureKey)) {
      this.load.image(textureKey, getBackgroundUrl(backgroundFileName));
    }
  }

  private fitDebugBackground(fitMode: BackgroundFitMode): void {
    if (this.backgroundImage === null) {
      return;
    }

    const { width, height } = this.profile;
    const frame = this.backgroundImage.frame;
    const coverScale = Math.max(width / frame.width, height / frame.height);
    const containScale = Math.min(width / frame.width, height / frame.height);
    const scale = fitMode === 'cover' ? coverScale : fitMode === 'contain' ? containScale : 1;

    this.backgroundImage.setPosition(width / 2, height / 2).setScale(scale);
  }

  private applyDebugBackground(
    backgroundFileName: DebugBackgroundFileName,
    fitMode: BackgroundFitMode
  ): void {
    const textureKey = getBackgroundTextureKey(backgroundFileName);

    if (this.textures.exists(textureKey)) {
      this.activateDebugBackground(backgroundFileName, fitMode);
      return;
    }

    if (this.loadingBackground) {
      this.queuedBackgroundFileName = backgroundFileName;
      return;
    }

    this.loadingBackground = true;
    this.load.image(textureKey, getBackgroundUrl(backgroundFileName));
    this.load.once('complete', () => {
      this.loadingBackground = false;

      if (this.debug.get().backgroundFileName === backgroundFileName) {
        this.activateDebugBackground(backgroundFileName, fitMode);
      }

      const queued = this.queuedBackgroundFileName;
      this.queuedBackgroundFileName = null;

      if (queued !== null && queued !== this.activeBackgroundFileName) {
        this.applyDebugBackground(queued, fitMode);
      }
    });
    this.load.start();
  }

  private activateDebugBackground(
    backgroundFileName: DebugBackgroundFileName,
    fitMode: BackgroundFitMode
  ): void {
    this.activeBackgroundFileName = backgroundFileName;
    this.backgroundImage?.setTexture(getBackgroundTextureKey(backgroundFileName));
    this.fitDebugBackground(fitMode);
  }
}
