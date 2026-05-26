import Phaser from 'phaser';
import { SceneKeys } from '../sceneKeys';
import { normalizeBackgroundLabSettings } from '../debugFeatures';
import { DebugLabScene } from './DebugLabScene';

export class BackgroundLabScene extends DebugLabScene {
  private overlay: Phaser.GameObjects.Graphics | null = null;
  private readout: Phaser.GameObjects.Text | null = null;
  private scrollOffset = 0;

  constructor() {
    super(SceneKeys.BackgroundLab);
  }

  preload(): void {
    this.preloadDebugBackground();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    const settings = normalizeBackgroundLabSettings(this.debug.get().backgroundLab);

    this.createDebugBackground(settings.fitMode);
    this.overlay = this.add.graphics().setDepth(80).setScrollFactor(0);
    this.readout = this.createLabTitle('Background Lab', 'background inspection');
    this.createBackInput();
  }

  update(_time: number, delta: number): void {
    const settings = normalizeBackgroundLabSettings(this.debug.get().backgroundLab);

    this.syncDebugBackground(settings.fitMode);
    this.scrollOffset += settings.scrollSpeed * (delta / 1000);
    this.applyBackgroundOffset(settings.scrollSpeed);
    this.drawOverlay(settings.showGrid, settings.showSafeFrame, settings.showBaseline);
    this.updateReadout(settings.fitMode);
    this.debug.setPerformance({
      fps: this.game.loop.actualFps,
      physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
    });
  }

  private applyBackgroundOffset(scrollSpeed: number): void {
    const background = this.debugBackgroundImage;

    if (background === null) {
      return;
    }

    const offset = scrollSpeed === 0 ? 0 : Phaser.Math.Wrap(this.scrollOffset, -64, 64);
    background.setX(this.profile.width / 2 + offset);
  }

  private drawOverlay(showGrid: boolean, showSafeFrame: boolean, showBaseline: boolean): void {
    const overlay = this.overlay;

    if (overlay === null) {
      return;
    }

    overlay.clear();

    if (showGrid) {
      this.drawGrid(overlay, 64, 0xffffff, 0.14);
      this.drawGrid(overlay, 256, 0x64b5ff, 0.28);
    }

    if (showSafeFrame) {
      const marginX = Math.round(this.profile.width * 0.08);
      const marginY = Math.round(this.profile.height * 0.08);
      overlay.lineStyle(2, 0x35d08f, 0.82);
      overlay.strokeRect(
        marginX,
        marginY,
        this.profile.width - marginX * 2,
        this.profile.height - marginY * 2
      );
    }

    if (showBaseline) {
      const y = Math.round(this.profile.height * 0.78);
      overlay.lineStyle(3, 0xf2c45b, 0.86);
      overlay.lineBetween(0, y, this.profile.width, y);
      overlay.fillStyle(0xf2c45b, 0.18);
      overlay.fillRect(0, y, this.profile.width, 2);
    }
  }

  private updateReadout(fitMode: string): void {
    const texture = this.textures.get(this.getDebugBackgroundTextureKey());
    const source = texture?.getSourceImage() as HTMLImageElement | HTMLCanvasElement | undefined;
    const width = source?.width ?? 0;
    const height = source?.height ?? 0;

    this.readout?.setText(
      `${this.activeDebugBackgroundFileName} | ${width}x${height} | ${fitMode}`
    );
  }
}

