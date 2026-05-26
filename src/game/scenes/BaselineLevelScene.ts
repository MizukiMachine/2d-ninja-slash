import Phaser from 'phaser';
import { SceneKeys } from '../sceneKeys';
import {
  getEditableDebugLevel,
  normalizeBaselineLabSettings,
  type DebugLevelElement
} from '../debugFeatures';
import { DebugLabScene } from './DebugLabScene';

const CAMERA_SPEED = 520;

export class BaselineLevelScene extends DebugLabScene {
  private worldGraphics: Phaser.GameObjects.Graphics | null = null;
  private readout: Phaser.GameObjects.Text | null = null;
  private cursorKeys: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private scrollX = 0;

  constructor() {
    super(SceneKeys.BaselineLevel);
  }

  preload(): void {
    this.preloadDebugBackground();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.createDebugBackground('cover');
    this.worldGraphics = this.add.graphics().setDepth(50).setScrollFactor(0);
    this.readout = this.createLabTitle('Baseline Level', 'level route baseline');
    this.cursorKeys = this.input.keyboard?.createCursorKeys() ?? null;
    this.createBackInput();
  }

  update(_time: number, delta: number): void {
    const seconds = delta / 1000;
    const settings = normalizeBaselineLabSettings(this.debug.get().baselineLab);
    const level = getEditableDebugLevel(settings.selectedLevelId, this.app.getDebugElementsConfig());

    this.syncDebugBackground('cover');

    if (!this.debug.get().paused) {
      const direction = Number(this.cursorKeys?.right.isDown) - Number(this.cursorKeys?.left.isDown);
      this.scrollX = Phaser.Math.Clamp(
        this.scrollX + direction * CAMERA_SPEED * seconds,
        0,
        Math.max(0, level.width - this.profile.width)
      );
    }

    this.drawLevel(settings.showHitboxes, settings.showSpawnGoal, settings.showCameraBands);
    this.readout?.setText(
      `${level.label} | width ${level.width} | surface ${level.surfaceY} | scroll ${Math.round(
        this.scrollX
      )}`
    );
    this.debug.setPerformance({
      fps: this.game.loop.actualFps,
      physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
    });
  }

  private drawLevel(
    showHitboxes: boolean,
    showSpawnGoal: boolean,
    showCameraBands: boolean
  ): void {
    const graphics = this.worldGraphics;

    if (graphics === null) {
      return;
    }

    const settings = normalizeBaselineLabSettings(this.debug.get().baselineLab);
    const level = getEditableDebugLevel(settings.selectedLevelId, this.app.getDebugElementsConfig());
    graphics.clear();

    if (showCameraBands) {
      for (let x = -this.scrollX % this.profile.width; x < this.profile.width; x += this.profile.width) {
        graphics.fillStyle(0x64b5ff, 0.08);
        graphics.fillRect(x, 0, this.profile.width, this.profile.height);
        graphics.lineStyle(2, 0x64b5ff, 0.28);
        graphics.lineBetween(x, 0, x, this.profile.height);
      }
    }

    graphics.lineStyle(3, 0xf2c45b, 0.9);
    graphics.lineBetween(-this.scrollX, level.surfaceY, level.width - this.scrollX, level.surfaceY);

    for (const element of level.elements) {
      this.drawElement(graphics, element, showHitboxes, showSpawnGoal);
    }
  }

  private drawElement(
    graphics: Phaser.GameObjects.Graphics,
    element: DebugLevelElement,
    showHitboxes: boolean,
    showSpawnGoal: boolean
  ): void {
    const x = element.x - this.scrollX;
    const y = element.y;

    if (x + element.width < -80 || x > this.profile.width + 80) {
      return;
    }

    const color = getElementColor(element.kind);
    const alpha = element.kind === 'hazard' ? 0.62 : 0.74;

    if ((element.kind === 'spawn' || element.kind === 'goal') && !showSpawnGoal) {
      return;
    }

    graphics.fillStyle(color, alpha);
    graphics.fillRect(x, y, element.width, element.height);
    graphics.lineStyle(2, 0xf8fafc, 0.42);
    graphics.strokeRect(x, y, element.width, element.height);

    if (showHitboxes) {
      graphics.lineStyle(2, element.kind === 'hazard' ? 0xe56b6f : 0x35d08f, 0.96);
      graphics.strokeRect(x, y, element.width, element.height);
    }
  }
}

function getElementColor(kind: DebugLevelElement['kind']): number {
  switch (kind) {
    case 'platform':
      return 0x35d08f;
    case 'hazard':
      return 0xe56b6f;
    case 'pickup':
      return 0xf2c45b;
    case 'spawn':
      return 0x64b5ff;
    case 'goal':
      return 0x9f7aea;
    case 'enemy':
      return 0xff91d0;
  }
}
