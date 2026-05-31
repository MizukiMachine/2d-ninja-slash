import { Callbacks } from '@colyseus/sdk';
import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
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
  getNinjaLanePerspectiveScaleForY,
  getNinjaSpritePositionForLane
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
  targetX: number;
  targetY: number;
  state: MultiplayerPlayerState;
  lastAnimationKey: string;
  lastAttackSeq: number;
  lastJumpSeq: number;
  lastHurtSeq: number;
  readonly unsubscribers: Unsubscribe[];
}

const BACKGROUND_DEPTH = -30;
const ACTOR_DEPTH_BASE = 20;
const ACTOR_DEPTH_RANGE = 30;
const PLAYER_DEPTH_BIAS = 0.6;
const ENEMY_DEPTH_BIAS = 0;
const HUD_DEPTH = 140;
const NINJA_SPRITE_SCALE = 2.1;
const INPUT_SEND_INTERVAL_MS = 50;
const HEALTH_BAR_WIDTH = 292;
const HEALTH_BAR_HEIGHT = 24;

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
    this.registerKeyboard();
    void this.joinRoom();

    this.trackCleanup(() => {
      this.disconnectRoom();
      this.destroyVisuals();
    });
  }

  update(time: number, delta: number): void {
    this.sendMovementInput(time);
    this.updatePlayerVisuals(delta);
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
      .text(this.centerX, 34, 'Connecting', {
        fontFamily: GAME_DISPLAY_FONT_FAMILY,
        fontSize: '30px',
        color: '#fff7df',
        stroke: '#07090d',
        strokeThickness: 5
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
    this.detailText = this.add
      .text(this.centerX, 72, '', {
        fontFamily: GAME_UI_FONT_FAMILY,
        fontSize: '18px',
        color: '#d6b76f'
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
    } catch {
      this.hasConnectionError = true;
      this.statusText?.setText('Connection failed');
      this.detailText?.setText('Start the Colyseus server and try again');
      this.logMultiplayer('join-room:error');
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
      targetX: player.x,
      targetY: player.y,
      state: player,
      lastAnimationKey: '',
      lastAttackSeq: player.attackSeq,
      lastJumpSeq: player.jumpSeq,
      lastHurtSeq: player.hurtSeq,
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
    visual.sprite.setAlpha(player.connected ? 1 : 0.45);
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

    visual.sprite.destroy();
    visual.nameLabel.destroy();
    this.visualsBySessionId.delete(sessionId);
  }

  private updatePlayerVisuals(deltaMs: number): void {
    const alpha = Math.min(1, (deltaMs / 1000) * 12);

    for (const visual of this.visualsBySessionId.values()) {
      const scale = this.getActorScaleForLaneY(visual.targetY);
      const action = getRenderableAction(visual.actorId, visual.state.action);
      const spriteTarget = this.getSpritePositionForLane(
        visual.state,
        visual.actorId,
        action,
        scale
      );

      visual.sprite.x = Phaser.Math.Linear(visual.sprite.x, spriteTarget.x, alpha);
      visual.sprite.y = Phaser.Math.Linear(visual.sprite.y, spriteTarget.y, alpha);
      visual.sprite.setScale(scale);
      visual.sprite.setDepth(this.getActorDepthForLaneY(visual.targetY, visual.state.slot));
      visual.nameLabel.setPosition(visual.sprite.x, visual.sprite.y - 148 * scale);
      visual.nameLabel.setText(
        visual.state.id === this.room?.sessionId
          ? `${visual.state.name} You`
          : visual.state.name
      );
    }
  }

  private renderHud(): void {
    const state = this.room?.state;

    this.hudGraphic?.clear();
    this.renderHealthBars();

    if (state === undefined) {
      if (!this.hasConnectionError) {
        this.statusText?.setText('Connecting');
        this.detailText?.setText('');
      }
      return;
    }

    switch (state.phase) {
      case 'waiting':
        this.statusText?.setText('Waiting');
        this.detailText?.setText('Opponent needed');
        break;
      case 'countdown':
        this.statusText?.setText(String(Math.max(1, Math.ceil(state.countdownMs / 1000))));
        this.detailText?.setText('Get ready');
        break;
      case 'fighting':
        this.statusText?.setText('Fight');
        this.detailText?.setText('');
        break;
      case 'finished':
        this.statusText?.setText(state.winnerId === this.room?.sessionId ? 'You win' : 'You lose');
        this.detailText?.setText('Press R for rematch');
        break;
    }
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
    if (this.room === null || this.moveKeys === null) {
      return;
    }

    const left = this.moveKeys.left.isDown;
    const right = this.moveKeys.right.isDown;
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
