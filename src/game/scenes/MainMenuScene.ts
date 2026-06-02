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
const START_GATE_DEPTH = 100;
const START_GATE_FADE_MS = 220;
const START_GATE_SCRIM_ALPHA = 0.94;

let hasAcceptedStartGate = false;

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
  private startGateOverlay: Phaser.GameObjects.Container | null = null;

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
    this.createMultiplayerButton();
    this.createBgmToggleButton();
    this.createControlsGuide();
    this.createStartKeyboardInput();
    this.createStartGateOverlay();
  }

  protected override shouldSyncDebugBgm(): boolean {
    return hasAcceptedStartGate;
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
    const touch = this.isTouchPrimaryInput();
    const buttonWidth = Math.min(width * (touch ? 0.5 : 0.46), touch ? 360 : 320);
    const buttonHeight = touch ? 84 : height > width ? 68 : 62;
    const buttonY = height > width ? height * 0.61 : touch ? height * 0.61 : height * 0.64;
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

  private createMultiplayerButton(): void {
    const { width, height } = this.profile;
    const touch = this.isTouchPrimaryInput();
    const buttonWidth = Math.min(width * (touch ? 0.46 : 0.42), touch ? 328 : 286);
    const buttonHeight = touch ? 78 : height > width ? 62 : 56;
    const startButtonY = height > width ? height * 0.61 : touch ? height * 0.61 : height * 0.64;
    const buttonY = startButtonY + (touch ? 92 : height > width ? 82 : 70);
    const startMultiplayer = (): void => this.startMultiplayer();

    const button = this.add
      .rectangle(this.centerX, buttonY, buttonWidth, buttonHeight, 0x1a2230, 0.88)
      .setStrokeStyle(2, 0x35d08f, 0.82)
      .setDepth(TITLE_CONTENT_DEPTH)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(this.centerX, buttonY, '2P Duel', {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '24px',
        color: '#fff7df'
      })
      .setOrigin(0.5)
      .setDepth(TITLE_CONTENT_DEPTH + 1);

    button.on('pointerover', () => {
      button.setFillStyle(0x243044, 0.96);
      label.setColor('#ffffff');
    });
    button.on('pointerout', () => {
      button.setFillStyle(0x1a2230, 0.88);
      label.setColor('#fff7df');
    });
    button.on('pointerdown', () => {
      button.setFillStyle(0x1f3a31, 0.98);
    });
    button.on('pointerup', startMultiplayer);
  }

  private createBgmToggleButton(): void {
    const { width, height } = this.profile;
    const touch = this.isTouchPrimaryInput();
    const buttonWidth = Math.min(width * (touch ? 0.38 : 0.32), touch ? 270 : 220);
    const buttonHeight = touch ? 66 : height > width ? 50 : 46;
    const startButtonY = height > width ? height * 0.61 : touch ? height * 0.61 : height * 0.64;
    const buttonY = startButtonY + (touch ? 174 : height > width ? 160 : 132);

    const button = this.add
      .rectangle(this.centerX, buttonY, buttonWidth, buttonHeight, 0x10151d, 0.78)
      .setStrokeStyle(2, 0x7d6a45, 0.8)
      .setDepth(TITLE_CONTENT_DEPTH)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(this.centerX, buttonY, '', {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '20px',
        color: '#d6b76f'
      })
      .setOrigin(0.5)
      .setDepth(TITLE_CONTENT_DEPTH + 1);

    let hovered = false;
    const refreshColor = (bgmEnabled: boolean): void => {
      label.setColor(hovered ? '#fff7df' : bgmEnabled ? '#d6b76f' : '#8a8f99');
    };

    button.on('pointerover', () => {
      hovered = true;
      button.setFillStyle(0x1c242f, 0.9);
      refreshColor(this.settings.get().bgmEnabled);
    });
    button.on('pointerout', () => {
      hovered = false;
      button.setFillStyle(0x10151d, 0.78);
      refreshColor(this.settings.get().bgmEnabled);
    });
    button.on('pointerup', () => {
      this.playSfx('ui-select');
      this.settings.toggleBgm();
    });

    this.onStore(this.settings, (settings) => {
      // ラベルは現在のBGM状態を表示する。
      label.setText(settings.bgmEnabled ? 'BGM: ON' : 'BGM: OFF');
      refreshColor(settings.bgmEnabled);
    });
  }

  private createStartGateOverlay(): void {
    if (hasAcceptedStartGate) {
      return;
    }

    const { width, height } = this.profile;
    const startLabel = this.isTouchPrimaryInput() ? 'TAP TO START' : 'CLICK TO START';
    const gateY = height > width ? height * 0.55 : height * 0.54;
    const labelSize = height > width ? 34 : 38;
    const overlay = this.add.container(0, 0).setDepth(START_GATE_DEPTH);
    const scrim = this.add
      .rectangle(this.centerX, this.centerY, width, height, 0x02050a, START_GATE_SCRIM_ALPHA)
      .setInteractive({ useHandCursor: true });
    const label = this.add
      .text(this.centerX, gateY, startLabel, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: `${labelSize}px`,
        color: '#fff7df',
        stroke: '#080909',
        strokeThickness: 5
      })
      .setOrigin(0.5);
    const line = this.add.graphics();
    const lineWidth = Math.min(width * 0.44, 360);
    line.lineStyle(2, 0xd6b76f, 0.78);
    line.lineBetween(
      this.centerX - lineWidth / 2,
      gateY + 48,
      this.centerX + lineWidth / 2,
      gateY + 48
    );

    const stopPointerPropagation = (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData
    ): void => {
      event.stopPropagation();
    };
    const acceptGate = (
      _pointer: Phaser.Input.Pointer,
      _localX: number,
      _localY: number,
      event: Phaser.Types.Input.EventData
    ): void => {
      event.stopPropagation();
      this.acceptStartGate();
    };

    overlay.add([scrim, label, line]);
    this.startGateOverlay = overlay;
    scrim.on('pointerdown', stopPointerPropagation);
    scrim.on('pointerup', acceptGate);
    this.tweens.add({
      targets: label,
      alpha: { from: 0.68, to: 1 },
      duration: 920,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });
    this.trackCleanup(() => {
      scrim.off('pointerdown', stopPointerPropagation);
      scrim.off('pointerup', acceptGate);
      this.tweens.killTweensOf(label);

      if (overlay.active) {
        overlay.destroy(true);
      }
    });
  }

  private acceptStartGate(): void {
    if (hasAcceptedStartGate) {
      return;
    }

    hasAcceptedStartGate = true;
    this.app.audio.playBgm(this, this.debug.get().bgmTrackId);
    this.app.audio.requestUnlock(this);

    const overlay = this.startGateOverlay;
    this.startGateOverlay = null;

    if (overlay === null) {
      return;
    }

    this.tweens.add({
      targets: overlay,
      alpha: 0,
      duration: START_GATE_FADE_MS,
      ease: 'Sine.easeOut',
      onComplete: () => {
        overlay.destroy(true);
      }
    });
  }

  private createControlsGuide(): void {
    if (this.isTouchPrimaryInput()) {
      return;
    }

    const { width, height } = this.profile;
    const controls: ReadonlyArray<{ keys: readonly string[]; label: string }> = [
      { keys: ['←', '→'], label: '左右移動' },
      { keys: ['↑', '↓'], label: '上下レーン移動' },
      { keys: ['A'], label: '斬撃' },
      { keys: ['Space'], label: '跳躍' }
    ];

    const items = controls.map((control) =>
      this.buildControlItem(control.keys, control.label)
    );

    // Pack items into centered rows, wrapping when a row would exceed the
    // usable width — keeps the guide tidy in both portrait and landscape.
    const itemSpacing = 26;
    const maxRowWidth = width * 0.92;
    const rows: Array<Array<{ container: Phaser.GameObjects.Container; width: number }>> = [];
    let currentRow: Array<{ container: Phaser.GameObjects.Container; width: number }> = [];
    let currentRowWidth = 0;

    items.forEach((item) => {
      const added = (currentRow.length > 0 ? itemSpacing : 0) + item.width;

      if (currentRow.length > 0 && currentRowWidth + added > maxRowWidth) {
        rows.push(currentRow);
        currentRow = [];
        currentRowWidth = 0;
      }

      currentRow.push(item);
      currentRowWidth += (currentRow.length > 1 ? itemSpacing : 0) + item.width;
    });

    if (currentRow.length > 0) {
      rows.push(currentRow);
    }

    const rowGap = 46;
    const lastRowY = height * 0.955;
    const firstRowY = lastRowY - (rows.length - 1) * rowGap;

    rows.forEach((rowItems, rowIndex) => {
      const rowY = firstRowY + rowIndex * rowGap;
      const totalWidth =
        rowItems.reduce((sum, item) => sum + item.width, 0) +
        itemSpacing * (rowItems.length - 1);
      let cursor = this.centerX - totalWidth / 2;

      rowItems.forEach((item) => {
        item.container.setPosition(cursor + item.width / 2, rowY);
        item.container.setDepth(TITLE_CONTENT_DEPTH);
        cursor += item.width + itemSpacing;
      });
    });
  }

  private buildControlItem(
    keys: readonly string[],
    label: string
  ): { container: Phaser.GameObjects.Container; width: number } {
    const keyGap = 6;
    const labelGap = 12;
    const caps = keys.map((key) => this.buildKeyCap(key));
    const labelText = this.add
      .text(0, 0, label, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '18px',
        color: '#e7d6a8'
      })
      .setOrigin(0, 0.5);

    const keysWidth =
      caps.reduce((sum, cap) => sum + cap.width, 0) + keyGap * (caps.length - 1);
    const totalWidth = keysWidth + labelGap + labelText.width;
    const left = -totalWidth / 2;

    let cursor = left;
    caps.forEach((cap, index) => {
      cap.container.setX(cursor + cap.width / 2);
      cursor += cap.width + (index < caps.length - 1 ? keyGap : 0);
    });
    labelText.setX(left + keysWidth + labelGap);

    const container = this.add.container(0, 0, [
      ...caps.map((cap) => cap.container),
      labelText
    ]);

    return { container, width: totalWidth };
  }

  private buildKeyCap(glyph: string): {
    container: Phaser.GameObjects.Container;
    width: number;
  } {
    const capHeight = 34;
    const paddingX = 13;
    const radius = 7;
    const text = this.add
      .text(0, 0, glyph, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '17px',
        color: '#fff7df'
      })
      .setOrigin(0.5);
    const capWidth = Math.max(capHeight, text.width + paddingX * 2);

    const cap = this.add.graphics();
    cap.fillStyle(0x10151d, 0.86);
    cap.fillRoundedRect(-capWidth / 2, -capHeight / 2, capWidth, capHeight, radius);
    cap.lineStyle(1.5, 0xd6b76f, 0.68);
    cap.strokeRoundedRect(-capWidth / 2, -capHeight / 2, capWidth, capHeight, radius);

    const container = this.add.container(0, 0, [cap, text]);

    return { container, width: capWidth };
  }

  private createStartKeyboardInput(): void {
    const keyboard = this.input.keyboard;
    const enter = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ENTER);
    const space = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    const openMenuOrStartGame = (): void => {
      if (!hasAcceptedStartGate) {
        this.acceptStartGate();
        return;
      }

      this.startGame();
    };

    enter?.on('down', openMenuOrStartGame);
    space?.on('down', openMenuOrStartGame);
    this.trackCleanup(() => {
      enter?.off('down', openMenuOrStartGame);
      space?.off('down', openMenuOrStartGame);
    });
  }

  private startGame(): void {
    if (!hasAcceptedStartGate) {
      this.acceptStartGate();
      return;
    }

    this.playSfx('ui-select');
    this.goTo(SceneKeys.Sandbox);
  }

  private startMultiplayer(): void {
    if (!hasAcceptedStartGate) {
      this.acceptStartGate();
      return;
    }

    this.playSfx('ui-select');
    this.goTo(SceneKeys.Multiplayer);
  }
}
