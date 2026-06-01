import { Callbacks } from '@colyseus/sdk';
import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import { SceneJuice } from '../effects/sceneJuice';
import {
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
  getDebugBackgroundUrl,
  type DebugBackgroundFileName
} from '../assets/ninjaAssetCatalog';
import { getBackgroundCoverScale } from '../backgroundFit';
import { normalizeSandboxLaneSettings } from '../debugFeatures';
import { GAME_DISPLAY_FONT_FAMILY, GAME_UI_FONT_FAMILY } from '../gameFonts';
import {
  createThreeLaneLayoutFromYSettings,
  type ThreeLaneLayout
} from '../playerLaneMovement';
import {
  getInterpolatedNinjaLanePresentationFrame,
  getNinjaLanePerspectiveScaleForY,
  getNinjaSpritePositionForLane,
  type NinjaLanePresentationFrame
} from '../ninjaLanePresentation';
import {
  getNinjaAnimationKey,
  getNinjaTextureKey,
  NINJA_ANIMATION_ASSETS,
  preloadNinjaAnimationAssets,
  registerNinjaAnimations,
  type FacingDirection,
  type NinjaActorId
} from '../ninjaBounds';
import { joinDuelRoom } from '../../net/multiplayerSession';
import {
  MULTIPLAYER_MAX_HEALTH,
  type HitMessage,
  type MultiplayerAction,
  type MultiplayerPlayerState,
  type MultiplayerRoom,
  type SwingMessage
} from '../../net/multiplayerTypes';
import {
  PLAYER_INVULNERABILITY_BLINK_MS,
  PLAYER_INVULNERABILITY_MS
} from '../playerDamageFeedback';

type Unsubscribe = () => void;

interface MultiplayerKeys {
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly w: Phaser.Input.Keyboard.Key;
  readonly s: Phaser.Input.Keyboard.Key;
  readonly a: Phaser.Input.Keyboard.Key;
  readonly space: Phaser.Input.Keyboard.Key;
  readonly r: Phaser.Input.Keyboard.Key;
  readonly esc: Phaser.Input.Keyboard.Key;
}

interface MultiplayerCallbacks {
  onAdd(
    property: 'players',
    handler: (player: MultiplayerPlayerState, sessionId: string) => void,
    immediate?: boolean
  ): Unsubscribe;
  onRemove(
    property: 'players',
    handler: (player: MultiplayerPlayerState, sessionId: string) => void
  ): Unsubscribe;
  onChange(player: MultiplayerPlayerState, handler: () => void): Unsubscribe;
  listen(
    property: 'phase' | 'winnerId' | 'countdownMs' | 'status',
    handler: (value: string | number, previousValue?: string | number) => void,
    immediate?: boolean
  ): Unsubscribe;
}

interface PlayerVisual {
  readonly actorId: NinjaActorId;
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly nameLabel: Phaser.GameObjects.Text;
  renderedLaneX: number;
  renderedLaneY: number;
  targetX: number;
  targetY: number;
  state: MultiplayerPlayerState;
  lastAnimationKey: string;
  lastAttackSeq: number;
  lastJumpSeq: number;
  lastHurtSeq: number;
  damageBlinkUntil: number;
  damageBlinkTween: Phaser.Tweens.Tween | null;
  readonly unsubscribers: Unsubscribe[];
}

type TouchControlId = 'attack' | 'jump' | 'menu';
type JoystickLaneDirection = 'up' | 'down';
type HudMessageLayout = 'top' | 'countdown';

interface TouchControlButtonConfig {
  readonly id: TouchControlId;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly label: string;
  readonly fontSize?: number;
  readonly onPress: () => void;
}

interface TouchControlBackground {
  readonly graphic: Phaser.GameObjects.Graphics;
  readonly width: number;
  readonly height: number;
}

const BACKGROUND_DEPTH = -30;
const ACTOR_DEPTH_BASE = 20;
const ACTOR_DEPTH_RANGE = 30;
const PLAYER_DEPTH_BIAS = 0.6;
const ENEMY_DEPTH_BIAS = 0;
const HUD_DEPTH = 140;
const TOUCH_CONTROL_DEPTH = HUD_DEPTH + 40;
const TOUCH_CONTROL_ACTION_BOTTOM_INSET = 74;
const TOUCH_CONTROL_EDGE_ACTION_LIFT = 44;
const TOUCH_CONTROL_ACTION_SIZE = 76;
const TOUCH_CONTROL_MENU_Y = 142;
const TOUCH_CONTROL_RADIUS = 18;
const TOUCH_CONTROL_FILL_ALPHA = 0.16;
const TOUCH_CONTROL_STROKE_ALPHA = 0.36;
const TOUCH_CONTROL_PRESSED_FILL_ALPHA = 0.32;
const TOUCH_CONTROL_PRESSED_STROKE_ALPHA = 0.72;
const VIRTUAL_JOYSTICK_ZONE_RATIO = 0.5;
const VIRTUAL_JOYSTICK_RADIUS = 56;
const VIRTUAL_JOYSTICK_KNOB_RADIUS = 22;
const VIRTUAL_JOYSTICK_DEAD_ZONE = 14;
const VIRTUAL_JOYSTICK_LANE_THRESHOLD = 34;
const VIRTUAL_JOYSTICK_LANE_RESET = 18;
const NINJA_SPRITE_SCALE = 2.1;
const INPUT_SEND_INTERVAL_MS = 50;
const HEALTH_BAR_WIDTH = 292;
const HEALTH_BAR_HEIGHT = 24;
const HUD_STATUS_TOP_Y = 34;
const HUD_DETAIL_TOP_Y = 72;
const HUD_STATUS_TOP_FONT_SIZE = 30;
const HUD_DETAIL_TOP_FONT_SIZE = 18;
const HUD_COUNTDOWN_STATUS_FONT_SIZE = 96;
const HUD_COUNTDOWN_DETAIL_FONT_SIZE = 24;
const HUD_COUNTDOWN_DETAIL_OFFSET_Y = 86;
const HUD_DETAIL_WRAP_INSET = 96;
const WAITING_STATUS_TEXT = 'マッチング待ち';
const WAITING_DETAIL_TEXT = '別のユーザーが同じルームに入ると\n対戦が開始します';

function getBackgroundTextureKey(backgroundFileName: DebugBackgroundFileName): string {
  return `multiplayer.background.${backgroundFileName}`;
}

function getBackgroundUrl(backgroundFileName: DebugBackgroundFileName): string {
  const backgroundUrl = getDebugBackgroundUrl(backgroundFileName);

  if (backgroundUrl === undefined) {
    throw new Error(`Unknown multiplayer background: ${backgroundFileName}`);
  }

  return backgroundUrl;
}

function getActorIdForSlot(slot: number): NinjaActorId {
  return slot === 0 ? 'mainNinja' : 'mainNinja2p';
}

function getRenderableAction(
  actorId: NinjaActorId,
  action: MultiplayerAction
): string {
  if (action === 'dead') {
    return 'death';
  }

  if (action === 'hurt') {
    return actorId === 'enemyNinja' ? 'crouching' : 'impact';
  }

  return action;
}

function isControllableAction(action: MultiplayerAction): boolean {
  return action === 'idle' || action === 'run';
}

export class MultiplayerScene extends BaseScene {
  private room: MultiplayerRoom | null = null;
  private moveKeys: MultiplayerKeys | null = null;
  private readonly visualsBySessionId = new Map<string, PlayerVisual>();
  private readonly roomUnsubscribers: Unsubscribe[] = [];
  private backgroundFileName: DebugBackgroundFileName = DEFAULT_DEBUG_BACKGROUND_FILE_NAME;
  private laneLayout: ThreeLaneLayout | null = null;
  private hudGraphic: Phaser.GameObjects.Graphics | null = null;
  private statusText: Phaser.GameObjects.Text | null = null;
  private detailText: Phaser.GameObjects.Text | null = null;
  private roomText: Phaser.GameObjects.Text | null = null;
  private slotLabels: Phaser.GameObjects.Text[] = [];
  private lastInputSignature = '';
  private lastInputSentAt = Number.NEGATIVE_INFINITY;
  private hasConnectionError = false;
  private juice: SceneJuice | null = null;
  private touchControlsContainer: Phaser.GameObjects.Container | null = null;
  private readonly touchControlPointers = new Map<TouchControlId, number>();
  private readonly touchControlBackgrounds = new Map<TouchControlId, TouchControlBackground>();
  private joystickPointerId: number | null = null;
  private joystickLaneDirection: JoystickLaneDirection | null = null;
  private readonly joystickOrigin = new Phaser.Math.Vector2();
  private readonly joystickCurrent = new Phaser.Math.Vector2();
  private joystickBaseGraphic: Phaser.GameObjects.Graphics | null = null;
  private joystickKnobGraphic: Phaser.GameObjects.Graphics | null = null;
  private readonly touchMovement = {
    left: false,
    right: false
  };

  constructor() {
    super(SceneKeys.Multiplayer);
  }

  preload(): void {
    this.backgroundFileName = this.debug.get().backgroundFileName;
    const backgroundTextureKey = getBackgroundTextureKey(this.backgroundFileName);
    let queued = false;

    if (!this.textures.exists(backgroundTextureKey)) {
      this.load.image(backgroundTextureKey, getBackgroundUrl(this.backgroundFileName));
      queued = true;
    }

    if (
      NINJA_ANIMATION_ASSETS.some((asset) => !this.textures.exists(asset.textureKey))
    ) {
      preloadNinjaAnimationAssets(this);
      queued = true;
    }

    if (queued) {
      this.showLoadingOverlay();
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.hideLoadingOverlay();

    if (this.didLoadFail()) {
      this.showLoadErrorOverlay();
      return;
    }

    registerNinjaAnimations(this);
    this.laneLayout = createThreeLaneLayoutFromYSettings(
      normalizeSandboxLaneSettings(this.debug.get().sandboxLaneSettings, this.profile.height)
    );
    this.createBackground();
    this.createHud();
    this.juice = new SceneJuice(this);
    this.registerKeyboard();
    this.createTouchControls();
    void this.joinRoom();

    this.trackCleanup(() => {
      this.disconnectRoom();
      this.destroyVisuals();
      this.juice?.destroy();
      this.juice = null;
    });
  }

  update(time: number, delta: number): void {
    this.juice?.update(delta);
    this.sendMovementInput(time);
    this.updatePlayerVisuals(time, delta);
    this.renderHud();
  }

  private createBackground(): void {
    const background = this.add
      .image(this.centerX, this.centerY, getBackgroundTextureKey(this.backgroundFileName))
      .setDepth(BACKGROUND_DEPTH);
    const frame = background.frame;

    background.setScale(
      getBackgroundCoverScale(frame.width, frame.height, this.profile.width, this.profile.height)
    );
    this.add
      .rectangle(this.centerX, this.centerY, this.profile.width, this.profile.height, 0x05080f, 0.22)
      .setDepth(BACKGROUND_DEPTH + 1);
  }

  private createHud(): void {
    this.hudGraphic = this.add.graphics().setDepth(HUD_DEPTH);
    this.statusText = this.add
      .text(this.centerX, HUD_STATUS_TOP_Y, 'Connecting', {
        fontFamily: GAME_DISPLAY_FONT_FAMILY,
        fontSize: `${HUD_STATUS_TOP_FONT_SIZE}px`,
        color: '#fff7df',
        stroke: '#07090d',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
    this.detailText = this.add
      .text(this.centerX, HUD_DETAIL_TOP_Y, '', {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: `${HUD_DETAIL_TOP_FONT_SIZE}px`,
        color: '#d6b76f',
        align: 'center',
        lineSpacing: 4,
        wordWrap: {
          width: this.profile.width - HUD_DETAIL_WRAP_INSET,
          useAdvancedWrap: true
        }
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
    this.roomText = this.add
      .text(24, this.profile.height - 24, '', {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '16px',
        color: '#c7d2df'
      })
      .setOrigin(0, 1)
      .setDepth(HUD_DEPTH + 1);
    this.slotLabels = [
      this.createSlotLabel(24, 20, 0),
      this.createSlotLabel(this.profile.width - 24, 20, 1)
    ];
  }

  private createSlotLabel(x: number, y: number, slot: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, `P${slot + 1}`, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '18px',
        color: '#fff7df'
      })
      .setOrigin(slot === 0 ? 0 : 1, 0)
      .setDepth(HUD_DEPTH + 1);
  }

  private registerKeyboard(): void {
    const keyboard = this.input.keyboard;

    if (keyboard === null) {
      return;
    }

    this.moveKeys = {
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      space: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      r: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R),
      esc: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    };

    const laneUp = (): void => this.sendLaneInput('up');
    const laneDown = (): void => this.sendLaneInput('down');
    const attack = (): void => this.sendAttackInput();
    const jump = (): void => this.sendJumpInput();
    const rematch = (): void => this.room?.send('rematch');
    const goBack = (): void => this.goTo(SceneKeys.MainMenu);
    const syncLastKey = (event: KeyboardEvent): void => {
      this.debug.setInput({ lastKey: event.code });
    };

    keyboard.on('keydown', syncLastKey);
    this.moveKeys.up.on('down', laneUp);
    this.moveKeys.w.on('down', laneUp);
    this.moveKeys.down.on('down', laneDown);
    this.moveKeys.s.on('down', laneDown);
    this.moveKeys.a.on('down', attack);
    this.moveKeys.space.on('down', jump);
    this.moveKeys.r.on('down', rematch);
    this.moveKeys.esc.on('down', goBack);

    this.trackCleanup(() => {
      keyboard.off('keydown', syncLastKey);
      this.moveKeys?.up.off('down', laneUp);
      this.moveKeys?.w.off('down', laneUp);
      this.moveKeys?.down.off('down', laneDown);
      this.moveKeys?.s.off('down', laneDown);
      this.moveKeys?.a.off('down', attack);
      this.moveKeys?.space.off('down', jump);
      this.moveKeys?.r.off('down', rematch);
      this.moveKeys?.esc.off('down', goBack);
    });
  }

  private createTouchControls(): void {
    if (!this.isTouchPrimaryInput()) {
      return;
    }

    const { width, height } = this.profile;
    const actionSize = TOUCH_CONTROL_ACTION_SIZE;
    const actionY = height - TOUCH_CONTROL_ACTION_BOTTOM_INSET;

    this.touchControlsContainer = this.add
      .container(0, 0)
      .setScrollFactor(0)
      .setDepth(TOUCH_CONTROL_DEPTH);
    this.createFloatingJoystick();

    const controls: readonly TouchControlButtonConfig[] = [
      {
        id: 'menu',
        x: this.centerX,
        y: TOUCH_CONTROL_MENU_Y,
        width: 128,
        height: 60,
        label: 'Menu',
        fontSize: 20,
        onPress: () => {
          this.goTo(SceneKeys.MainMenu);
        }
      },
      {
        id: 'attack',
        x: width - 176,
        y: actionY,
        width: actionSize,
        height: actionSize,
        label: '斬',
        fontSize: 27,
        onPress: () => {
          this.sendAttackInput();
        }
      },
      {
        id: 'jump',
        x: width - 86,
        y: actionY - TOUCH_CONTROL_EDGE_ACTION_LIFT,
        width: actionSize,
        height: actionSize,
        label: '跳',
        fontSize: 27,
        onPress: () => {
          this.sendJumpInput();
        }
      }
    ];

    controls.forEach((control) => this.createTouchControlButton(control));

    const releasePointer = (pointer: Phaser.Input.Pointer): void => {
      for (const [id, pointerId] of this.touchControlPointers) {
        if (pointerId === pointer.id) {
          this.releaseTouchControl(id);
        }
      }
    };

    this.input.on('pointerup', releasePointer);
    this.input.on('pointerupoutside', releasePointer);
    this.input.on('pointercancel', releasePointer);

    this.trackCleanup(() => {
      this.input.off('pointerup', releasePointer);
      this.input.off('pointerupoutside', releasePointer);
      this.input.off('pointercancel', releasePointer);
      this.touchControlPointers.clear();
      this.touchControlBackgrounds.clear();
      this.endFloatingJoystick();
      this.touchMovement.left = false;
      this.touchMovement.right = false;
    });
  }

  private createFloatingJoystick(): void {
    this.joystickBaseGraphic = this.add
      .graphics()
      .setScrollFactor(0)
      .setVisible(false);
    this.joystickKnobGraphic = this.add
      .graphics()
      .setScrollFactor(0)
      .setVisible(false);
    this.touchControlsContainer?.add([
      this.joystickBaseGraphic,
      this.joystickKnobGraphic
    ]);

    const startJoystick = (pointer: Phaser.Input.Pointer): void => {
      if (
        this.touchControlsContainer?.visible === false ||
        this.joystickPointerId !== null ||
        pointer.x >= this.profile.width * VIRTUAL_JOYSTICK_ZONE_RATIO
      ) {
        return;
      }

      this.joystickPointerId = pointer.id;
      this.joystickOrigin.set(pointer.x, pointer.y);
      this.joystickCurrent.copy(this.joystickOrigin);
      this.joystickLaneDirection = null;
      this.updateFloatingJoystick(pointer);
    };
    const moveJoystick = (pointer: Phaser.Input.Pointer): void => {
      if (this.joystickPointerId !== pointer.id) {
        return;
      }

      this.updateFloatingJoystick(pointer);
    };
    const stopJoystick = (pointer: Phaser.Input.Pointer): void => {
      if (this.joystickPointerId === pointer.id) {
        this.endFloatingJoystick();
      }
    };

    this.input.on('pointerdown', startJoystick);
    this.input.on('pointermove', moveJoystick);
    this.input.on('pointerup', stopJoystick);
    this.input.on('pointerupoutside', stopJoystick);
    this.input.on('pointercancel', stopJoystick);

    this.trackCleanup(() => {
      this.input.off('pointerdown', startJoystick);
      this.input.off('pointermove', moveJoystick);
      this.input.off('pointerup', stopJoystick);
      this.input.off('pointerupoutside', stopJoystick);
      this.input.off('pointercancel', stopJoystick);
    });
  }

  private updateFloatingJoystick(pointer: Phaser.Input.Pointer): void {
    this.joystickCurrent.set(pointer.x, pointer.y);

    const deltaX = this.joystickCurrent.x - this.joystickOrigin.x;
    const deltaY = this.joystickCurrent.y - this.joystickOrigin.y;
    const distance = Math.hypot(deltaX, deltaY);
    const active = distance >= VIRTUAL_JOYSTICK_DEAD_ZONE;

    this.touchMovement.left = active && deltaX < -VIRTUAL_JOYSTICK_DEAD_ZONE;
    this.touchMovement.right = active && deltaX > VIRTUAL_JOYSTICK_DEAD_ZONE;

    if (active && deltaY < -VIRTUAL_JOYSTICK_LANE_THRESHOLD) {
      if (this.joystickLaneDirection !== 'up') {
        this.sendLaneInput('up');
        this.joystickLaneDirection = 'up';
      }
    } else if (active && deltaY > VIRTUAL_JOYSTICK_LANE_THRESHOLD) {
      if (this.joystickLaneDirection !== 'down') {
        this.sendLaneInput('down');
        this.joystickLaneDirection = 'down';
      }
    } else if (Math.abs(deltaY) < VIRTUAL_JOYSTICK_LANE_RESET) {
      this.joystickLaneDirection = null;
    }

    this.renderFloatingJoystick(deltaX, deltaY, distance);
  }

  private endFloatingJoystick(): void {
    this.joystickPointerId = null;
    this.joystickLaneDirection = null;
    this.touchMovement.left = false;
    this.touchMovement.right = false;
    this.joystickBaseGraphic?.setVisible(false);
    this.joystickKnobGraphic?.setVisible(false);
  }

  private renderFloatingJoystick(
    deltaX: number,
    deltaY: number,
    distance: number
  ): void {
    const base = this.joystickBaseGraphic;
    const knob = this.joystickKnobGraphic;

    if (base === null || knob === null) {
      return;
    }

    const clampedDistance = Math.min(distance, VIRTUAL_JOYSTICK_RADIUS);
    const angle = Math.atan2(deltaY, deltaX);
    const knobX =
      distance === 0
        ? this.joystickOrigin.x
        : this.joystickOrigin.x + Math.cos(angle) * clampedDistance;
    const knobY =
      distance === 0
        ? this.joystickOrigin.y
        : this.joystickOrigin.y + Math.sin(angle) * clampedDistance;

    base.clear();
    base.lineStyle(2, 0xd6b76f, 0.42);
    base.fillStyle(0x080d14, 0.12);
    base.fillCircle(this.joystickOrigin.x, this.joystickOrigin.y, VIRTUAL_JOYSTICK_RADIUS);
    base.strokeCircle(this.joystickOrigin.x, this.joystickOrigin.y, VIRTUAL_JOYSTICK_RADIUS);
    base.lineStyle(1, 0xffffff, 0.16);
    base.strokeCircle(
      this.joystickOrigin.x,
      this.joystickOrigin.y,
      VIRTUAL_JOYSTICK_DEAD_ZONE
    );
    base.setVisible(true);

    knob.clear();
    knob.fillStyle(0xffe8a8, 0.28);
    knob.fillCircle(knobX, knobY, VIRTUAL_JOYSTICK_KNOB_RADIUS);
    knob.lineStyle(2, 0xffe8a8, 0.5);
    knob.strokeCircle(knobX, knobY, VIRTUAL_JOYSTICK_KNOB_RADIUS);
    knob.setVisible(true);
  }

  private createTouchControlButton(config: TouchControlButtonConfig): void {
    const background = this.add
      .graphics({ x: config.x, y: config.y })
      .setScrollFactor(0)
      .setInteractive(
        new Phaser.Geom.Rectangle(
          -config.width / 2,
          -config.height / 2,
          config.width,
          config.height
        ),
        Phaser.Geom.Rectangle.Contains
      );

    this.drawTouchControlBackground(
      background,
      config.width,
      config.height,
      false
    );

    const label = this.add
      .text(config.x, config.y, config.label, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: `${config.fontSize ?? 28}px`,
        fontStyle: '700',
        color: '#fff7df',
        stroke: '#05080d',
        strokeThickness: 3,
        shadow: {
          offsetX: 0,
          offsetY: 2,
          color: '#000000',
          blur: 4,
          fill: true
        }
      })
      .setOrigin(0.5)
      .setScrollFactor(0);

    this.touchControlsContainer?.add([background, label]);
    this.touchControlBackgrounds.set(config.id, {
      graphic: background,
      width: config.width,
      height: config.height
    });

    const press = (pointer: Phaser.Input.Pointer): void => {
      this.touchControlPointers.set(config.id, pointer.id);
      this.drawTouchControlBackground(
        background,
        config.width,
        config.height,
        true
      );
      config.onPress();
    };
    const release = (pointer: Phaser.Input.Pointer): void => {
      if (this.touchControlPointers.get(config.id) !== pointer.id) {
        return;
      }

      this.releaseTouchControl(config.id);
    };

    background.on('pointerdown', press);
    background.on('pointerup', release);
    background.on('pointerupoutside', release);

    this.trackCleanup(() => {
      background.off('pointerdown', press);
      background.off('pointerup', release);
      background.off('pointerupoutside', release);
    });
  }

  private drawTouchControlBackground(
    graphic: Phaser.GameObjects.Graphics,
    width: number,
    height: number,
    pressed: boolean
  ): void {
    const radius = Math.min(TOUCH_CONTROL_RADIUS, width / 2, height / 2);

    graphic.clear();
    graphic.fillStyle(
      pressed ? 0x20314d : 0x080d14,
      pressed ? TOUCH_CONTROL_PRESSED_FILL_ALPHA : TOUCH_CONTROL_FILL_ALPHA
    );
    graphic.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
    graphic.lineStyle(
      2,
      pressed ? 0x7ed7ff : 0xd6b76f,
      pressed ? TOUCH_CONTROL_PRESSED_STROKE_ALPHA : TOUCH_CONTROL_STROKE_ALPHA
    );
    graphic.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
  }

  private releaseTouchControl(id: TouchControlId): void {
    if (!this.touchControlPointers.delete(id)) {
      return;
    }

    const background = this.touchControlBackgrounds.get(id);
    if (background !== undefined) {
      this.drawTouchControlBackground(
        background.graphic,
        background.width,
        background.height,
        false
      );
    }
  }

  private async joinRoom(): Promise<void> {
    try {
      this.logMultiplayer('join-room:start');
      const room = await joinDuelRoom();

      this.room = room;
      this.bindRoom(room);
      this.roomText?.setText(`Room ${room.roomId}`);
      this.logMultiplayer('join-room:success', {
        roomId: room.roomId,
        sessionId: room.sessionId,
        reconnectionToken: room.reconnectionToken
      });
    } catch (error) {
      this.hasConnectionError = true;
      this.applyHudMessageLayout('top');
      this.statusText?.setText('Connection failed');
      this.detailText?.setText('Start the Colyseus server and try again');
      this.logMultiplayer('join-room:error', {
        error: error instanceof Error ? error.message : String(error)
      });
      this.createTextButton({
        x: this.centerX,
        y: this.centerY + 86,
        label: 'Back',
        onClick: () => this.goTo(SceneKeys.MainMenu),
        width: 210,
        height: 54
      }).setDepth(HUD_DEPTH + 2);
    }
  }

  private bindRoom(room: MultiplayerRoom): void {
    const callbacks = Callbacks.get(room as never) as unknown as MultiplayerCallbacks;

    this.roomUnsubscribers.push(
      callbacks.onAdd('players', (player, sessionId) => {
        this.logMultiplayer('players:add', {
          sessionId,
          isLocal: sessionId === room.sessionId,
          player: this.summarizePlayer(player)
        });
        this.addPlayerVisual(sessionId, player, callbacks);
      }, true),
      callbacks.onRemove('players', (player, sessionId) => {
        this.logMultiplayer('players:remove', {
          sessionId,
          isLocal: sessionId === room.sessionId,
          player: this.summarizePlayer(player)
        });
        this.removePlayerVisual(sessionId);
      }),
      callbacks.listen('phase', (value, previousValue) => {
        this.logMultiplayer('state:phase', { value, previousValue });
        this.playRoundStartSfxForPhase(value, previousValue);
        this.renderHud();
      }, true),
      callbacks.listen('winnerId', (value, previousValue) => {
        this.logMultiplayer('state:winnerId', { value, previousValue });
        this.renderHud();
      }),
      callbacks.listen('countdownMs', () => {
        this.renderHud();
      }),
      callbacks.listen('status', (value, previousValue) => {
        this.logMultiplayer('state:status', { value, previousValue });
        this.renderHud();
      })
    );

    this.roomUnsubscribers.push(
      room.onMessage<HitMessage>('hit', (message) => {
        this.logMultiplayer('message:hit', message);
        this.playHitFeedback(message);
        this.playHitSfx(message);
      }),
      room.onMessage<SwingMessage>('swing', (message) => {
        this.logMultiplayer('message:swing', message);
        if (
          this.room?.state.phase === 'fighting' &&
          this.visualsBySessionId.has(message.attackerId)
        ) {
          this.playSfx('player-slash');
        }
      })
    );

    const handleRoomError = (code: number, message?: string): void => {
      this.logMultiplayer('room:error', { code, message });
      this.applyHudMessageLayout('top');
      this.statusText?.setText(`Room error ${code}`);
      this.detailText?.setText(message ?? '');
    };
    const handleRoomLeave = (code: number): void => {
      this.logMultiplayer('room:leave', {
        code,
        phase: this.room?.state.phase,
        winnerId: this.room?.state.winnerId
      });
      if (
        code !== 1000 &&
        !this.hasConnectionError &&
        this.statusText !== null &&
        this.statusText.active
      ) {
        this.applyHudMessageLayout('top');
        this.statusText.setText('Disconnected');
      }
    };

    room.onError(handleRoomError);
    room.onLeave(handleRoomLeave);
    this.roomUnsubscribers.push(
      () => room.onError.remove(handleRoomError),
      () => room.onLeave.remove(handleRoomLeave)
    );
  }

  private addPlayerVisual(
    sessionId: string,
    player: MultiplayerPlayerState,
    callbacks: MultiplayerCallbacks
  ): void {
    if (this.visualsBySessionId.has(sessionId)) {
      this.refreshPlayerVisual(sessionId, player);
      return;
    }

    const actorId = getActorIdForSlot(player.slot);
    const action = getRenderableAction(actorId, player.action);
    const scale = this.getActorScaleForLaneY(player.y);
    const spritePosition = this.getSpritePositionForLane(player, actorId, action, scale);
    const sprite = this.add
      .sprite(
        spritePosition.x,
        spritePosition.y,
        getNinjaTextureKey(actorId, player.facing, action),
        0
      )
      .setOrigin(0.5, 1)
      .setScale(scale)
      .setDepth(ACTOR_DEPTH_BASE);
    const nameLabel = this.add
      .text(spritePosition.x, spritePosition.y - 148 * scale, player.name, {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '16px',
        color: '#fff7df',
        stroke: '#07090d',
        strokeThickness: 3
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH - 1);
    const visual: PlayerVisual = {
      actorId,
      sprite,
      nameLabel,
      renderedLaneX: player.x,
      renderedLaneY: player.y,
      targetX: player.x,
      targetY: player.y,
      state: player,
      lastAnimationKey: '',
      lastAttackSeq: player.attackSeq,
      lastJumpSeq: player.jumpSeq,
      lastHurtSeq: player.hurtSeq,
      damageBlinkUntil: Number.NEGATIVE_INFINITY,
      damageBlinkTween: null,
      unsubscribers: []
    };

    this.visualsBySessionId.set(sessionId, visual);
    visual.unsubscribers.push(
      callbacks.onChange(player, () => {
        this.refreshPlayerVisual(sessionId, player);
      })
    );
    this.refreshPlayerVisual(sessionId, player);
  }

  private refreshPlayerVisual(sessionId: string, player: MultiplayerPlayerState): void {
    const visual = this.visualsBySessionId.get(sessionId);

    if (visual === undefined) {
      return;
    }

    visual.state = player;
    visual.targetX = player.x;
    visual.targetY = player.y;
    this.applyPlayerVisualBaseAlpha(visual);
    visual.nameLabel.setAlpha(player.connected ? 1 : 0.55);

    const action = getRenderableAction(visual.actorId, player.action);
    const animationKey = getNinjaAnimationKey(
      visual.actorId,
      player.facing as FacingDirection,
      action
    );
    let restart = false;

    if (player.action === 'slash' && player.attackSeq !== visual.lastAttackSeq) {
      visual.lastAttackSeq = player.attackSeq;
      restart = true;
    }

    if (player.action === 'jump' && player.jumpSeq !== visual.lastJumpSeq) {
      visual.lastJumpSeq = player.jumpSeq;
      restart = true;
    }

    if (player.action === 'hurt' && player.hurtSeq !== visual.lastHurtSeq) {
      visual.lastHurtSeq = player.hurtSeq;
      restart = true;
    }

    if (visual.lastAnimationKey !== animationKey || restart) {
      visual.sprite.play(animationKey, !restart);
      visual.lastAnimationKey = animationKey;
    }
  }

  private removePlayerVisual(sessionId: string): void {
    const visual = this.visualsBySessionId.get(sessionId);

    if (visual === undefined) {
      return;
    }

    for (const unsubscribe of visual.unsubscribers) {
      unsubscribe();
    }

    this.clearPlayerVisualDamageFeedback(visual);
    visual.sprite.destroy();
    visual.nameLabel.destroy();
    this.visualsBySessionId.delete(sessionId);
  }

  private updatePlayerVisuals(time: number, deltaMs: number): void {
    const alpha = Math.min(1, (deltaMs / 1000) * 12);

    for (const visual of this.visualsBySessionId.values()) {
      if (visual.damageBlinkTween !== null && time >= visual.damageBlinkUntil) {
        this.endPlayerVisualDamageBlink(visual);
      }

      const action = getRenderableAction(visual.actorId, visual.state.action);
      const frame = this.getInterpolatedVisualFrame(visual, action, alpha);

      visual.renderedLaneX = frame.laneX;
      visual.renderedLaneY = frame.laneY;
      visual.sprite.setPosition(frame.spriteX, frame.spriteY);
      visual.sprite.setScale(frame.scale);
      visual.sprite.setDepth(this.getActorDepthForLaneY(frame.laneY, visual.state.slot));
      visual.nameLabel.setPosition(frame.spriteX, frame.spriteY - 148 * frame.scale);
      visual.nameLabel.setText(
        visual.state.id === this.room?.sessionId
          ? `${visual.state.name} You`
          : visual.state.name
      );
    }
  }

  private getInterpolatedVisualFrame(
    visual: PlayerVisual,
    actionId: string,
    alpha: number
  ): NinjaLanePresentationFrame {
    if (this.laneLayout !== null) {
      return getInterpolatedNinjaLanePresentationFrame({
        boundsConfig: this.app.getNinjaBoundsConfig(),
        actorId: visual.actorId,
        direction: visual.state.facing,
        actionId,
        layout: this.laneLayout,
        baseScale: NINJA_SPRITE_SCALE,
        currentLaneX: visual.renderedLaneX,
        currentLaneY: visual.renderedLaneY,
        targetLaneX: visual.targetX,
        targetLaneY: visual.targetY,
        alpha
      });
    }

    const laneX = Phaser.Math.Linear(visual.renderedLaneX, visual.targetX, alpha);
    const laneY = Phaser.Math.Linear(visual.renderedLaneY, visual.targetY, alpha);
    const scale = NINJA_SPRITE_SCALE;
    const spritePosition = getNinjaSpritePositionForLane({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId: visual.actorId,
      direction: visual.state.facing,
      actionId,
      scale,
      laneX,
      laneY
    });

    return {
      laneX,
      laneY,
      scale,
      spriteX: spritePosition.x,
      spriteY: spritePosition.y
    };
  }

  private renderHud(): void {
    const state = this.room?.state;

    this.hudGraphic?.clear();
    this.renderHealthBars();

    if (state === undefined) {
      if (!this.hasConnectionError) {
        this.applyHudMessageLayout('top');
        this.statusText?.setText('Connecting');
        this.detailText?.setText('');
      }
      return;
    }

    switch (state.phase) {
      case 'waiting':
        this.applyHudMessageLayout('top');
        this.statusText?.setText(WAITING_STATUS_TEXT);
        this.detailText?.setText(WAITING_DETAIL_TEXT);
        break;
      case 'countdown':
        this.applyHudMessageLayout('countdown');
        this.statusText?.setText(String(Math.max(1, Math.ceil(state.countdownMs / 1000))));
        this.detailText?.setText('Get ready');
        break;
      case 'fighting':
        this.applyHudMessageLayout('top');
        this.statusText?.setText('Fight');
        this.detailText?.setText('');
        break;
      case 'finished':
        this.applyHudMessageLayout('top');
        this.statusText?.setText(state.winnerId === this.room?.sessionId ? 'You win' : 'You lose');
        this.detailText?.setText('Press R for rematch');
        break;
    }
  }

  private applyHudMessageLayout(layout: HudMessageLayout): void {
    if (layout === 'countdown') {
      this.statusText
        ?.setPosition(this.centerX, this.centerY)
        .setFontSize(HUD_COUNTDOWN_STATUS_FONT_SIZE);
      this.detailText
        ?.setPosition(this.centerX, this.centerY + HUD_COUNTDOWN_DETAIL_OFFSET_Y)
        .setFontSize(HUD_COUNTDOWN_DETAIL_FONT_SIZE);
      return;
    }

    this.statusText
      ?.setPosition(this.centerX, HUD_STATUS_TOP_Y)
      .setFontSize(HUD_STATUS_TOP_FONT_SIZE);
    this.detailText
      ?.setPosition(this.centerX, HUD_DETAIL_TOP_Y)
      .setFontSize(HUD_DETAIL_TOP_FONT_SIZE);
  }

  private playRoundStartSfxForPhase(
    phase: string | number,
    previousPhase?: string | number
  ): void {
    if (phase === previousPhase) {
      return;
    }

    if (phase !== 'countdown' && phase !== 'fighting') {
      return;
    }

    if (phase === 'fighting' && previousPhase !== 'countdown') {
      return;
    }

    this.logMultiplayer('sfx:round-start-play', { phase, previousPhase });
    this.playSfx('round-start');
  }

  private renderHealthBars(): void {
    if (this.hudGraphic === null) {
      return;
    }

    const players = [...this.visualsBySessionId.values()].sort(
      (left, right) => left.state.slot - right.state.slot
    );

    for (let slot = 0; slot < 2; slot += 1) {
      const visual = players.find((candidate) => candidate.state.slot === slot);
      const x = slot === 0 ? 24 : this.profile.width - HEALTH_BAR_WIDTH - 24;
      const y = 48;
      const ratio =
        visual === undefined
          ? 0
          : Phaser.Math.Clamp(visual.state.hp / MULTIPLAYER_MAX_HEALTH, 0, 1);
      const fillColor = ratio > 0.5 ? 0x35d08f : ratio > 0.25 ? 0xf6c961 : 0xe14c4c;

      this.hudGraphic.fillStyle(0x080d14, 0.76);
      this.hudGraphic.fillRoundedRect(x, y, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, 4);
      this.hudGraphic.lineStyle(2, 0xd6b76f, 0.72);
      this.hudGraphic.strokeRoundedRect(x, y, HEALTH_BAR_WIDTH, HEALTH_BAR_HEIGHT, 4);

      if (ratio > 0) {
        this.hudGraphic.fillStyle(fillColor, 0.92);
        this.hudGraphic.fillRoundedRect(
          x + 3,
          y + 3,
          (HEALTH_BAR_WIDTH - 6) * ratio,
          HEALTH_BAR_HEIGHT - 6,
          3
        );
      }

      const label = this.slotLabels[slot];
      const hp = visual?.state.hp ?? 0;
      const name = visual?.state.name ?? `P${slot + 1}`;
      const suffix = visual?.state.id === this.room?.sessionId ? ' You' : '';

      label?.setText(`${name}${suffix} HP ${hp}/${MULTIPLAYER_MAX_HEALTH}`);
    }
  }

  private sendMovementInput(time: number): void {
    if (this.room === null) {
      return;
    }

    const { left, right } = this.readMovementInput();
    const signature = `${Number(left)}:${Number(right)}`;

    if (
      signature === this.lastInputSignature &&
      time - this.lastInputSentAt < INPUT_SEND_INTERVAL_MS
    ) {
      return;
    }

    this.lastInputSignature = signature;
    this.lastInputSentAt = time;
    this.room.send('input', { left, right });
    this.debug.setInput({ left, right, up: false, down: false });
  }

  private readMovementInput(): { readonly left: boolean; readonly right: boolean } {
    return {
      left: (this.moveKeys?.left.isDown ?? false) || this.touchMovement.left,
      right: (this.moveKeys?.right.isDown ?? false) || this.touchMovement.right
    };
  }

  private sendLaneInput(direction: 'up' | 'down'): void {
    if (!this.canSendActionInput()) {
      return;
    }

    this.room?.send('lane', { direction });
    this.playSfx('lane-dash');
    this.debug.setInput({ up: direction === 'up', down: direction === 'down' });
  }

  private sendJumpInput(): void {
    if (!this.canSendActionInput()) {
      return;
    }

    this.room?.send('jump');
    this.playSfx('jump');
  }

  private sendAttackInput(): void {
    if (!this.canSendActionInput()) {
      return;
    }

    this.room?.send('attack');
  }

  private canSendActionInput(): boolean {
    const player = this.getLocalPlayerState();

    return (
      this.room?.state.phase === 'fighting' &&
      player !== undefined &&
      player.connected &&
      isControllableAction(player.action)
    );
  }

  private getLocalPlayerState(): MultiplayerPlayerState | undefined {
    if (this.room === null) {
      return undefined;
    }

    return this.room.state.players.get(this.room.sessionId);
  }

  private playHitSfx(message: HitMessage): void {
    const room = this.room;

    if (room === null || room.state.phase !== 'fighting') {
      this.logMultiplayer('sfx:hit-skip', {
        reason: room === null ? 'no-room' : 'not-fighting',
        phase: room?.state.phase,
        message
      });
      return;
    }

    if (message.targetId === room.sessionId) {
      this.logMultiplayer('sfx:hit-play', {
        triggerId: 'player-hurt',
        message
      });
      this.playSfx('player-hurt');
      return;
    }

    this.logMultiplayer('sfx:hit-play', {
      triggerId: 'hit',
      message
    });
    this.playSfx('hit');
  }

  private playHitFeedback(message: HitMessage): void {
    const room = this.room;

    if (room === null || room.state.phase !== 'fighting') {
      this.logMultiplayer('fx:hit-skip', {
        reason: room === null ? 'no-room' : 'not-fighting',
        phase: room?.state.phase,
        message
      });
      return;
    }

    const visual = this.visualsBySessionId.get(message.targetId);

    if (visual === undefined || !visual.sprite.active) {
      this.logMultiplayer('fx:hit-skip', {
        reason: 'missing-target-visual',
        message
      });
      return;
    }

    if (message.hp <= 0) {
      this.clearPlayerVisualDamageFeedback(visual);
      this.playPlayerDefeatFeedback(visual);
      return;
    }

    this.startPlayerVisualDamageBlink(visual);
  }

  private playPlayerDefeatFeedback(visual: PlayerVisual): void {
    const center = this.getVisualCenter(visual);

    this.juice?.burstEnemyDefeat(center.x, center.y, this.getVisualScale(visual));
  }

  private getVisualCenter(visual: PlayerVisual): { readonly x: number; readonly y: number } {
    return {
      x: visual.sprite.x,
      y: visual.sprite.y - visual.sprite.displayHeight * 0.5
    };
  }

  private getVisualScale(visual: PlayerVisual): number {
    const scale = Math.abs(visual.sprite.scaleX);

    return Number.isFinite(scale) && scale > 0 ? scale : NINJA_SPRITE_SCALE;
  }

  private startPlayerVisualDamageBlink(visual: PlayerVisual): void {
    visual.damageBlinkUntil = this.time.now + PLAYER_INVULNERABILITY_MS;
    visual.damageBlinkTween?.stop();

    const baseAlpha = this.getPlayerVisualBaseAlpha(visual);
    visual.sprite.setAlpha(baseAlpha);
    visual.damageBlinkTween = this.tweens.add({
      targets: visual.sprite,
      alpha: { from: baseAlpha, to: baseAlpha * 0.25 },
      duration: PLAYER_INVULNERABILITY_BLINK_MS,
      yoyo: true,
      repeat: -1
    });
  }

  private endPlayerVisualDamageBlink(visual: PlayerVisual): void {
    visual.damageBlinkTween?.stop();
    visual.damageBlinkTween = null;
    visual.damageBlinkUntil = Number.NEGATIVE_INFINITY;
    this.applyPlayerVisualBaseAlpha(visual);
  }

  private applyPlayerVisualBaseAlpha(visual: PlayerVisual): void {
    if (visual.damageBlinkTween !== null) {
      return;
    }

    visual.sprite.setAlpha(this.getPlayerVisualBaseAlpha(visual));
  }

  private getPlayerVisualBaseAlpha(visual: PlayerVisual): number {
    return visual.state.connected ? 1 : 0.45;
  }

  private clearPlayerVisualDamageFeedback(visual: PlayerVisual): void {
    visual.damageBlinkTween?.stop();
    visual.damageBlinkTween = null;
    visual.damageBlinkUntil = Number.NEGATIVE_INFINITY;
    this.applyPlayerVisualBaseAlpha(visual);
  }

  private getActorScaleForLaneY(laneY: number): number {
    if (this.laneLayout === null) {
      return NINJA_SPRITE_SCALE;
    }

    return getNinjaLanePerspectiveScaleForY({
      layout: this.laneLayout,
      laneY,
      baseScale: NINJA_SPRITE_SCALE
    });
  }

  private getSpritePositionForLane(
    player: MultiplayerPlayerState,
    actorId: NinjaActorId,
    actionId: string,
    scale: number
  ): { readonly x: number; readonly y: number } {
    return getNinjaSpritePositionForLane({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId,
      direction: player.facing,
      actionId,
      scale,
      laneX: player.x,
      laneY: player.y
    });
  }

  private getActorDepthForLaneY(laneY: number, slot: number): number {
    if (this.laneLayout === null) {
      return ACTOR_DEPTH_BASE + this.getActorDepthBiasForSlot(slot);
    }

    const [upperLane, middleLane, lowerLane] = this.laneLayout.lanes;
    const safeLaneY = Number.isFinite(laneY) ? laneY : middleLane.y;
    const laneSpan = Math.max(1, lowerLane.y - upperLane.y);
    const depthProgress = Phaser.Math.Clamp(
      (safeLaneY - upperLane.y) / laneSpan,
      0,
      1
    );

    return (
      ACTOR_DEPTH_BASE +
      depthProgress * ACTOR_DEPTH_RANGE +
      this.getActorDepthBiasForSlot(slot)
    );
  }

  private getActorDepthBiasForSlot(slot: number): number {
    return slot === 0 ? PLAYER_DEPTH_BIAS : ENEMY_DEPTH_BIAS;
  }

  private disconnectRoom(): void {
    this.logMultiplayer('disconnect-room:start', {
      roomId: this.room?.roomId,
      sessionId: this.room?.sessionId,
      phase: this.room?.state.phase,
      winnerId: this.room?.state.winnerId
    });
    for (const unsubscribe of this.roomUnsubscribers.splice(0)) {
      unsubscribe();
    }

    const room = this.room;
    this.room = null;

    if (room !== null) {
      void room.leave(true).finally(() => {
        this.logMultiplayer('disconnect-room:left', {
          roomId: room.roomId,
          sessionId: room.sessionId
        });
        room.removeAllListeners();
      });
    }
  }

  private logMultiplayer(event: string, details: object = {}): void {
    const payload = {
      event,
      sceneKey: this.scene.key,
      localSessionId: this.room?.sessionId,
      roomId: this.room?.roomId,
      phase: this.room?.state.phase,
      winnerId: this.room?.state.winnerId,
      at: Date.now(),
      ...details
    };
    const targetWindow = window as Window & {
      __ninjaSlashMultiplayerEvents?: Array<typeof payload>;
    };

    targetWindow.__ninjaSlashMultiplayerEvents = [
      ...(targetWindow.__ninjaSlashMultiplayerEvents ?? []),
      payload
    ].slice(-80);

    console.info(
      `[ninja-slash:multiplayer] event=${event} phase=${payload.phase ?? ''} winner=${payload.winnerId ?? ''} local=${payload.localSessionId ?? ''} room=${payload.roomId ?? ''} details=${this.formatDebugDetails(details)} at=${payload.at}`,
      payload
    );
  }

  private formatDebugDetails(details: object): string {
    try {
      return JSON.stringify(details);
    } catch {
      return '[unserializable]';
    }
  }

  private summarizePlayer(player: MultiplayerPlayerState): Record<string, unknown> {
    return {
      id: player.id,
      slot: player.slot,
      connected: player.connected,
      hp: player.hp,
      action: player.action,
      readyForRematch: player.readyForRematch
    };
  }

  private destroyVisuals(): void {
    for (const sessionId of [...this.visualsBySessionId.keys()]) {
      this.removePlayerVisual(sessionId);
    }
  }
}
