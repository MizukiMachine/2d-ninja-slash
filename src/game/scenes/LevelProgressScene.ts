import Phaser from 'phaser';
import { SceneKeys } from '../sceneKeys';
import {
  DEBUG_LEVELS,
  getEditableDebugLevel,
  normalizeBaselineLabSettings,
  normalizeDebugElementsConfig,
  normalizeLevelProgress
} from '../debugFeatures';
import { DebugLabScene } from './DebugLabScene';

export class LevelProgressScene extends DebugLabScene {
  private cards: Phaser.GameObjects.Container[] = [];
  private readout: Phaser.GameObjects.Text | null = null;
  private lastSignature = '';

  constructor() {
    super(SceneKeys.LevelProgress);
  }

  preload(): void {
    this.preloadDebugBackground();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.createDebugBackground('cover');
    this.readout = this.createLabTitle('Level Progress', 'unlock and completion state');
    this.createBackInput();
    this.renderCards();
  }

  update(): void {
    this.syncDebugBackground('cover');
    const progress = normalizeLevelProgress(this.debug.get().levelProgress);
    const elementCounts = normalizeDebugElementsConfig(this.app.getDebugElementsConfig()).levels.map(
      (level) => [level.levelId, level.elements.length]
    );
    const signature = JSON.stringify({ progress, elementCounts });

    if (signature !== this.lastSignature) {
      this.lastSignature = signature;
      this.renderCards();
    }

    this.readout?.setText(
      `${progress.unlockedLevelIds.length}/${DEBUG_LEVELS.length} unlocked | ${progress.completedLevelIds.length}/${DEBUG_LEVELS.length} completed`
    );
    this.debug.setPerformance({
      fps: this.game.loop.actualFps,
      physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
    });
  }

  private renderCards(): void {
    const progress = normalizeLevelProgress(this.debug.get().levelProgress);
    const cardWidth = Math.min(330, Math.round(this.profile.width * 0.28));
    const cardHeight = 138;
    const gap = 20;
    const columns = this.profile.width >= 900 ? 3 : 1;
    const totalWidth = columns * cardWidth + (columns - 1) * gap;
    const startX = this.profile.width / 2 - totalWidth / 2 + cardWidth / 2;
    const startY = 170;

    this.cards.forEach((card) => card.destroy());
    this.cards = DEBUG_LEVELS.map((levelSummary, index) => {
      const level = getEditableDebugLevel(levelSummary.id, this.app.getDebugElementsConfig());
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = startX + column * (cardWidth + gap);
      const y = startY + row * (cardHeight + gap);
      const unlocked = progress.unlockedLevelIds.includes(level.id);
      const completed = progress.completedLevelIds.includes(level.id);
      const tone = completed ? 0x35d08f : unlocked ? 0x64b5ff : 0x26364d;
      const card = this.add.container(x, y).setDepth(60).setScrollFactor(0);
      const background = this.add
        .rectangle(0, 0, cardWidth, cardHeight, 0x101722, 0.88)
        .setStrokeStyle(2, tone, unlocked ? 0.95 : 0.48);
      const title = this.add
        .text(-cardWidth / 2 + 18, -cardHeight / 2 + 16, level.label, {
          color: '#f8fafc',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '20px',
          fontStyle: '700'
        })
        .setOrigin(0, 0);
      const status = completed ? 'complete' : unlocked ? 'unlocked' : 'locked';
      const detail = this.add
        .text(-cardWidth / 2 + 18, -cardHeight / 2 + 54, `${status} | ${level.width}px | ${level.elements.length} elements`, {
          color: unlocked ? '#cbd5e1' : '#8395aa',
          fontFamily: 'Consolas, monospace',
          fontSize: '14px'
        })
        .setOrigin(0, 0);
      const footer = this.add
        .text(-cardWidth / 2 + 18, cardHeight / 2 - 34, unlocked ? 'Open baseline' : 'Unlock in debug panel', {
          color: unlocked ? '#64b5ff' : '#8395aa',
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '13px',
          fontStyle: '700'
        })
        .setOrigin(0, 0);

      card.add([background, title, detail, footer]);
      card.setSize(cardWidth, cardHeight);

      if (unlocked) {
        card.setInteractive(
          new Phaser.Geom.Rectangle(0, 0, cardWidth, cardHeight),
          Phaser.Geom.Rectangle.Contains
        );
        card.on('pointerup', () => {
          this.debug.setBaselineLab({
            ...normalizeBaselineLabSettings(this.debug.get().baselineLab),
            selectedLevelId: level.id
          });
          this.goTo(SceneKeys.BaselineLevel);
        });
      }

      return card;
    });
  }
}
