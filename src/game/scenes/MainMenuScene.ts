import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import {
  getDebugBackgroundUrl,
  isDebugBackgroundFileName,
  type DebugBackgroundFileName
} from '../assets/ninjaAssetCatalog';
import { GAME_DISPLAY_FONT_FAMILY, GAME_UI_FONT_FAMILY } from '../gameFonts';
import { GAME_SUBTITLE, GAME_TITLE } from '../gameTitle';

const TITLE_BACKGROUND_FILE_NAME = 'title-screen.png';
const TITLE_BACKGROUND_FALLBACK_FILE_NAME = 'stage-candidate-moonlit-temple-yard-rough.png';
const BACKGROUND_DEPTH = -30;
const OVERLAY_DEPTH = -20;
const TITLE_CONTENT_DEPTH = 10;

function getTitleBackgroundFileName(): DebugBackgroundFileName {
  return isDebugBackgroundFileName(TITLE_BACKGROUND_FILE_NAME)
    ? TITLE_BACKGROUND_FILE_NAME
    : TITLE_BACKGROUND_FALLBACK_FILE_NAME;
}

function getTitleBackgroundTextureKey(): string {
  return `title.background.${getTitleBackgroundFileName()}`;
}

function getTitleBackgroundUrl(): string {
  const backgroundUrl = getDebugBackgroundUrl(getTitleBackgroundFileName());

  if (backgroundUrl === undefined) {
    throw new Error(`Unknown title background: ${getTitleBackgroundFileName()}`);
  }

  return backgroundUrl;
}

export class MainMenuScene extends BaseScene {
  constructor() {
    super(SceneKeys.MainMenu);
  }

  preload(): void {
    const textureKey = getTitleBackgroundTextureKey();

    if (!this.textures.exists(textureKey)) {
      this.load.image(textureKey, getTitleBackgroundUrl());
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#060910');
    this.createBackground();
    this.createTitleLockup();
    this.createStartButton();
    this.createSettingsButton();
    this.createStartKeyboardInput();
  }

  private createBackground(): void {
    const { width, height } = this.profile;
    const background = this.add
      .image(this.centerX, this.centerY, getTitleBackgroundTextureKey())
      .setDepth(BACKGROUND_DEPTH);
    const frame = background.frame;
    const scale = Math.max(width / frame.width, height / frame.height);

    background.setScale(scale);
    this.add
      .rectangle(this.centerX, this.centerY, width, height, 0x02050a, 0.48)
      .setDepth(OVERLAY_DEPTH);
    this.add
      .rectangle(this.centerX, this.centerY, width, height, 0x0a0f18, 0.18)
      .setDepth(OVERLAY_DEPTH + 1);

    const shade = this.add.graphics().setDepth(OVERLAY_DEPTH + 2);
    shade.fillStyle(0x02050a, 0.34);
    shade.fillRect(0, 0, width, height * 0.22);
    shade.fillRect(0, height * 0.74, width, height * 0.26);
  }

  private createTitleLockup(): void {
    const { width, height } = this.profile;
    const titleY = height > width ? height * 0.34 : height * 0.32;
    const titleSize = height > width ? 64 : 84;
    const subtitleY = titleY + (height > width ? 74 : 88);

    this.add
      .text(this.centerX, titleY, GAME_TITLE, {
        fontFamily: GAME_DISPLAY_FONT_FAMILY,
        fontSize: `${titleSize}px`,
        color: '#fff7df',
        stroke: '#120b07',
        strokeThickness: 8,
        shadow: { offsetX: 0, offsetY: 5, color: '#010308', blur: 10, fill: true }
      })
      .setOrigin(0.5)
      .setDepth(TITLE_CONTENT_DEPTH);

    this.add
      .text(this.centerX, subtitleY, GAME_SUBTITLE, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: height > width ? '26px' : '30px',
        color: '#d6b76f',
        stroke: '#080909',
        strokeThickness: 4
      })
      .setOrigin(0.5)
      .setDepth(TITLE_CONTENT_DEPTH);

    const ruleWidth = Math.min(width * 0.34, 340);
    const ruleY = subtitleY + (height > width ? 42 : 46);
    const rule = this.add.graphics().setDepth(TITLE_CONTENT_DEPTH);
    rule.lineStyle(2, 0xd6b76f, 0.72);
    rule.lineBetween(
      this.centerX - ruleWidth / 2,
      ruleY,
      this.centerX + ruleWidth / 2,
      ruleY
    );
    rule.fillStyle(0xd6b76f, 0.82);
    rule.fillCircle(this.centerX, ruleY, 4);
  }

  private createStartButton(): void {
    const { width, height } = this.profile;
    const buttonWidth = Math.min(width * 0.46, 320);
    const buttonHeight = height > width ? 68 : 62;
    const buttonY = height > width ? height * 0.61 : height * 0.64;
    const startGame = (): void => this.startGame();

    const button = this.add
      .rectangle(this.centerX, buttonY, buttonWidth, buttonHeight, 0x161d26, 0.86)
      .setStrokeStyle(2, 0xd6b76f, 0.9)
      .setDepth(TITLE_CONTENT_DEPTH)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(this.centerX, buttonY, 'Start', {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '26px',
        color: '#fff7df'
      })
      .setOrigin(0.5)
      .setDepth(TITLE_CONTENT_DEPTH + 1);

    button.on('pointerover', () => {
      button.setFillStyle(0x242f3c, 0.94);
      label.setColor('#ffffff');
    });
    button.on('pointerout', () => {
      button.setFillStyle(0x161d26, 0.86);
      label.setColor('#fff7df');
    });
    button.on('pointerdown', () => {
      button.setFillStyle(0x3a2b18, 0.96);
    });
    button.on('pointerup', startGame);
  }

  private createSettingsButton(): void {
    const { width, height } = this.profile;
    const buttonWidth = Math.min(width * 0.32, 220);
    const buttonHeight = height > width ? 50 : 46;
    const startButtonY = height > width ? height * 0.61 : height * 0.64;
    const buttonY = startButtonY + (height > width ? 88 : 82);

    const button = this.add
      .rectangle(this.centerX, buttonY, buttonWidth, buttonHeight, 0x10151d, 0.78)
      .setStrokeStyle(2, 0x7d6a45, 0.8)
      .setDepth(TITLE_CONTENT_DEPTH)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(this.centerX, buttonY, 'Settings', {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '20px',
        color: '#d6b76f'
      })
      .setOrigin(0.5)
      .setDepth(TITLE_CONTENT_DEPTH + 1);

    button.on('pointerover', () => {
      button.setFillStyle(0x1c242f, 0.9);
      label.setColor('#fff7df');
    });
    button.on('pointerout', () => {
      button.setFillStyle(0x10151d, 0.78);
      label.setColor('#d6b76f');
    });
    button.on('pointerup', () => {
      this.playSfx('ui-select');
      this.goTo(SceneKeys.Settings);
    });
  }

  private createStartKeyboardInput(): void {
    const keyboard = this.input.keyboard;
    const enter = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const space = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const startGame = (): void => this.startGame();

    enter?.on('down', startGame);
    space?.on('down', startGame);
    this.trackCleanup(() => {
      enter?.off('down', startGame);
      space?.off('down', startGame);
    });
  }

  private startGame(): void {
    this.playSfx('ui-select');
    this.goTo(SceneKeys.Sandbox);
  }
}
