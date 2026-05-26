import Phaser from 'phaser';
import { SceneKeys } from '../sceneKeys';
import {
  normalizeRunnerSettings,
  type RunnerGenerationSettings
} from '../debugFeatures';
import { DebugLabScene } from './DebugLabScene';

interface RunnerPlatform {
  readonly screenIndex: number;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly lane: number;
  readonly gapAfter: number;
}

const SCREEN_WIDTH = 1280;
const PLAYER_X = 250;
const PLAYER_SIZE = { width: 58, height: 78 };
const LOOKAHEAD_SCREENS = 4;

export class RunnerLabScene extends DebugLabScene {
  private worldGraphics: Phaser.GameObjects.Graphics | null = null;
  private planGraphics: Phaser.GameObjects.Graphics | null = null;
  private player: Phaser.GameObjects.Rectangle | null = null;
  private readout: Phaser.GameObjects.Text | null = null;
  private platforms: RunnerPlatform[] = [];
  private lastPlanSignature = '';
  private scrollX = 0;

  constructor() {
    super(SceneKeys.RunnerLab);
  }

  preload(): void {
    this.preloadDebugBackground();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.createDebugBackground('cover');
    this.worldGraphics = this.add.graphics().setDepth(40).setScrollFactor(0);
    this.planGraphics = this.add.graphics().setDepth(90).setScrollFactor(0);
    this.player = this.add
      .rectangle(PLAYER_X, this.getLaneY(0) - PLAYER_SIZE.height, PLAYER_SIZE.width, PLAYER_SIZE.height, 0x64b5ff, 0.9)
      .setOrigin(0.5, 0)
      .setStrokeStyle(2, 0xf8fafc, 0.9)
      .setDepth(70)
      .setScrollFactor(0);
    this.readout = this.createLabTitle('Runner Lab', 'procedural route plan');
    this.createBackInput();
  }

  update(_time: number, delta: number): void {
    const settings = normalizeRunnerSettings(this.debug.get().runnerGeneration);

    this.syncDebugBackground('cover');
    this.syncPlan(settings);

    if (!this.debug.get().paused) {
      this.scrollX += settings.scrollSpeed * (delta / 1000);
    }

    this.drawWorld(settings);
    this.drawPlan(settings);
    this.updateReadout(settings);
    this.debug.setPerformance({
      fps: this.game.loop.actualFps,
      physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
    });
  }

  private syncPlan(settings: RunnerGenerationSettings): void {
    const signature = JSON.stringify({
      seed: settings.seed,
      difficulty: settings.difficulty,
      gapDensity: settings.gapDensity,
      laneCount: settings.laneCount
    });

    if (signature === this.lastPlanSignature) {
      return;
    }

    this.lastPlanSignature = signature;
    this.platforms = this.createPlatforms(settings);
    this.scrollX = 0;
  }

  private createPlatforms(settings: RunnerGenerationSettings): RunnerPlatform[] {
    const rng = makeRng(settings.seed);
    const platforms: RunnerPlatform[] = [];
    const totalScreens = LOOKAHEAD_SCREENS + 5;
    const minWidth = Phaser.Math.Linear(360, 190, settings.difficulty);
    const maxWidth = Phaser.Math.Linear(620, 340, settings.difficulty);
    const maxGap = Phaser.Math.Linear(110, 310, Math.max(settings.gapDensity, settings.difficulty));

    for (let screenIndex = 0; screenIndex < totalScreens; screenIndex += 1) {
      let cursor = screenIndex * SCREEN_WIDTH - 80;

      while (cursor < (screenIndex + 1) * SCREEN_WIDTH + 180) {
        const width = Math.round(Phaser.Math.Linear(minWidth, maxWidth, rng()));
        const gapAfter = Math.round(Phaser.Math.Linear(40, maxGap, rng()));
        const lane = Math.floor(rng() * settings.laneCount) % settings.laneCount;

        platforms.push({
          screenIndex,
          x: cursor,
          y: this.getLaneY(lane),
          width,
          height: 32,
          lane,
          gapAfter
        });
        cursor += width + gapAfter;
      }
    }

    return platforms;
  }

  private drawWorld(settings: RunnerGenerationSettings): void {
    const graphics = this.worldGraphics;

    if (graphics === null) {
      return;
    }

    graphics.clear();
    this.drawLaneGuides(graphics, settings.laneCount);

    for (const platform of this.platforms) {
      const screenX = platform.x - this.scrollX;

      if (screenX + platform.width < -80 || screenX > this.profile.width + 80) {
        continue;
      }

      const color = platform.lane === 0 ? 0x35d08f : platform.lane === 1 ? 0x64b5ff : 0xf2c45b;
      graphics.fillStyle(color, 0.82);
      graphics.fillRect(screenX, platform.y, platform.width, platform.height);
      graphics.lineStyle(2, 0xf8fafc, 0.5);
      graphics.strokeRect(screenX, platform.y, platform.width, platform.height);

      if (settings.showHitboxes) {
        graphics.lineStyle(2, 0xffd447, 0.9);
        graphics.strokeRect(screenX, platform.y - 2, platform.width, platform.height + 4);
      }
    }

    this.player?.setY(this.getLaneY(0) - PLAYER_SIZE.height);
  }

  private drawLaneGuides(graphics: Phaser.GameObjects.Graphics, laneCount: number): void {
    for (let lane = 0; lane < laneCount; lane += 1) {
      const y = this.getLaneY(lane);
      graphics.lineStyle(2, 0xffffff, lane === 0 ? 0.28 : 0.16);
      graphics.lineBetween(0, y, this.profile.width, y);
    }
  }

  private drawPlan(settings: RunnerGenerationSettings): void {
    const graphics = this.planGraphics;

    if (graphics === null) {
      return;
    }

    graphics.clear();

    if (!settings.showPlanView) {
      return;
    }

    const mapX = 24;
    const mapY = this.profile.height - 150;
    const mapWidth = Math.min(720, this.profile.width - 48);
    const mapHeight = 110;
    const scaleX = mapWidth / (SCREEN_WIDTH * LOOKAHEAD_SCREENS);

    graphics.fillStyle(0x05080d, 0.72);
    graphics.fillRect(mapX, mapY, mapWidth, mapHeight);
    graphics.lineStyle(1, 0xcbd5e1, 0.36);
    graphics.strokeRect(mapX, mapY, mapWidth, mapHeight);

    for (const platform of this.platforms) {
      const relativeX = platform.x - this.scrollX;
      const x = mapX + relativeX * scaleX;
      const width = Math.max(2, platform.width * scaleX);

      if (x + width < mapX || x > mapX + mapWidth) {
        continue;
      }

      const laneY = mapY + 18 + platform.lane * (mapHeight - 36) / Math.max(1, settings.laneCount - 1);
      graphics.fillStyle(0x64b5ff, 0.7);
      graphics.fillRect(x, laneY, width, 8);
    }

    graphics.lineStyle(2, 0xffd447, 0.95);
    graphics.lineBetween(mapX + PLAYER_X * scaleX, mapY, mapX + PLAYER_X * scaleX, mapY + mapHeight);
  }

  private updateReadout(settings: RunnerGenerationSettings): void {
    const currentScreen = Math.max(0, Math.floor(this.scrollX / SCREEN_WIDTH));
    const nextPlatforms = this.platforms.filter((platform) => platform.screenIndex === currentScreen + 1);
    const maxGap = nextPlatforms.reduce((max, platform) => Math.max(max, platform.gapAfter), 0);

    this.readout?.setText(
      `screen ${currentScreen} -> ${currentScreen + 1} | ${nextPlatforms.length} platforms | max gap ${Math.round(
        maxGap
      )} | seed ${settings.seed}`
    );
  }

  private getLaneY(lane: number): number {
    const bottom = Math.round(this.profile.height * 0.78);
    const spacing = Math.round(this.profile.height * 0.1);

    return bottom - lane * spacing;
  }
}

function makeRng(seed: number): () => number {
  let value = seed >>> 0;

  return () => {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 0x100000000;
  };
}

