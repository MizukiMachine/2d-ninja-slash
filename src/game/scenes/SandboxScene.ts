import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import {
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
  getDebugBackgroundUrl,
  type DebugBackgroundFileName
} from '../assets/ninjaAssetCatalog';

type FacingDirection = 'left' | 'right';
type MainNinjaAction = 'idle' | 'run' | 'jump' | 'slash' | 'slash2' | 'slash3' | 'impact';
type ControlledMainNinjaAction = Exclude<MainNinjaAction, 'impact'>;
type PlayerAttackAction = 'slash' | 'slash2' | 'slash3';
type PlayerAction = ControlledMainNinjaAction | 'hurt';
type EnemyNinjaAction = 'idle' | 'run' | 'slash';
type EnemyAction = EnemyNinjaAction | 'recover';

interface MoveKeys {
  readonly w: Phaser.Input.Keyboard.Key;
  readonly a: Phaser.Input.Keyboard.Key;
  readonly s: Phaser.Input.Keyboard.Key;
  readonly d: Phaser.Input.Keyboard.Key;
  readonly up: Phaser.Input.Keyboard.Key;
  readonly down: Phaser.Input.Keyboard.Key;
  readonly left: Phaser.Input.Keyboard.Key;
  readonly right: Phaser.Input.Keyboard.Key;
  readonly z: Phaser.Input.Keyboard.Key;
  readonly shift: Phaser.Input.Keyboard.Key;
  readonly ctrl: Phaser.Input.Keyboard.Key;
  readonly space: Phaser.Input.Keyboard.Key;
  readonly esc: Phaser.Input.Keyboard.Key;
}

interface NinjaAnimationConfig<TAction extends string> {
  readonly action: TAction;
  readonly direction: FacingDirection;
  readonly frameCount: number;
  readonly frameRate: number;
  readonly repeat: number;
}

interface MovementInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly x: number;
  readonly y: number;
}

interface NinjaBodyConfig {
  readonly width: number;
  readonly height: number;
  readonly offsetX: number;
  readonly offsetY: number;
}

interface AttackHitBoxConfig {
  readonly width: number;
  readonly height: number;
  readonly frontOffset: number;
  readonly yOffset: number;
}

const NINJA_ACTOR_ROOT_URL = '/assets/actors';
const NINJA_FRAME_SIZE = 256;
const NINJA_REFERENCE_FRAME_SIZE = 216;
const NINJA_FRAME_COUNT = 32;
const NINJA_IDLE_ANCHOR_FRAME = 0;
const NINJA_ANIMATION_PLAYBACK_RATE = 3;
const NINJA_DISPLAY_SCALE_MULTIPLIER = 1.5 * 1.4;
const NINJA_TARGET_SCALE = 0.92 * NINJA_DISPLAY_SCALE_MULTIPLIER;
const NINJA_SPEED = 260;
const ENEMY_NINJA_SPEED = NINJA_SPEED;
const ENEMY_ATTACK_RANGE = 112;
const ENEMY_ATTACK_RECOVERY_MS = 900;
const PLAYER_DAMAGE_KNOCKBACK_SPEED = 360;
const ATTACK3_FORWARD_SPEED = 90;
const PLAYER_DEPTH = 10;
const ENEMY_DEPTH = 9;
const ACTOR_SHADOW_DEPTH = 8;
const PLAYER_ATTACK_HIT_BOXES: Record<PlayerAttackAction, AttackHitBoxConfig> = {
  slash: {
    width: 108,
    height: 34,
    frontOffset: 48,
    yOffset: -148
  },
  slash2: {
    width: 132,
    height: 36,
    frontOffset: 48,
    yOffset: -150
  },
  slash3: {
    width: 156,
    height: 38,
    frontOffset: 50,
    yOffset: -150
  }
};
const ENEMY_ATTACK_HIT_BOX: AttackHitBoxConfig = {
  width: 112,
  height: 34,
  frontOffset: 46,
  yOffset: -144
};
// Phaser AnimationFrame.index is 1-based.
const MAIN_NINJA_ATTACK_REACH_FRAMES = [14, 15] as const;
const ENEMY_NINJA_ATTACK_REACH_FRAMES = [16, 17] as const;

const NINJA_SCALE = NINJA_TARGET_SCALE * (NINJA_REFERENCE_FRAME_SIZE / NINJA_FRAME_SIZE);
const NINJA_BODY: NinjaBodyConfig = {
  width: 67,
  height: 74,
  offsetX: 95,
  offsetY: 163
};
const NINJA_SHADOW_WIDTH = Math.round(NINJA_BODY.width * NINJA_SCALE * 1.3);
const NINJA_SHADOW_HEIGHT = Math.round(NINJA_BODY.height * NINJA_SCALE * 0.24);
// Idle and run frames keep transparent padding below the feet.
const NINJA_SHADOW_SOURCE_BOTTOM_PADDING = 72;
const NINJA_SHADOW_Y_OFFSET = -Math.round(
  NINJA_SHADOW_SOURCE_BOTTOM_PADDING * NINJA_SCALE - NINJA_SHADOW_HEIGHT * 0.35
);
const NINJA_SHADOW_COLOR = 0x03050a;
const NINJA_SHADOW_ALPHA = 0.32;

const getMainNinjaTextureKey = (
  action: MainNinjaAction,
  direction: FacingDirection
): string => `character.mainNinja.${direction}.${action}.spritesheet`;

const getMainNinjaIdleAnchorTextureKey = (
  direction: FacingDirection
): string => getMainNinjaTextureKey('idle', direction);

const getBackgroundTextureKey = (backgroundFileName: DebugBackgroundFileName): string =>
  `background.${backgroundFileName}`;

const getBackgroundUrl = (backgroundFileName: DebugBackgroundFileName): string => {
  const backgroundUrl = getDebugBackgroundUrl(backgroundFileName);

  if (backgroundUrl === undefined) {
    throw new Error(`Unknown background: ${backgroundFileName}`);
  }

  return backgroundUrl;
};

const getMainNinjaAnimationKey = (
  action: MainNinjaAction,
  direction: FacingDirection
): string => `anim.mainNinja.${direction}.${action}`;

const getMainNinjaSpriteSheetUrl = (
  action: MainNinjaAction,
  direction: FacingDirection
): string => `${NINJA_ACTOR_ROOT_URL}/main-ninja/${action}-${direction}.png`;

const getEnemyNinjaTextureKey = (
  action: EnemyNinjaAction,
  direction: FacingDirection
): string => `character.enemyNinja.${direction}.${action}.spritesheet`;

const getEnemyNinjaIdleAnchorTextureKey = (
  direction: FacingDirection
): string => getEnemyNinjaTextureKey('idle', direction);

const getEnemyNinjaAnimationKey = (
  action: EnemyNinjaAction,
  direction: FacingDirection
): string => `anim.enemyNinja.${direction}.${action}`;

const getEnemyNinjaSpriteSheetUrl = (
  action: EnemyNinjaAction,
  direction: FacingDirection
): string => `${NINJA_ACTOR_ROOT_URL}/enemy-ninja/${action}-${direction}.png`;

const isPlayerAttackAction = (action: PlayerAction): action is PlayerAttackAction =>
  action === 'slash' || action === 'slash2' || action === 'slash3';

const NINJA_ANIMATIONS: readonly NinjaAnimationConfig<MainNinjaAction>[] = [
  {
    action: 'idle',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'idle',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'jump',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 14 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'jump',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 14 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash2',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 14 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash2',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 14 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash3',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 16 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash3',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 16 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'impact',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 16 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'impact',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 16 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  }
] as const;

const ENEMY_NINJA_ANIMATIONS: readonly NinjaAnimationConfig<EnemyNinjaAction>[] = [
  {
    action: 'idle',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'idle',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'slash',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  }
] as const;

export class SandboxScene extends BaseScene {
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private enemy: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private playerShadow: Phaser.GameObjects.Ellipse | null = null;
  private enemyShadow: Phaser.GameObjects.Ellipse | null = null;
  private moveKeys: MoveKeys | null = null;
  private background: Phaser.GameObjects.Image | null = null;
  private debugOverlayGraphic: Phaser.GameObjects.Graphics | null = null;
  private pauseLabel: Phaser.GameObjects.Text | null = null;
  private activeBackgroundFileName: DebugBackgroundFileName =
    DEFAULT_DEBUG_BACKGROUND_FILE_NAME;
  private backgroundLoadInProgress = false;
  private pendingBackgroundFileName: DebugBackgroundFileName | null = null;
  private lastActorResetRequestId = 0;
  private lastDebugTelemetryAt = Number.NEGATIVE_INFINITY;
  private facingDirection: FacingDirection = 'right';
  private enemyFacingDirection: FacingDirection = 'left';
  private currentAction: PlayerAction = 'idle';
  private enemyAction: EnemyAction = 'idle';
  private enemyRecoveryUntil = 0;
  private enemyAttackDamageDealt = false;
  private attackHitCount = 0;
  private enemyAttackHitCount = 0;
  private forwardVector = new Phaser.Math.Vector2(1, 0);
  private damageKnockbackVector = new Phaser.Math.Vector2(0, 0);
  private attackHitArea = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private enemyAttackHitArea = new Phaser.Geom.Rectangle(0, 0, 0, 0);
  private visualBoundsRect = new Phaser.Geom.Rectangle();

  constructor() {
    super(SceneKeys.Sandbox);
  }

  preload(): void {
    const state = this.debug.get();
    this.queueAssets(state.backgroundFileName);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    const state = this.debug.get();
    this.activeBackgroundFileName = state.backgroundFileName;

    this.createAnimations();
    this.createBackground();
    this.physics.world.setBounds(0, 0, this.profile.width, this.profile.height);

    this.player = this.physics.add.sprite(
      this.centerX,
      this.centerY + 108,
      getMainNinjaIdleAnchorTextureKey('right'),
      NINJA_IDLE_ANCHOR_FRAME
    );
    this.player
      .setOrigin(0.5, 1)
      .setScale(NINJA_SCALE)
      .setCollideWorldBounds(true)
      .setBodySize(NINJA_BODY.width, NINJA_BODY.height, false)
      .setOffset(NINJA_BODY.offsetX, NINJA_BODY.offsetY)
      .setDepth(PLAYER_DEPTH)
      .play(getMainNinjaAnimationKey('idle', 'right'));

    this.playerShadow = this.createActorShadow();

    this.enemy = this.physics.add.sprite(
      this.getDefaultEnemyX(),
      this.centerY + 108,
      getEnemyNinjaIdleAnchorTextureKey('left'),
      NINJA_IDLE_ANCHOR_FRAME
    );
    this.enemy
      .setOrigin(0.5, 1)
      .setScale(NINJA_SCALE)
      .setCollideWorldBounds(true)
      .setBodySize(NINJA_BODY.width, NINJA_BODY.height, false)
      .setOffset(NINJA_BODY.offsetX, NINJA_BODY.offsetY)
      .setDepth(ENEMY_DEPTH)
      .play(getEnemyNinjaAnimationKey('idle', 'left'));

    this.enemyShadow = this.createActorShadow();
    this.syncActorShadows();

    this.physics.add.collider(this.player, this.enemy);

    this.debugOverlayGraphic = this.add.graphics().setDepth(100);
    this.lastActorResetRequestId = this.debug.get().actorResetRequestId;
    this.pauseLabel = this.add
      .text(this.centerX, 58, 'Paused', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '28px',
        fontStyle: '700',
        color: '#f6c961'
      })
      .setOrigin(0.5)
      .setVisible(false);

    this.registerKeyboard();
    this.registerPlayerAnimationEvents();
    this.registerEnemyAnimationEvents();
    this.registerPointerDebug();
    this.onStore(this.debug, (state) => {
      this.applyBackground(state.backgroundFileName);
      this.handleActorResetRequest(state.actorResetRequestId);
      this.pauseLabel?.setVisible(state.paused);
      this.player?.setAlpha(state.paused ? 0.55 : 1);
      this.enemy?.setAlpha(state.paused ? 0.55 : 1);
      this.syncActorShadows();
    });
  }

  update(time: number, _delta: number): void {
    if (this.player === null || this.moveKeys === null) {
      return;
    }

    const movement = this.readMovementInput();

    this.publishMovementInput(movement);

    if (this.debug.get().paused) {
      this.player.setVelocity(0, 0);
      this.enemy?.setVelocity(0, 0);
      this.finishDebugFrame(time);
      return;
    }

    this.updateEnemy(time);

    if (this.currentAction === 'hurt') {
      this.player.setVelocity(
        this.damageKnockbackVector.x * PLAYER_DAMAGE_KNOCKBACK_SPEED,
        this.damageKnockbackVector.y * PLAYER_DAMAGE_KNOCKBACK_SPEED
      );
      this.finishDebugFrame(time);
      return;
    }

    if (isPlayerAttackAction(this.currentAction)) {
      this.player.setVelocity(this.getAttackForwardVelocityX(this.currentAction), 0);
      this.updateAttackHitArea(this.currentAction);
      this.finishDebugFrame(time);
      return;
    }

    if (this.currentAction === 'jump') {
      this.player.setVelocity(0, 0);
      this.finishDebugFrame(time);
      return;
    }

    this.movePlayer(movement);
    this.finishDebugFrame(time);
  }

  private createBackground(): void {
    const { width, height } = this.profile;
    this.background = this.add
      .image(
        width / 2,
        height / 2,
        getBackgroundTextureKey(this.activeBackgroundFileName)
      )
      .setDepth(-10);
    this.fitBackground();
  }

  private fitBackground(): void {
    if (this.background === null) {
      return;
    }

    const { width, height } = this.profile;
    const backgroundFrame = this.background.frame;
    const scale = Math.max(width / backgroundFrame.width, height / backgroundFrame.height);

    this.background.setScale(scale);
  }

  private createActorShadow(): Phaser.GameObjects.Ellipse {
    return this.add
      .ellipse(
        0,
        0,
        NINJA_SHADOW_WIDTH,
        NINJA_SHADOW_HEIGHT,
        NINJA_SHADOW_COLOR,
        NINJA_SHADOW_ALPHA
      )
      .setOrigin(0.5)
      .setDepth(ACTOR_SHADOW_DEPTH);
  }

  private syncActorShadows(): void {
    this.syncActorShadow(this.playerShadow, this.player);
    this.syncActorShadow(this.enemyShadow, this.enemy);
  }

  private syncActorShadow(
    shadow: Phaser.GameObjects.Ellipse | null,
    actor: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null
  ): void {
    if (shadow === null || actor === null) {
      return;
    }

    shadow
      .setPosition(actor.x, actor.y + NINJA_SHADOW_Y_OFFSET)
      .setAlpha(actor.alpha)
      .setVisible(actor.visible);
  }

  private queueAssets(backgroundFileName: DebugBackgroundFileName): boolean {
    let queued = false;
    const backgroundTextureKey = getBackgroundTextureKey(backgroundFileName);

    if (!this.textures.exists(backgroundTextureKey)) {
      this.load.image(backgroundTextureKey, getBackgroundUrl(backgroundFileName));
      queued = true;
    }

    for (const animation of NINJA_ANIMATIONS) {
      const textureKey = getMainNinjaTextureKey(animation.action, animation.direction);

      if (this.textures.exists(textureKey)) {
        continue;
      }

      this.load.spritesheet(
        textureKey,
        getMainNinjaSpriteSheetUrl(animation.action, animation.direction),
        {
          frameWidth: NINJA_FRAME_SIZE,
          frameHeight: NINJA_FRAME_SIZE,
          margin: 0,
          spacing: 0,
          startFrame: 0,
          endFrame: Math.min(animation.frameCount, NINJA_FRAME_COUNT) - 1
        }
      );
      queued = true;
    }

    for (const animation of ENEMY_NINJA_ANIMATIONS) {
      const textureKey = getEnemyNinjaTextureKey(animation.action, animation.direction);

      if (this.textures.exists(textureKey)) {
        continue;
      }

      this.load.spritesheet(
        textureKey,
        getEnemyNinjaSpriteSheetUrl(animation.action, animation.direction),
        {
          frameWidth: NINJA_FRAME_SIZE,
          frameHeight: NINJA_FRAME_SIZE,
          margin: 0,
          spacing: 0,
          startFrame: 0,
          endFrame: Math.min(animation.frameCount, NINJA_FRAME_COUNT) - 1
        }
      );
      queued = true;
    }

    return queued;
  }

  private createAnimations(): void {
    for (const animation of NINJA_ANIMATIONS) {
      const animationKey = getMainNinjaAnimationKey(animation.action, animation.direction);

      if (this.anims.exists(animationKey)) {
        continue;
      }

      this.anims.create({
        key: animationKey,
        frames: this.anims.generateFrameNumbers(
          getMainNinjaTextureKey(animation.action, animation.direction),
          {
            start: 0,
            end: Math.min(animation.frameCount, NINJA_FRAME_COUNT) - 1
          }
        ),
        frameRate: animation.frameRate,
        repeat: animation.repeat
      });
    }

    for (const animation of ENEMY_NINJA_ANIMATIONS) {
      const animationKey = getEnemyNinjaAnimationKey(animation.action, animation.direction);

      if (this.anims.exists(animationKey)) {
        continue;
      }

      this.anims.create({
        key: animationKey,
        frames: this.anims.generateFrameNumbers(
          getEnemyNinjaTextureKey(animation.action, animation.direction),
          {
            start: 0,
            end: Math.min(animation.frameCount, NINJA_FRAME_COUNT) - 1
          }
        ),
        frameRate: animation.frameRate,
        repeat: animation.repeat
      });
    }
  }

  private isBackgroundLoaded(backgroundFileName: DebugBackgroundFileName): boolean {
    return this.textures.exists(getBackgroundTextureKey(backgroundFileName));
  }

  private applyBackground(backgroundFileName: DebugBackgroundFileName): void {
    if (this.activeBackgroundFileName === backgroundFileName) {
      return;
    }

    if (!this.isBackgroundLoaded(backgroundFileName)) {
      this.loadBackground(backgroundFileName);
      return;
    }

    this.activateBackground(backgroundFileName);
  }

  private loadBackground(backgroundFileName: DebugBackgroundFileName): void {
    if (this.backgroundLoadInProgress) {
      this.pendingBackgroundFileName = backgroundFileName;
      return;
    }

    const backgroundTextureKey = getBackgroundTextureKey(backgroundFileName);
    if (this.textures.exists(backgroundTextureKey)) {
      this.activateBackground(backgroundFileName);
      return;
    }

    this.backgroundLoadInProgress = true;
    this.load.image(backgroundTextureKey, getBackgroundUrl(backgroundFileName));
    this.load.once('complete', () => {
      this.backgroundLoadInProgress = false;
      const state = this.debug.get();

      if (state.backgroundFileName === backgroundFileName) {
        this.activateBackground(backgroundFileName);
      }

      const pendingBackgroundFileName = this.pendingBackgroundFileName;
      this.pendingBackgroundFileName = null;

      if (
        pendingBackgroundFileName !== null &&
        pendingBackgroundFileName !== this.activeBackgroundFileName
      ) {
        this.applyBackground(pendingBackgroundFileName);
      }
    });
    this.load.start();
  }

  private activateBackground(backgroundFileName: DebugBackgroundFileName): void {
    this.activeBackgroundFileName = backgroundFileName;
    this.background?.setTexture(getBackgroundTextureKey(backgroundFileName));
    this.fitBackground();
  }

  private registerKeyboard(): void {
    const keyboard = this.input.keyboard;

    if (keyboard === null) {
      return;
    }

    this.moveKeys = {
      w: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
      a: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
      s: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
      d: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      up: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.UP),
      down: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.DOWN),
      left: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      right: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      z: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      shift: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT),
      ctrl: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.CTRL),
      space: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE),
      esc: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC)
    };

    const syncLastKey = (event: KeyboardEvent): void => {
      this.debug.setInput({ lastKey: event.code });
    };

    const escKey = this.moveKeys.esc;
    const goBackToMenu = (): void => {
      this.goTo(SceneKeys.MainMenu);
    };
    const startAttack = (): void => {
      this.startAttack(this.resolveAttackAction());
    };
    const startJump = (): void => {
      this.startJump();
    };

    keyboard.on('keydown', syncLastKey);
    escKey.on('down', goBackToMenu);
    this.moveKeys.z.on('down', startAttack);
    this.moveKeys.space.on('down', startJump);

    this.trackCleanup(() => {
      keyboard.off('keydown', syncLastKey);
      escKey.off('down', goBackToMenu);
      this.moveKeys?.z.off('down', startAttack);
      this.moveKeys?.space.off('down', startJump);
    });
  }

  private registerPlayerAnimationEvents(): void {
    if (this.player === null) {
      return;
    }

    const completeAttack = (animation: Phaser.Animations.Animation): void => {
      if (animation.key.endsWith('.impact') && this.currentAction === 'hurt') {
        this.finishPlayerDamage();
        return;
      }

      if (animation.key.endsWith('.jump') && this.currentAction === 'jump') {
        this.finishPlayerAction();
        return;
      }

      if (
        isPlayerAttackAction(this.currentAction) &&
        (animation.key.endsWith('.slash') ||
          animation.key.endsWith('.slash2') ||
          animation.key.endsWith('.slash3'))
      ) {
        this.finishPlayerAction();
      }
    };

    this.player.on('animationcomplete', completeAttack);
    this.trackCleanup(() => {
      this.player?.off('animationcomplete', completeAttack);
    });
  }

  private registerEnemyAnimationEvents(): void {
    if (this.enemy === null) {
      return;
    }

    const completeAttack = (animation: Phaser.Animations.Animation): void => {
      if (animation.key.endsWith('.slash') && this.enemyAction === 'slash') {
        this.startEnemyRecovery();
      }
    };

    this.enemy.on('animationcomplete', completeAttack);
    this.trackCleanup(() => {
      this.enemy?.off('animationcomplete', completeAttack);
    });
  }

  private readMovementInput(): MovementInput {
    if (this.moveKeys === null) {
      return {
        left: false,
        right: false,
        up: false,
        down: false,
        x: 0,
        y: 0
      };
    }

    const left = this.moveKeys.a.isDown || this.moveKeys.left.isDown;
    const right = this.moveKeys.d.isDown || this.moveKeys.right.isDown;
    const up = this.moveKeys.w.isDown || this.moveKeys.up.isDown;
    const down = this.moveKeys.s.isDown || this.moveKeys.down.isDown;

    return {
      left,
      right,
      up,
      down,
      x: Number(right) - Number(left),
      y: Number(down) - Number(up)
    };
  }

  private publishMovementInput(movement: MovementInput): void {
    const input = this.debug.get().input;

    if (
      input.left === movement.left &&
      input.right === movement.right &&
      input.up === movement.up &&
      input.down === movement.down
    ) {
      return;
    }

    this.debug.setInput({
      left: movement.left,
      right: movement.right,
      up: movement.up,
      down: movement.down
    });
  }

  private movePlayer(movement: MovementInput): void {
    if (this.player === null) {
      return;
    }

    if (movement.x === 0 && movement.y === 0) {
      this.player.setVelocity(0, 0);
      this.playNinjaAnimation('idle');
      return;
    }

    const direction = new Phaser.Math.Vector2(movement.x, movement.y).normalize();

    this.forwardVector.copy(direction);
    this.updateFacingFromVector(direction);
    this.player.setVelocity(direction.x * NINJA_SPEED, direction.y * NINJA_SPEED);
    this.playNinjaAnimation('run');
  }

  private resolveAttackAction(): PlayerAttackAction {
    if (this.moveKeys?.ctrl.isDown === true) {
      return 'slash3';
    }

    if (this.moveKeys?.shift.isDown === true) {
      return 'slash2';
    }

    return 'slash';
  }

  private isPlayerBusy(): boolean {
    return (
      this.currentAction === 'jump' ||
      this.currentAction === 'hurt' ||
      isPlayerAttackAction(this.currentAction)
    );
  }

  private updateForwardVectorFromInput(): void {
    const movement = this.readMovementInput();

    if (movement.x === 0 && movement.y === 0) {
      return;
    }

    this.forwardVector.set(movement.x, movement.y).normalize();
    this.updateFacingFromVector(this.forwardVector);
  }

  private startAttack(action: PlayerAttackAction): void {
    if (this.player === null || this.isPlayerBusy()) {
      return;
    }

    this.updateForwardVectorFromInput();
    this.currentAction = action;
    this.clearAttackHitArea();
    this.player.setVelocity(this.getAttackForwardVelocityX(action), 0);
    this.playNinjaAnimation(action, true);
  }

  private getAttackForwardVelocityX(action: PlayerAttackAction): number {
    if (action !== 'slash3') {
      return 0;
    }

    return this.facingDirection === 'left' ? -ATTACK3_FORWARD_SPEED : ATTACK3_FORWARD_SPEED;
  }

  private startJump(): void {
    if (this.player === null || this.isPlayerBusy()) {
      return;
    }

    this.updateForwardVectorFromInput();
    this.currentAction = 'jump';
    this.clearAttackHitArea();
    this.player.setVelocity(0, 0);
    this.playNinjaAnimation('jump', true);
  }

  private finishPlayerAction(): void {
    if (this.player === null) {
      return;
    }

    this.currentAction = 'idle';
    this.player.setVelocity(0, 0);
    this.clearAttackHitArea();
    this.movePlayer(this.readMovementInput());
  }

  private finishPlayerDamage(): void {
    if (this.player === null) {
      return;
    }

    this.currentAction = 'idle';
    this.damageKnockbackVector.set(0, 0);
    this.player.setVelocity(0, 0);
    this.movePlayer(this.readMovementInput());
  }

  private updateEnemy(time: number): void {
    if (this.player === null || this.enemy === null) {
      return;
    }

    if (this.enemyAction === 'slash') {
      this.enemy.setVelocity(0, 0);
      this.updateEnemyAttackDamage();
      return;
    }

    if (this.enemyAction === 'recover') {
      this.enemy.setVelocity(0, 0);
      this.playEnemyAnimation('idle');

      if (time >= this.enemyRecoveryUntil) {
        this.enemyAction = 'idle';
      } else {
        return;
      }
    }

    if (!this.debug.get().enemyChaseEnabled) {
      this.enemy.setVelocity(0, 0);
      this.playEnemyAnimation('idle');
      return;
    }

    const toPlayer = new Phaser.Math.Vector2(
      this.player.x - this.enemy.x,
      this.player.y - this.enemy.y
    );
    const distanceToPlayer = toPlayer.length();

    if (distanceToPlayer <= ENEMY_ATTACK_RANGE) {
      this.startEnemyAttack();
      return;
    }

    if (distanceToPlayer === 0) {
      this.enemy.setVelocity(0, 0);
      this.playEnemyAnimation('idle');
      return;
    }

    toPlayer.normalize();
    this.updateEnemyFacingFromVector(toPlayer);
    this.enemy.setVelocity(toPlayer.x * ENEMY_NINJA_SPEED, toPlayer.y * ENEMY_NINJA_SPEED);
    this.playEnemyAnimation('run');
  }

  private startEnemyAttack(): void {
    if (this.player === null || this.enemy === null || this.enemyAction === 'slash') {
      return;
    }

    this.enemyAction = 'slash';
    this.enemyAttackDamageDealt = false;
    this.clearEnemyAttackHitArea();
    this.enemy.setVelocity(0, 0);
    this.updateEnemyFacingFromVector(
      new Phaser.Math.Vector2(this.player.x - this.enemy.x, this.player.y - this.enemy.y)
    );
    this.playEnemyAnimation('slash', true);
  }

  private startEnemyRecovery(): void {
    if (this.enemy === null) {
      return;
    }

    this.enemyAction = 'recover';
    this.enemyRecoveryUntil = this.time.now + ENEMY_ATTACK_RECOVERY_MS;
    this.enemyAttackDamageDealt = false;
    this.clearEnemyAttackHitArea();
    this.enemy.setVelocity(0, 0);
    this.playEnemyAnimation('idle', true);
  }

  private updateEnemyAttackDamage(): void {
    if (!this.isEnemyAttackReachFrame()) {
      this.clearEnemyAttackHitArea();
      return;
    }

    this.updateEnemyAttackHitArea();

    if (this.enemyAttackDamageDealt || this.enemyAttackHitCount === 0) {
      return;
    }

    this.enemyAttackDamageDealt = true;
    this.damagePlayerFromEnemy();
  }

  private damagePlayerFromEnemy(): void {
    if (this.player === null || this.enemy === null) {
      return;
    }

    const knockbackDirection = new Phaser.Math.Vector2(
      this.player.x - this.enemy.x,
      this.player.y - this.enemy.y
    );

    if (knockbackDirection.lengthSq() === 0) {
      knockbackDirection.set(this.enemyFacingDirection === 'left' ? -1 : 1, 0);
    }

    knockbackDirection.normalize();
    this.damageKnockbackVector.copy(knockbackDirection);
    this.currentAction = 'hurt';
    this.clearAttackHitArea();

    const towardEnemy = new Phaser.Math.Vector2(
      this.enemy.x - this.player.x,
      this.enemy.y - this.player.y
    );
    this.updateFacingFromVector(towardEnemy);
    this.player.setVelocity(
      knockbackDirection.x * PLAYER_DAMAGE_KNOCKBACK_SPEED,
      knockbackDirection.y * PLAYER_DAMAGE_KNOCKBACK_SPEED
    );
    this.player.play(
      getMainNinjaAnimationKey('impact', this.facingDirection),
      false
    );
  }

  private updateFacingFromVector(vector: Phaser.Math.Vector2): void {
    if (vector.x < 0) {
      this.facingDirection = 'left';
      return;
    }

    if (vector.x > 0) {
      this.facingDirection = 'right';
    }
  }

  private playNinjaAnimation(action: ControlledMainNinjaAction, restart = false): void {
    if (this.player === null) {
      return;
    }

    const animationKey = getMainNinjaAnimationKey(action, this.facingDirection);

    if (!restart && this.player.anims.currentAnim?.key === animationKey) {
      return;
    }

    this.currentAction = action;
    this.player.play(animationKey, !restart);
  }

  private updateEnemyFacingFromVector(vector: Phaser.Math.Vector2): void {
    if (vector.x < 0) {
      this.enemyFacingDirection = 'left';
      return;
    }

    if (vector.x > 0) {
      this.enemyFacingDirection = 'right';
    }
  }

  private playEnemyAnimation(action: EnemyNinjaAction, restart = false): void {
    if (this.enemy === null) {
      return;
    }

    const animationKey = getEnemyNinjaAnimationKey(action, this.enemyFacingDirection);

    if (!restart && this.enemy.anims.currentAnim?.key === animationKey) {
      return;
    }

    if (action !== 'idle' || this.enemyAction !== 'recover') {
      this.enemyAction = action;
    }

    this.enemy.play(animationKey, !restart);
  }

  private updateAttackHitArea(action: PlayerAttackAction): void {
    if (this.player === null) {
      return;
    }

    if (!this.isPlayerAttackReachFrame()) {
      this.clearAttackHitArea();
      return;
    }

    this.setAttackHitArea(
      this.attackHitArea,
      this.player,
      this.facingDirection,
      PLAYER_ATTACK_HIT_BOXES[action]
    );
    this.attackHitCount = this.getHitCountInArea(this.attackHitArea, this.player);
  }

  private updateEnemyAttackHitArea(): void {
    if (this.enemy === null) {
      return;
    }

    this.setAttackHitArea(
      this.enemyAttackHitArea,
      this.enemy,
      this.enemyFacingDirection,
      ENEMY_ATTACK_HIT_BOX
    );
    this.enemyAttackHitCount = this.getHitCountInArea(this.enemyAttackHitArea, this.enemy);
  }

  private setAttackHitArea(
    hitArea: Phaser.Geom.Rectangle,
    actor: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    facingDirection: FacingDirection,
    config: AttackHitBoxConfig
  ): void {
    const direction = facingDirection === 'left' ? -1 : 1;
    const x =
      direction > 0
        ? actor.x + config.frontOffset
        : actor.x - config.frontOffset - config.width;
    const y = actor.y + config.yOffset - config.height / 2;

    hitArea.setTo(x, y, config.width, config.height);
  }

  private getHitCountInArea(
    hitArea: Phaser.Geom.Rectangle,
    owner: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
  ): number {
    const bodies: readonly (Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody)[] =
      this.physics.overlapRect(hitArea.x, hitArea.y, hitArea.width, hitArea.height);

    return bodies.filter((body) => body.gameObject !== owner).length;
  }

  private clearAttackHitArea(): void {
    this.attackHitCount = 0;
    this.attackHitArea.setTo(0, 0, 0, 0);
    this.renderDebugOverlays();
  }

  private clearEnemyAttackHitArea(): void {
    this.enemyAttackHitCount = 0;
    this.enemyAttackHitArea.setTo(0, 0, 0, 0);
  }

  private getAnimationFrameIndex(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null
  ): number {
    return sprite?.anims.currentFrame?.index ?? 0;
  }

  private isPlayerAttackReachFrame(): boolean {
    return (
      isPlayerAttackAction(this.currentAction) &&
      MAIN_NINJA_ATTACK_REACH_FRAMES.some(
        (frameIndex) => frameIndex === this.getAnimationFrameIndex(this.player)
      )
    );
  }

  private isEnemyAttackReachFrame(): boolean {
    return (
      this.enemyAction === 'slash' &&
      ENEMY_NINJA_ATTACK_REACH_FRAMES.some(
        (frameIndex) => frameIndex === this.getAnimationFrameIndex(this.enemy)
      )
    );
  }

  private registerPointerDebug(): void {
    const syncPointer = (pointer: Phaser.Input.Pointer): void => {
      const worldPoint = this.cameras.main.getWorldPoint(pointer.x, pointer.y);

      this.debug.setPointer({
        x: Math.round(pointer.x),
        y: Math.round(pointer.y),
        worldX: Math.round(worldPoint.x),
        worldY: Math.round(worldPoint.y),
        down: pointer.isDown
      });
    };

    this.input.on('pointermove', syncPointer);
    this.input.on('pointerdown', syncPointer);
    this.input.on('pointerup', syncPointer);

    this.trackCleanup(() => {
      this.input.off('pointermove', syncPointer);
      this.input.off('pointerdown', syncPointer);
      this.input.off('pointerup', syncPointer);
    });
  }

  private getDefaultEnemyX(): number {
    return Phaser.Math.Clamp(this.centerX + 320, 120, this.profile.width - 120);
  }

  private handleActorResetRequest(actorResetRequestId: number): void {
    if (actorResetRequestId === this.lastActorResetRequestId) {
      return;
    }

    this.lastActorResetRequestId = actorResetRequestId;
    this.resetActors();
  }

  private resetActors(): void {
    if (this.player === null || this.enemy === null) {
      return;
    }

    this.facingDirection = 'right';
    this.enemyFacingDirection = 'left';
    this.forwardVector.set(1, 0);
    this.damageKnockbackVector.set(0, 0);
    this.currentAction = 'idle';
    this.enemyAction = 'idle';
    this.enemyRecoveryUntil = 0;
    this.enemyAttackDamageDealt = false;
    this.clearAttackHitArea();
    this.clearEnemyAttackHitArea();

    this.player
      .setPosition(this.centerX, this.centerY + 108)
      .setVelocity(0, 0)
      .play(getMainNinjaAnimationKey('idle', 'right'), false);

    this.enemy
      .setPosition(this.getDefaultEnemyX(), this.centerY + 108)
      .setVelocity(0, 0)
      .play(getEnemyNinjaAnimationKey('idle', 'left'), false);

    this.finishDebugFrame(this.time.now, true);
  }

  private finishDebugFrame(time: number, forceTelemetry = false): void {
    this.syncActorShadows();
    this.publishDebugTelemetry(time, forceTelemetry);
    this.renderDebugOverlays();
  }

  private publishDebugTelemetry(time: number, force = false): void {
    if (!force && time - this.lastDebugTelemetryAt < 100) {
      return;
    }

    this.lastDebugTelemetryAt = time;
    const attackActive = this.isPlayerAttackReachFrame();

    this.debug.update((state) => ({
      ...state,
      player: this.createActorDebugState(this.player, this.currentAction),
      enemy: this.createActorDebugState(this.enemy, this.enemyAction),
      attack: {
        active: attackActive,
        action: attackActive ? this.currentAction : 'none',
        x: attackActive
          ? Math.round(this.attackHitArea.x + this.attackHitArea.width / 2)
          : 0,
        y: attackActive
          ? Math.round(this.attackHitArea.y + this.attackHitArea.height / 2)
          : 0,
        width: attackActive ? Math.round(this.attackHitArea.width) : 0,
        height: attackActive ? Math.round(this.attackHitArea.height) : 0,
        hitCount: attackActive ? this.attackHitCount : 0
      },
      performance: {
        fps: this.game.loop.actualFps,
        physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
      }
    }));
  }

  private createActorDebugState(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    action: string
  ) {
    if (sprite === null) {
      return {
        action: 'none',
        animation: 'none',
        frame: 0,
        x: 0,
        y: 0,
        velocityX: 0,
        velocityY: 0,
        bodyX: 0,
        bodyY: 0,
        bodyWidth: 0,
        bodyHeight: 0
      };
    }

    const body = sprite.body;

    return {
      action,
      animation: sprite.anims.currentAnim?.key ?? 'none',
      frame: sprite.anims.currentFrame?.index ?? 0,
      x: Math.round(sprite.x),
      y: Math.round(sprite.y),
      velocityX: Math.round(body.velocity.x),
      velocityY: Math.round(body.velocity.y),
      bodyX: Math.round(body.x),
      bodyY: Math.round(body.y),
      bodyWidth: Math.round(body.width),
      bodyHeight: Math.round(body.height)
    };
  }

  private renderDebugOverlays(): void {
    const graphic = this.debugOverlayGraphic;

    if (graphic === null) {
      return;
    }

    const state = this.debug.get();
    graphic.clear();

    if (state.showWorldBounds) {
      graphic.lineStyle(4, 0xf6c961, 0.95);
      graphic.strokeRect(2, 2, this.profile.width - 4, this.profile.height - 4);
    }

    if (state.showEnemyRanges && this.enemy !== null) {
      graphic.lineStyle(2, 0xff8a65, 0.64);
      graphic.strokeCircle(this.enemy.x, this.enemy.y, ENEMY_ATTACK_RANGE);
    }

    if (state.showVisualBounds) {
      this.renderVisualBounds(this.player, 0x8fffad);
      this.renderVisualBounds(this.enemy, 0xff91d0);
    }

    if (state.showHitBoxes) {
      this.renderPhysicsBody(this.player, 0x35d08f);
      this.renderPhysicsBody(this.enemy, 0xe56b6f);
    }

    if (state.showAttackBoxes) {
      if (this.isPlayerAttackReachFrame()) {
        this.renderAttackHitBox(this.attackHitArea, this.attackHitCount, 0x7ed7ff, 0xffc857);
      }

      if (this.isEnemyAttackReachFrame()) {
        this.renderAttackHitBox(
          this.enemyAttackHitArea,
          this.enemyAttackHitCount,
          0xff91d0,
          0xffc857
        );
      }
    }

    if (state.showOrigins) {
      this.renderOrigin(this.player, 0x8fffad);
      this.renderOrigin(this.enemy, 0xff91d0);
    }

    if (state.showPointerProbe) {
      this.renderCrosshair(state.pointer.worldX, state.pointer.worldY, 12, 0xffffff, 0.85);
    }
  }

  private renderVisualBounds(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    color: number
  ): void {
    if (sprite === null || this.debugOverlayGraphic === null) {
      return;
    }

    const bounds = sprite.getBounds(this.visualBoundsRect);
    this.debugOverlayGraphic.lineStyle(2, color, 0.78);
    this.debugOverlayGraphic.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  private renderAttackHitBox(
    hitArea: Phaser.Geom.Rectangle,
    hitCount: number,
    idleColor: number,
    hitColor: number
  ): void {
    if (this.debugOverlayGraphic === null || hitArea.width <= 0 || hitArea.height <= 0) {
      return;
    }

    const color = hitCount > 0 ? hitColor : idleColor;
    this.debugOverlayGraphic.fillStyle(color, 0.14);
    this.debugOverlayGraphic.lineStyle(3, color, 0.78);
    this.debugOverlayGraphic.fillRectShape(hitArea);
    this.debugOverlayGraphic.strokeRectShape(hitArea);
  }

  private renderPhysicsBody(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    color: number
  ): void {
    if (sprite === null || this.debugOverlayGraphic === null) {
      return;
    }

    const body = sprite.body;
    this.debugOverlayGraphic.lineStyle(2, color, 0.92);
    this.debugOverlayGraphic.strokeRect(body.x, body.y, body.width, body.height);
  }

  private renderOrigin(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    color: number
  ): void {
    if (sprite === null) {
      return;
    }

    this.renderCrosshair(sprite.x, sprite.y, 10, color, 0.95);
  }

  private renderCrosshair(
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number
  ): void {
    if (this.debugOverlayGraphic === null) {
      return;
    }

    this.debugOverlayGraphic.lineStyle(2, color, alpha);
    this.debugOverlayGraphic.lineBetween(x - size, y, x + size, y);
    this.debugOverlayGraphic.lineBetween(x, y - size, x, y + size);
    this.debugOverlayGraphic.strokeCircle(x, y, 3);
  }
}
