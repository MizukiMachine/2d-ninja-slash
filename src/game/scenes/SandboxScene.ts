import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import {
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
  getDebugBackgroundUrl,
  type DebugBackgroundFileName
} from '../assets/ninjaAssetCatalog';
import {
  getNinjaAnimationBounds,
  getNinjaAnimationPlaybackRate,
  isNinjaHitFrameActive,
  NINJA_FRAME_SIZE,
  type NinjaRect
} from '../ninjaBounds';
import {
  applyAttackDamage,
  canPlayerReceiveEnemyAttack,
  ENEMY_MAX_HEALTH,
  getHealthBand,
  getHealthRatio,
  PLAYER_MAX_HEALTH
} from '../combatHealth';
import {
  getEnemyMovementSpeed,
  getRoundEnemyCount,
  normalizeGameplayTuning,
  normalizeSandboxLaneSettings
} from '../debugFeatures';
import { getAnimationFallbackDelayMs } from '../animationTiming';
import {
  PLAYER_LANE_DOUBLE_TAP_SECONDS,
  PLAYER_LANE_JUMP_ARC_HEIGHT,
  PLAYER_LANE_TRANSITION_SECONDS,
  PlayerLaneMovementController,
  createThreeLaneLayoutFromYSettings,
  getThreeLaneEdgeSpawnPlacement,
  type LaneTapDirection,
  type PlayerLaneId,
  type ThreeLaneLayout,
  type ThreeLaneYSettings
} from '../playerLaneMovement';
import {
  getNinjaLanePointFromSprite,
  getNinjaLaneXFromSprite,
  getNinjaLaneYFromSprite,
  getNinjaSpritePositionForLane
} from '../ninjaLanePresentation';
import {
  getEnemyApproachDirection,
  getEnemyChaseMovementSpeed,
  getEnemyFacingDirectionFromPatrol,
  getEnemyPatrolMovementSpeed,
  resolveEnemyPatrolState,
  type EnemyPatrolDirection
} from '../enemyBehavior';
import { GAME_OVER_BGM_TRACK_ID } from '../assets/audioAssetCatalog';

type FacingDirection = 'left' | 'right';
type MainNinjaAction = 'idle' | 'run' | 'jump' | 'slash' | 'impact' | 'death';
type ControlledMainNinjaAction = Exclude<MainNinjaAction, 'impact' | 'death'>;
type PlayerAttackAction = 'slash';
type PlayerAction = ControlledMainNinjaAction | 'hurt' | 'dead';
type EnemyNinjaAction = 'idle' | 'walk' | 'run' | 'jump' | 'slash' | 'death';
type EnemyAction = Exclude<EnemyNinjaAction, 'death'> | 'recover' | 'dead';
type RoundPhase = 'fighting' | 'cleared';

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
}

interface EnemyState {
  readonly sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
  readonly laneMovement: PlayerLaneMovementController;
  facingDirection: FacingDirection;
  action: EnemyAction;
  health: number;
  roundActive: boolean;
  defeated: boolean;
  patrolDirection: EnemyPatrolDirection;
  nextPatrolDecisionAt: number;
  recoveryUntil: number;
  attackDamageDealt: boolean;
  attackHitCount: number;
  readonly attackHitArea: Phaser.Geom.Rectangle;
  readonly attackProbeArea: Phaser.Geom.Rectangle;
  corpseTimer: Phaser.Time.TimerEvent | null;
  corpseTween: Phaser.Tweens.Tween | null;
}

interface EnemySpawnPoint {
  readonly x: number;
  readonly y: number;
  readonly laneId: PlayerLaneId;
}

const NINJA_ACTOR_ROOT_URL = '/assets/actors';
const NINJA_FRAME_COUNT = 32;
const NINJA_IDLE_ANCHOR_FRAME = 0;
const NINJA_ANIMATION_PLAYBACK_RATE = 3;
const NINJA_SPRITE_SCALE = 2.1;
const PLAYER_DEPTH = 10;
const ENEMY_DEPTH = 9;
const HUD_DEPTH = 120;
const GAME_OVER_DEPTH = 240;
const PLAYER_HEALTH_BAR_X = 24;
const PLAYER_HEALTH_BAR_Y = 24;
const PLAYER_HEALTH_BAR_WIDTH = 336;
const PLAYER_HEALTH_BAR_HEIGHT = 30;
const PROGRESSION_HUD_X_OFFSET = 24;
const PROGRESSION_HUD_Y = 24;
const ROUND_BANNER_Y = 72;
const PLAYER_DEATH_OVERLAY_FALLBACK_BUFFER_MS = 250;
const PLAYER_DEATH_OVERLAY_RECHECK_MS = 120;
const ENEMY_CORPSE_HOLD_MS = 1300;
const ENEMY_CORPSE_BLINK_DURATION_MS = 90;
const ENEMY_CORPSE_BLINK_REPEAT = 8;
const PLAYER_DAMAGE_KNOCKBACK_DISTANCE = 160;
const ENEMY_ATTACK_REQUIRED_OVERLAP_X = 24;
const ENEMY_ATTACK_REQUIRED_OVERLAP_Y = 9;
const ENEMY_LANE_EDGE_SPAWN_INSET = 150;
const ENEMY_LANE_EDGE_SPAWN_COLUMN_SPACING = 44;
const ENEMY_FRONT_DETECTION_DISTANCE = 320;
const ENEMY_PATROL_WORLD_PADDING = 90;
const ENEMY_PATROL_MIN_DECISION_MS = 850;
const ENEMY_PATROL_MAX_DECISION_MS = 2200;

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
  action === 'slash';

const formatElapsedTime = (elapsedMs: number): string => {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
};

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
  },
  {
    action: 'death',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 10 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'death',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 10 * NINJA_ANIMATION_PLAYBACK_RATE,
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
    action: 'walk',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 10 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'walk',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 10 * NINJA_ANIMATION_PLAYBACK_RATE,
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
    action: 'death',
    direction: 'left',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 10 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'death',
    direction: 'right',
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 10 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  }
] as const;

export class SandboxScene extends BaseScene {
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private enemies: EnemyState[] = [];
  private moveKeys: MoveKeys | null = null;
  private playerLaneMovement: PlayerLaneMovementController | null = null;
  private background: Phaser.GameObjects.Image | null = null;
  private debugOverlayGraphic: Phaser.GameObjects.Graphics | null = null;
  private healthGraphic: Phaser.GameObjects.Graphics | null = null;
  private playerHealthLabel: Phaser.GameObjects.Text | null = null;
  private progressionLabel: Phaser.GameObjects.Text | null = null;
  private roundBannerLabel: Phaser.GameObjects.Text | null = null;
  private pauseLabel: Phaser.GameObjects.Text | null = null;
  private gameOverOverlay: Phaser.GameObjects.Container | null = null;
  private playerDeathOverlayTimer: Phaser.Time.TimerEvent | null = null;
  private activeBackgroundFileName: DebugBackgroundFileName =
    DEFAULT_DEBUG_BACKGROUND_FILE_NAME;
  private backgroundLoadInProgress = false;
  private pendingBackgroundFileName: DebugBackgroundFileName | null = null;
  private lastActorResetRequestId = 0;
  private lastDebugTelemetryAt = Number.NEGATIVE_INFINITY;
  private activeLaneSettingsSignature = '';
  private facingDirection: FacingDirection = 'right';
  private currentAction: PlayerAction = 'idle';
  private playerHealth = PLAYER_MAX_HEALTH;
  private damagedEnemiesThisAttack = new Set<EnemyState>();
  private gameOver = false;
  private roundPhase: RoundPhase = 'fighting';
  private currentRound = 1;
  private currentRoundEnemyCount = 0;
  private defeatedThisRound = 0;
  private totalDefeatedCount = 0;
  private elapsedMs = 0;
  private roundTransitionRemainingMs = 0;
  private attackHitCount = 0;
  private forwardVector = new Phaser.Math.Vector2(1, 0);
  private damageKnockbackVector = new Phaser.Math.Vector2(0, 0);
  private damageKnockbackOrigin = new Phaser.Math.Vector2(0, 0);
  private attackHitArea = new Phaser.Geom.Rectangle(0, 0, 0, 0);
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
    this.resetSceneState();

    this.createAnimations();
    this.createBackground();
    this.physics.world.setBounds(0, 0, this.profile.width, this.profile.height);
    this.playerLaneMovement = this.createLaneMovementController('middle');

    this.player = this.physics.add.sprite(
      this.centerX,
      this.playerLaneMovement.currentY,
      getMainNinjaIdleAnchorTextureKey('right'),
      NINJA_IDLE_ANCHOR_FRAME
    );
    this.player
      .setOrigin(0.5, 1)
      .setScale(NINJA_SPRITE_SCALE)
      .setCollideWorldBounds(true)
      .setDepth(PLAYER_DEPTH);
    this.applyActorPlaybackRate(this.player, 'mainNinja', 'idle');
    this.player.play(getMainNinjaAnimationKey('idle', 'right'));
    this.applyActorCollisionBounds(this.player, 'mainNinja', this.facingDirection, 'idle');
    this.setPlayerPositionForLane(this.centerX, this.playerLaneMovement.currentY, 'idle');

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
    this.createHealthHud();
    this.startRound(1);

    this.registerKeyboard();
    this.registerPlayerAnimationEvents();
    this.registerPointerDebug();
    this.onStore(this.debug, (state) => {
      this.applyBackground(state.backgroundFileName);
      this.applyLaneSettings(state.sandboxLaneSettings);
      this.handleActorResetRequest(state.actorResetRequestId);
      this.pauseLabel?.setVisible(state.paused);
      this.player?.setAlpha(state.paused && this.currentAction !== 'dead' ? 0.55 : 1);
      for (const enemyState of this.enemies) {
        if (enemyState.action !== 'dead') {
          enemyState.sprite.setAlpha(state.paused ? 0.55 : 1);
        }
      }
    });
  }

  private createEnemyState(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    facingDirection: FacingDirection
  ): EnemyState {
    return {
      sprite,
      laneMovement: this.createLaneMovementController('middle'),
      facingDirection,
      action: 'idle',
      health: ENEMY_MAX_HEALTH,
      roundActive: false,
      defeated: false,
      patrolDirection: facingDirection === 'left' ? -1 : 1,
      nextPatrolDecisionAt: 0,
      recoveryUntil: 0,
      attackDamageDealt: false,
      attackHitCount: 0,
      attackHitArea: new Phaser.Geom.Rectangle(0, 0, 0, 0),
      attackProbeArea: new Phaser.Geom.Rectangle(0, 0, 0, 0),
      corpseTimer: null,
      corpseTween: null
    };
  }

  private createLaneMovementController(
    initialLaneId: PlayerLaneId = 'middle'
  ): PlayerLaneMovementController {
    return new PlayerLaneMovementController({
      layout: this.getLaneLayout(),
      initialLaneId,
      doubleTapSeconds: PLAYER_LANE_DOUBLE_TAP_SECONDS,
      transitionSeconds: PLAYER_LANE_TRANSITION_SECONDS,
      jumpArcHeight: PLAYER_LANE_JUMP_ARC_HEIGHT
    });
  }

  private getLaneSettings(): ThreeLaneYSettings {
    return normalizeSandboxLaneSettings(
      this.debug.get().sandboxLaneSettings,
      this.profile.height
    );
  }

  private getLaneLayout(): ThreeLaneLayout {
    return createThreeLaneLayoutFromYSettings(this.getLaneSettings());
  }

  private applyLaneSettings(settings: ThreeLaneYSettings): void {
    const normalizedSettings = normalizeSandboxLaneSettings(settings, this.profile.height);
    const signature = this.getLaneSettingsSignature(normalizedSettings);

    if (signature === this.activeLaneSettingsSignature) {
      return;
    }

    this.activeLaneSettingsSignature = signature;
    const layout = createThreeLaneLayoutFromYSettings(normalizedSettings);
    this.playerLaneMovement?.setLayout(layout);

    if (this.player !== null && this.playerLaneMovement !== null) {
      this.setPlayerToLaneY(this.playerLaneMovement.currentY);
    }

    for (const enemy of this.enemies) {
      enemy.laneMovement.setLayout(layout);

      if (enemy.sprite.active) {
        this.setEnemyToLaneY(enemy, enemy.laneMovement.currentY);
      }
    }
  }

  private getLaneSettingsSignature(settings: ThreeLaneYSettings): string {
    return `${settings.upperY}:${settings.middleY}:${settings.lowerY}`;
  }

  private createEnemy(index: number): EnemyState | null {
    if (this.player === null) {
      return null;
    }

    const enemySprite = this.physics.add.sprite(
      this.getDefaultEnemyX() + index * 120,
      this.centerY + 108,
      getEnemyNinjaIdleAnchorTextureKey('left'),
      NINJA_IDLE_ANCHOR_FRAME
    );
    enemySprite
      .setOrigin(0.5, 1)
      .setScale(NINJA_SPRITE_SCALE)
      .setCollideWorldBounds(true)
      .setDepth(ENEMY_DEPTH);
    const enemy = this.createEnemyState(enemySprite, 'left');
    this.physics.add.collider(this.player, enemy.sprite);
    this.registerEnemyAnimationEvents(enemy);
    this.deactivateEnemy(enemy);

    return enemy;
  }

  private ensureEnemyPoolSize(enemyCount: number): void {
    while (this.enemies.length < enemyCount) {
      const enemy = this.createEnemy(this.enemies.length);

      if (enemy === null) {
        return;
      }

      this.enemies.push(enemy);
    }
  }

  private startRound(round: number): void {
    const enemyCount = getRoundEnemyCount(this.debug.get().gameplayTuning, round);

    this.ensureEnemyPoolSize(enemyCount);
    this.currentRound = round;
    this.currentRoundEnemyCount = enemyCount;
    this.defeatedThisRound = 0;
    this.roundPhase = 'fighting';
    this.roundTransitionRemainingMs = 0;
    this.damagedEnemiesThisAttack.clear();
    this.clearAttackHitArea();
    this.clearAllEnemyAttackHitAreas();
    this.playSfx('round-start');

    this.enemies.forEach((enemy, index) => {
      if (index < enemyCount) {
        this.activateEnemyForRound(enemy, index);
        return;
      }

      this.deactivateEnemy(enemy);
    });

    this.renderHealthBars(this.time.now);
    this.renderProgressionHud();
    this.publishDebugTelemetry(this.time.now, true);
  }

  private activateEnemyForRound(
    enemy: EnemyState,
    index: number
  ): void {
    const spawn = this.getEnemySpawnPoint(index);

    enemy.laneMovement.setLayout(this.getLaneLayout());
    enemy.patrolDirection = this.getRandomEnemyPatrolDirection();
    enemy.nextPatrolDecisionAt = this.getNextEnemyPatrolDecisionAt(this.time.now);
    enemy.facingDirection = getEnemyFacingDirectionFromPatrol(enemy.patrolDirection);
    enemy.action = 'idle';
    enemy.health = ENEMY_MAX_HEALTH;
    enemy.roundActive = true;
    enemy.defeated = false;
    enemy.recoveryUntil = 0;
    enemy.attackDamageDealt = false;
    enemy.corpseTimer?.remove(false);
    enemy.corpseTimer = null;
    enemy.corpseTween?.stop();
    enemy.corpseTween = null;
    this.clearEnemyAttackHitArea(enemy);
    enemy.laneMovement.reset(spawn.laneId);
    const spritePosition = getNinjaSpritePositionForLane({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId: 'enemyNinja',
      direction: enemy.facingDirection,
      actionId: 'idle',
      scale: NINJA_SPRITE_SCALE,
      laneX: spawn.x,
      laneY: spawn.y
    });

    enemy.sprite
      .enableBody(true, spritePosition.x, spritePosition.y, true, true)
      .setPosition(spritePosition.x, spritePosition.y)
      .setVelocity(0, 0)
      .setAlpha(1)
      .setDepth(ENEMY_DEPTH);
    enemy.sprite.anims.resume();
    this.applyActorPlaybackRate(enemy.sprite, 'enemyNinja', 'idle');
    enemy.sprite.play(getEnemyNinjaAnimationKey('idle', enemy.facingDirection), false);
    this.applyActorCollisionBounds(enemy.sprite, 'enemyNinja', enemy.facingDirection, 'idle');
    this.setEnemyToLaneY(enemy, spawn.y, 'idle');
  }

  private deactivateEnemy(enemy: EnemyState): void {
    enemy.roundActive = false;
    enemy.defeated = false;
    enemy.action = 'idle';
    enemy.health = ENEMY_MAX_HEALTH;
    enemy.patrolDirection = 1;
    enemy.nextPatrolDecisionAt = 0;
    enemy.recoveryUntil = 0;
    enemy.attackDamageDealt = false;
    enemy.corpseTimer?.remove(false);
    enemy.corpseTimer = null;
    enemy.corpseTween?.stop();
    enemy.corpseTween = null;
    this.clearEnemyAttackHitArea(enemy);
    enemy.laneMovement.reset('middle');
    enemy.sprite.setVelocity(0, 0).setAlpha(1);
    enemy.sprite.disableBody(true, true);
  }

  private getEnemySpawnPoint(index: number): EnemySpawnPoint {
    const spawn = getThreeLaneEdgeSpawnPlacement({
      index,
      worldWidth: this.profile.width,
      edgeInset: ENEMY_LANE_EDGE_SPAWN_INSET,
      columnSpacing: ENEMY_LANE_EDGE_SPAWN_COLUMN_SPACING,
      layout: this.getLaneLayout()
    });

    return {
      x: spawn.x,
      y: spawn.y,
      laneId: spawn.laneId
    };
  }

  private updateRoundTransition(delta: number): void {
    if (this.roundPhase !== 'cleared') {
      return;
    }

    this.roundTransitionRemainingMs = Math.max(
      0,
      this.roundTransitionRemainingMs - delta
    );

    if (this.roundTransitionRemainingMs <= 0 && !this.isPlayerBusy()) {
      this.startRound(this.currentRound + 1);
      return;
    }

    this.renderProgressionHud();
  }

  private resetSceneState(): void {
    for (const enemy of this.enemies) {
      enemy.corpseTimer?.remove(false);
      enemy.corpseTween?.stop();
    }

    this.player = null;
    this.enemies = [];
    this.moveKeys = null;
    this.playerLaneMovement = null;
    this.background = null;
    this.debugOverlayGraphic = null;
    this.healthGraphic = null;
    this.playerHealthLabel = null;
    this.progressionLabel = null;
    this.roundBannerLabel = null;
    this.pauseLabel = null;
    this.gameOverOverlay = null;
    this.playerDeathOverlayTimer?.remove(false);
    this.playerDeathOverlayTimer = null;
    this.activeLaneSettingsSignature = '';
    this.facingDirection = 'right';
    this.currentAction = 'idle';
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.damagedEnemiesThisAttack.clear();
    this.gameOver = false;
    this.roundPhase = 'fighting';
    this.currentRound = 1;
    this.currentRoundEnemyCount = 0;
    this.defeatedThisRound = 0;
    this.totalDefeatedCount = 0;
    this.elapsedMs = 0;
    this.roundTransitionRemainingMs = 0;
    this.attackHitCount = 0;
    this.forwardVector.set(1, 0);
    this.damageKnockbackVector.set(0, 0);
    this.damageKnockbackOrigin.set(0, 0);
    this.attackHitArea.setTo(0, 0, 0, 0);
  }

  protected override shouldSyncDebugBgm(): boolean {
    return this.gameOverOverlay === null;
  }

  update(time: number, delta: number): void {
    if (this.player === null) {
      return;
    }

    if (this.playerHealth <= 0 && this.currentAction !== 'dead') {
      this.startPlayerDeath();
      this.finishDebugFrame(time);
      return;
    }

    if (this.moveKeys === null) {
      return;
    }

    const movement = this.readMovementInput();

    this.publishMovementInput(movement);

    if (this.gameOver) {
      this.player.setVelocity(0, 0);
      this.stopAllEnemyMovement();
      this.finishDebugFrame(time);
      return;
    }

    if (this.debug.get().paused) {
      this.player.setVelocity(0, 0);
      this.stopAllEnemyMovement();
      this.finishDebugFrame(time);
      return;
    }

    this.elapsedMs += delta;
    this.updateRoundTransition(delta);

    for (const enemy of this.enemies) {
      this.updateEnemy(enemy, time);
    }

    if (this.currentAction === 'hurt') {
      this.updatePlayerDamageKnockback();
      this.finishDebugFrame(time);
      return;
    }

    if (isPlayerAttackAction(this.currentAction)) {
      this.player.setVelocity(0, 0);
      this.syncPlayerToCurrentLane();
      this.updateAttackHitArea(this.currentAction);
      this.finishDebugFrame(time);
      return;
    }

    if (this.currentAction === 'jump') {
      this.updatePlayerJumpMovement(movement, delta / 1000);
      this.finishDebugFrame(time);
      return;
    }

    this.movePlayer(movement, delta / 1000);
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

  private createHealthHud(): void {
    this.healthGraphic = this.add.graphics().setDepth(HUD_DEPTH);
    this.playerHealthLabel = this.add
      .text(
        PLAYER_HEALTH_BAR_X + 12,
        PLAYER_HEALTH_BAR_Y + PLAYER_HEALTH_BAR_HEIGHT / 2,
        '',
        {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '17px',
          fontStyle: '700',
          color: '#f8fbff'
        }
      )
      .setOrigin(0, 0.5)
      .setDepth(HUD_DEPTH + 1);
    this.progressionLabel = this.add
      .text(this.profile.width - PROGRESSION_HUD_X_OFFSET, PROGRESSION_HUD_Y, '', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '17px',
        fontStyle: '700',
        color: '#f8fbff',
        align: 'right'
      })
      .setOrigin(1, 0)
      .setDepth(HUD_DEPTH + 1);
    this.roundBannerLabel = this.add
      .text(this.centerX, ROUND_BANNER_Y, '', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '24px',
        fontStyle: '700',
        color: '#f6c961'
      })
      .setOrigin(0.5)
      .setDepth(HUD_DEPTH + 1);
    this.renderHealthBars(this.time.now);
    this.renderProgressionHud();
  }

  private syncActorCollisionBounds(): void {
    this.applyActorCollisionBounds(
      this.player,
      'mainNinja',
      this.facingDirection,
      this.getPlayerBoundsAction()
    );

    for (const enemy of this.enemies) {
      this.applyActorCollisionBounds(
        enemy.sprite,
        'enemyNinja',
        enemy.facingDirection,
        this.getEnemyBoundsAction(enemy)
      );
    }
  }

  private syncActorPlaybackRates(): void {
    this.applyActorPlaybackRate(this.player, 'mainNinja', this.getPlayerBoundsAction());
    for (const enemy of this.enemies) {
      this.applyActorPlaybackRate(enemy.sprite, 'enemyNinja', this.getEnemyBoundsAction(enemy));
    }
  }

  private applyActorPlaybackRate(
    actor: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    actorId: 'mainNinja' | 'enemyNinja',
    action: string
  ): void {
    if (actor === null) {
      return;
    }

    actor.anims.timeScale = getNinjaAnimationPlaybackRate(
      this.app.getNinjaBoundsConfig(),
      actorId,
      action
    );
  }

  private applyActorCollisionBounds(
    actor: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    actorId: 'mainNinja' | 'enemyNinja',
    direction: FacingDirection,
    action: string
  ): void {
    if (actor === null) {
      return;
    }

    const bounds = getNinjaAnimationBounds(
      this.app.getNinjaBoundsConfig(),
      actorId,
      direction,
      action
    ).collision;

    actor.setBodySize(bounds.width, bounds.height, false).setOffset(bounds.x, bounds.y);
  }

  private getPlayerBoundsAction(): MainNinjaAction {
    if (this.currentAction === 'hurt') {
      return 'impact';
    }

    if (this.currentAction === 'dead') {
      return 'death';
    }

    return this.currentAction;
  }

  private getEnemyBoundsAction(enemy: EnemyState): EnemyNinjaAction {
    if (enemy.action === 'dead') {
      return 'death';
    }

    return enemy.action === 'slash'
      ? 'slash'
      : enemy.action === 'jump'
        ? 'jump'
        : enemy.action === 'run' || enemy.action === 'walk'
          ? enemy.action
          : 'idle';
  }

  private setPlayerToLaneY(
    laneY: number,
    actionId: string = this.getPlayerBoundsAction()
  ): void {
    if (this.player === null) {
      return;
    }

    this.setPlayerPositionForLane(
      this.getRenderedActorLanePoint(
        this.player,
        'mainNinja',
        this.facingDirection,
        this.getPlayerBoundsAction()
      ).x,
      laneY,
      actionId
    );
  }

  private setPlayerPositionForLane(
    laneX: number,
    laneY: number,
    actionId: string = this.getPlayerBoundsAction()
  ): void {
    const position = getNinjaSpritePositionForLane({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId: 'mainNinja',
      direction: this.facingDirection,
      actionId,
      scale: NINJA_SPRITE_SCALE,
      laneX,
      laneY
    });

    this.player?.setPosition(position.x, position.y);
  }

  private setEnemyToLaneY(
    enemy: EnemyState,
    laneY: number,
    actionId: string = this.getEnemyBoundsAction(enemy)
  ): void {
    this.setEnemyPositionForLane(
      enemy,
      this.getRenderedActorLanePoint(
        enemy.sprite,
        'enemyNinja',
        enemy.facingDirection,
        this.getEnemyBoundsAction(enemy)
      ).x,
      laneY,
      actionId
    );
  }

  private setEnemyPositionForLane(
    enemy: EnemyState,
    laneX: number,
    laneY: number,
    actionId: string = this.getEnemyBoundsAction(enemy)
  ): void {
    const position = getNinjaSpritePositionForLane({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId: 'enemyNinja',
      direction: enemy.facingDirection,
      actionId,
      scale: NINJA_SPRITE_SCALE,
      laneX,
      laneY
    });

    enemy.sprite.setPosition(position.x, position.y);
  }

  private getRenderedActorLanePoint(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    actorId: 'mainNinja' | 'enemyNinja',
    fallbackDirection: FacingDirection,
    fallbackActionId: string
  ): Phaser.Math.Vector2 {
    const renderedState = this.getRenderedActorAnimationState(
      sprite,
      actorId,
      fallbackDirection,
      fallbackActionId
    );

    return this.getActorLanePointFromSprite(
      sprite,
      actorId,
      renderedState.direction,
      renderedState.actionId
    );
  }

  private getRenderedActorAnimationState(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    actorId: 'mainNinja' | 'enemyNinja',
    fallbackDirection: FacingDirection,
    fallbackActionId: string
  ): { readonly direction: FacingDirection; readonly actionId: string } {
    const parts = sprite.anims.currentAnim?.key.split('.') ?? [];
    const direction = parts[2] === 'left' || parts[2] === 'right'
      ? parts[2]
      : fallbackDirection;
    const actionId = parts[0] === 'anim' && parts[1] === actorId && parts[3]
      ? parts[3]
      : fallbackActionId;

    return { direction, actionId };
  }

  private getActorLaneXFromSprite(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    actorId: 'mainNinja' | 'enemyNinja',
    direction: FacingDirection,
    actionId: string
  ): number {
    return getNinjaLaneXFromSprite({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId,
      direction,
      actionId,
      scale: NINJA_SPRITE_SCALE,
      spriteX: sprite.x
    });
  }

  private getActorLaneYFromSprite(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    actorId: 'mainNinja' | 'enemyNinja',
    direction: FacingDirection,
    actionId: string
  ): number {
    return getNinjaLaneYFromSprite({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId,
      direction,
      actionId,
      scale: NINJA_SPRITE_SCALE,
      spriteY: sprite.y
    });
  }

  private getActorLanePointFromSprite(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    actorId: 'mainNinja' | 'enemyNinja',
    direction: FacingDirection,
    actionId: string
  ): Phaser.Math.Vector2 {
    const point = getNinjaLanePointFromSprite({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId,
      direction,
      actionId,
      scale: NINJA_SPRITE_SCALE,
      spriteX: sprite.x,
      spriteY: sprite.y
    });

    return new Phaser.Math.Vector2(point.x, point.y);
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
      this.startAttack('slash');
    };
    const startJump = (): void => {
      this.startJump();
    };
    const requestLaneUp = (): void => {
      this.requestLaneChange('up');
    };
    const requestLaneDown = (): void => {
      this.requestLaneChange('down');
    };

    keyboard.on('keydown', syncLastKey);
    escKey.on('down', goBackToMenu);
    this.moveKeys.z.on('down', startAttack);
    this.moveKeys.space.on('down', startJump);
    this.moveKeys.w.on('down', requestLaneUp);
    this.moveKeys.up.on('down', requestLaneUp);
    this.moveKeys.s.on('down', requestLaneDown);
    this.moveKeys.down.on('down', requestLaneDown);

    this.trackCleanup(() => {
      keyboard.off('keydown', syncLastKey);
      escKey.off('down', goBackToMenu);
      this.moveKeys?.z.off('down', startAttack);
      this.moveKeys?.space.off('down', startJump);
      this.moveKeys?.w.off('down', requestLaneUp);
      this.moveKeys?.up.off('down', requestLaneUp);
      this.moveKeys?.s.off('down', requestLaneDown);
      this.moveKeys?.down.off('down', requestLaneDown);
    });
  }

  private registerPlayerAnimationEvents(): void {
    if (this.player === null) {
      return;
    }

    const completeAttack = (animation: Phaser.Animations.Animation): void => {
      if (animation.key.endsWith('.death') && this.currentAction === 'dead') {
        this.showGameOverOverlay();
        return;
      }

      if (animation.key.endsWith('.impact') && this.currentAction === 'hurt') {
        this.finishPlayerDamage();
        return;
      }

      if (animation.key.endsWith('.jump') && this.currentAction === 'jump') {
        if (this.playerLaneMovement?.isTransitioning) {
          return;
        }

        this.finishPlayerAction();
        return;
      }

      if (
        isPlayerAttackAction(this.currentAction) &&
        animation.key.endsWith('.slash')
      ) {
        this.finishPlayerAction();
      }
    };

    this.player.on('animationcomplete', completeAttack);
    this.trackCleanup(() => {
      this.player?.off('animationcomplete', completeAttack);
    });
  }

  private registerEnemyAnimationEvents(enemy: EnemyState): void {
    const completeAttack = (animation: Phaser.Animations.Animation): void => {
      if (animation.key.endsWith('.death') && enemy.action === 'dead') {
        this.beginEnemyCorpseDecay(enemy);
        return;
      }

      if (animation.key.endsWith('.slash') && enemy.action === 'slash') {
        this.startEnemyRecovery(enemy);
      }
    };

    enemy.sprite.on('animationcomplete', completeAttack);
    this.trackCleanup(() => {
      enemy.sprite.off('animationcomplete', completeAttack);
    });
  }

  private readMovementInput(): MovementInput {
    if (this.moveKeys === null) {
      return {
        left: false,
        right: false,
        up: false,
        down: false,
        x: 0
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
      x: Number(right) - Number(left)
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

  private requestLaneChange(direction: LaneTapDirection): void {
    if (
      this.player === null ||
      this.playerLaneMovement === null ||
      this.gameOver ||
      this.currentAction === 'dead' ||
      this.isPlayerBusy()
    ) {
      return;
    }

    if (!this.playerLaneMovement.tapLane(direction, this.time.now / 1000)) {
      return;
    }

    this.clearAttackHitArea();
    this.markActiveEnemyAttacksAsDodged();
    this.player.setVelocity(0, 0);
    this.playSfx('lane-dash');
    this.playNinjaAnimation('jump', true);
  }

  private movePlayer(movement: MovementInput, deltaSeconds = 0): void {
    if (this.player === null) {
      return;
    }

    const playerSpeed = this.debug.get().gameplayTuning.playerSpeed;
    const laneFrame = this.playerLaneMovement?.update({
      left: movement.left,
      right: movement.right,
      speed: playerSpeed,
      deltaSeconds
    });
    const laneY = laneFrame?.y ?? this.getActorLaneYFromSprite(
      this.player,
      'mainNinja',
      this.facingDirection,
      this.getPlayerBoundsAction()
    );

    if (movement.x === 0) {
      this.player.setVelocity(0, 0);
      this.playNinjaAnimation('idle');
      this.setPlayerToLaneY(laneY, 'idle');
      return;
    }

    const direction = new Phaser.Math.Vector2(movement.x, 0).normalize();

    this.forwardVector.copy(direction);
    this.updateFacingFromVector(direction);
    this.playNinjaAnimation('run');
    this.setPlayerToLaneY(laneY, 'run');
    this.player.setVelocity(laneFrame?.velocityX ?? direction.x * playerSpeed, 0);
  }

  private updatePlayerJumpMovement(movement: MovementInput, deltaSeconds: number): void {
    if (this.player === null) {
      return;
    }

    if (this.playerLaneMovement?.isTransitioning) {
      const playerSpeed = this.debug.get().gameplayTuning.playerSpeed;
      const laneFrame = this.playerLaneMovement.update({
        left: movement.left,
        right: movement.right,
        speed: playerSpeed,
        deltaSeconds
      });

      this.setPlayerPositionForLane(
        this.getActorLaneXFromSprite(
          this.player,
          'mainNinja',
          this.facingDirection,
          this.getPlayerBoundsAction()
        ),
        laneFrame.y,
        'jump'
      );
      this.player.setVelocity(0, 0);

      if (laneFrame.completedTransition) {
        this.finishPlayerAction();
      }

      return;
    }

    this.player.setVelocity(0, 0);
    this.syncPlayerToCurrentLane();
  }

  private syncPlayerToCurrentLane(): void {
    if (
      this.player === null ||
      this.playerLaneMovement === null ||
      this.playerLaneMovement.isTransitioning
    ) {
      return;
    }

    this.setPlayerToLaneY(this.playerLaneMovement.currentY);
  }

  private isPlayerBusy(): boolean {
    return (
      this.currentAction === 'jump' ||
      this.currentAction === 'hurt' ||
      this.currentAction === 'dead' ||
      isPlayerAttackAction(this.currentAction)
    );
  }

  private updateForwardVectorFromInput(): void {
    const movement = this.readMovementInput();

    if (movement.x === 0) {
      return;
    }

    this.forwardVector.set(movement.x, 0).normalize();
    this.updateFacingFromVector(this.forwardVector);
  }

  private startAttack(action: PlayerAttackAction): void {
    if (
      this.player === null ||
      this.gameOver ||
      this.currentAction === 'dead' ||
      this.isPlayerBusy()
    ) {
      return;
    }

    this.updateForwardVectorFromInput();
    this.playerLaneMovement?.resetTapState();
    this.damagedEnemiesThisAttack.clear();
    this.clearAttackHitArea();
    this.player.setVelocity(0, 0);
    this.playSfx('player-slash');
    this.playNinjaAnimation(action, true);
  }

  private startJump(): void {
    if (
      this.player === null ||
      this.gameOver ||
      this.currentAction === 'dead' ||
      this.isPlayerBusy()
    ) {
      return;
    }

    this.updateForwardVectorFromInput();
    this.playerLaneMovement?.resetTapState();
    this.clearAttackHitArea();
    this.markActiveEnemyAttacksAsDodged();
    this.player.setVelocity(0, 0);
    this.playSfx('jump');
    this.playNinjaAnimation('jump', true);
  }

  private finishPlayerAction(): void {
    if (this.player === null) {
      return;
    }

    if (this.playerHealth <= 0 || this.gameOver) {
      this.startPlayerDeath();
      return;
    }

    this.currentAction = 'idle';
    this.player.setVelocity(0, 0);
    this.damagedEnemiesThisAttack.clear();
    this.clearAttackHitArea();
    this.movePlayer(this.readMovementInput());
  }

  private finishPlayerDamage(): void {
    if (this.player === null) {
      return;
    }

    if (this.playerHealth <= 0 || this.gameOver) {
      this.startPlayerDeath();
      return;
    }

    this.currentAction = 'idle';
    this.damageKnockbackVector.set(0, 0);
    this.damageKnockbackOrigin.set(0, 0);
    this.player.setVelocity(0, 0);
    this.damagedEnemiesThisAttack.clear();
    this.movePlayer(this.readMovementInput());
  }

  private updatePlayerDamageKnockback(): void {
    if (this.player === null || this.damageKnockbackVector.lengthSq() === 0) {
      return;
    }

    const playerLanePoint = this.getActorLanePointFromSprite(
      this.player,
      'mainNinja',
      this.facingDirection,
      this.getPlayerBoundsAction()
    );
    const movedX = playerLanePoint.x - this.damageKnockbackOrigin.x;
    const movedDistance = Math.abs(movedX);

    if (movedDistance >= PLAYER_DAMAGE_KNOCKBACK_DISTANCE) {
      this.setPlayerPositionForLane(
        this.damageKnockbackOrigin.x +
          this.damageKnockbackVector.x * PLAYER_DAMAGE_KNOCKBACK_DISTANCE,
        this.playerLaneMovement?.currentY ?? playerLanePoint.y
      );
      this.player.setVelocity(0, 0);
      return;
    }

    const knockbackSpeed = this.debug.get().gameplayTuning.playerKnockbackSpeed;
    this.player.setVelocity(this.damageKnockbackVector.x * knockbackSpeed, 0);
    this.syncPlayerToCurrentLane();
  }

  private updateEnemy(enemy: EnemyState, time: number): void {
    if (this.player === null) {
      return;
    }

    if (
      this.gameOver ||
      !enemy.roundActive ||
      enemy.action === 'dead' ||
      !enemy.sprite.active
    ) {
      enemy.sprite.setVelocity(0, 0);
      return;
    }

    if (enemy.action === 'slash') {
      enemy.sprite.setVelocity(0, 0);
      this.syncEnemyToCurrentLane(enemy);
      this.updateEnemyAttackDamage(enemy);
      return;
    }

    if (enemy.action === 'recover') {
      enemy.sprite.setVelocity(0, 0);
      this.syncEnemyToCurrentLane(enemy);
      this.playEnemyAnimation(enemy, 'idle');

      if (time >= enemy.recoveryUntil) {
        enemy.action = 'idle';
      } else {
        return;
      }
    }

    if (!this.debug.get().enemyAiEnabled) {
      enemy.sprite.setVelocity(0, 0);
      this.syncEnemyToCurrentLane(enemy);
      this.playEnemyAnimation(enemy, 'idle');
      return;
    }

    this.syncEnemyToCurrentLane(enemy);

    if (this.canEnemySlashReachPlayer(enemy)) {
      this.startEnemyAttack(enemy);
      return;
    }

    const approachDirection = this.getEnemyApproachDirection(enemy);

    if (approachDirection !== null) {
      const enemySpeed = getEnemyChaseMovementSpeed(
        getEnemyMovementSpeed(this.debug.get().gameplayTuning)
      );

      enemy.patrolDirection = approachDirection;
      this.updateEnemyFacingFromVector(enemy, new Phaser.Math.Vector2(approachDirection, 0));
      enemy.sprite.setVelocity(approachDirection * enemySpeed, 0);
      this.playEnemyAnimation(enemy, 'run');
      return;
    }

    this.updateEnemyPatrol(enemy, time);
  }

  private updateEnemyPatrol(enemy: EnemyState, time: number): void {
    const direction = this.resolveEnemyPatrolDirection(enemy, time);
    const enemySpeed = getEnemyPatrolMovementSpeed(
      getEnemyMovementSpeed(this.debug.get().gameplayTuning)
    );

    this.updateEnemyFacingFromVector(enemy, new Phaser.Math.Vector2(direction, 0));
    enemy.sprite.setVelocity(direction * enemySpeed, 0);
    this.playEnemyAnimation(enemy, 'walk');
  }

  private resolveEnemyPatrolDirection(
    enemy: EnemyState,
    time: number
  ): EnemyPatrolDirection {
    const enemyLaneX = this.getActorLaneXFromSprite(
      enemy.sprite,
      'enemyNinja',
      enemy.facingDirection,
      this.getEnemyBoundsAction(enemy)
    );
    const leftLimit = ENEMY_PATROL_WORLD_PADDING;
    const rightLimit = this.profile.width - ENEMY_PATROL_WORLD_PADDING;
    const patrolState = resolveEnemyPatrolState({
      enemyLaneX,
      patrolDirection: enemy.patrolDirection,
      time,
      nextDecisionAt: enemy.nextPatrolDecisionAt,
      leftLimit,
      rightLimit,
      choosePatrolDirection: () => this.getRandomEnemyPatrolDirection(),
      chooseNextDecisionAt: (currentTime) => this.getNextEnemyPatrolDecisionAt(currentTime)
    });

    enemy.patrolDirection = patrolState.patrolDirection;
    enemy.nextPatrolDecisionAt = patrolState.nextDecisionAt;

    return enemy.patrolDirection;
  }

  private getEnemyApproachDirection(enemy: EnemyState): EnemyPatrolDirection | null {
    const playerLaneMovement = this.playerLaneMovement;

    if (
      this.player === null ||
      playerLaneMovement === null ||
      playerLaneMovement.isTransitioning ||
      enemy.laneMovement.currentLaneId !== playerLaneMovement.currentLaneId
    ) {
      return null;
    }

    const playerLaneX = this.getActorLaneXFromSprite(
      this.player,
      'mainNinja',
      this.facingDirection,
      this.getPlayerBoundsAction()
    );
    const enemyLaneX = this.getActorLaneXFromSprite(
      enemy.sprite,
      'enemyNinja',
      enemy.facingDirection,
      this.getEnemyBoundsAction(enemy)
    );

    return getEnemyApproachDirection({
      enemyLaneId: enemy.laneMovement.currentLaneId,
      playerLaneId: playerLaneMovement.currentLaneId,
      playerIsTransitioning: playerLaneMovement.isTransitioning,
      enemyLaneX,
      playerLaneX,
      enemyFacingDirection: enemy.facingDirection,
      detectionDistance: ENEMY_FRONT_DETECTION_DISTANCE
    });
  }

  private isPlayerOnEnemyLane(enemy: EnemyState): boolean {
    return (
      this.playerLaneMovement !== null &&
      !this.playerLaneMovement.isTransitioning &&
      enemy.laneMovement.currentLaneId === this.playerLaneMovement.currentLaneId
    );
  }

  private getRandomEnemyPatrolDirection(): EnemyPatrolDirection {
    return Phaser.Math.Between(0, 1) === 0 ? -1 : 1;
  }

  private getNextEnemyPatrolDecisionAt(time: number): number {
    return time + Phaser.Math.Between(
      ENEMY_PATROL_MIN_DECISION_MS,
      ENEMY_PATROL_MAX_DECISION_MS
    );
  }

  private syncEnemyToCurrentLane(enemy: EnemyState): void {
    if (enemy.laneMovement.isTransitioning) {
      return;
    }

    this.setEnemyToLaneY(enemy, enemy.laneMovement.currentY);
  }

  private startEnemyAttack(enemy: EnemyState): void {
    if (
      this.player === null ||
      this.gameOver ||
      this.currentAction === 'dead' ||
      !enemy.roundActive ||
      enemy.action === 'slash' ||
      enemy.action === 'dead'
    ) {
      return;
    }

    enemy.attackDamageDealt = false;
    this.clearEnemyAttackHitArea(enemy);
    enemy.sprite.setVelocity(0, 0);
    this.updateEnemyFacingFromVector(
      enemy,
      new Phaser.Math.Vector2(
        this.getActorLaneXFromSprite(
          this.player,
          'mainNinja',
          this.facingDirection,
          this.getPlayerBoundsAction()
        ) -
          this.getActorLaneXFromSprite(
            enemy.sprite,
            'enemyNinja',
            enemy.facingDirection,
            this.getEnemyBoundsAction(enemy)
          ),
        0
      )
    );
    this.playSfx('enemy-slash');
    this.playEnemyAnimation(enemy, 'slash', true);
  }

  private startEnemyRecovery(enemy: EnemyState): void {
    enemy.action = 'recover';
    enemy.recoveryUntil = this.time.now + this.debug.get().gameplayTuning.enemyRecoveryMs;
    enemy.attackDamageDealt = false;
    this.clearEnemyAttackHitArea(enemy);
    enemy.sprite.setVelocity(0, 0);
    this.syncEnemyToCurrentLane(enemy);
    this.playEnemyAnimation(enemy, 'idle', true);
  }

  private updateEnemyAttackDamage(enemy: EnemyState): void {
    if (
      this.gameOver ||
      !canPlayerReceiveEnemyAttack(this.currentAction)
    ) {
      this.clearEnemyAttackHitArea(enemy);
      return;
    }

    if (!this.isEnemyAttackReachFrame(enemy)) {
      this.clearEnemyAttackHitArea(enemy);
      return;
    }

    this.updateEnemyAttackHitArea(enemy);

    if (enemy.attackDamageDealt || enemy.attackHitCount === 0) {
      return;
    }

    enemy.attackDamageDealt = true;
    this.damagePlayerFromEnemy(enemy);
  }

  private damagePlayerFromEnemy(enemy: EnemyState): void {
    if (
      this.player === null ||
      !canPlayerReceiveEnemyAttack(this.currentAction) ||
      this.gameOver
    ) {
      return;
    }

    this.playerHealth = applyAttackDamage(this.playerHealth);
    this.renderHealthBars(this.time.now);

    if (this.playerHealth <= 0) {
      this.startPlayerDeath();
      return;
    }

    this.playSfx('player-hurt');

    const playerLanePoint = this.getActorLanePointFromSprite(
      this.player,
      'mainNinja',
      this.facingDirection,
      this.getPlayerBoundsAction()
    );
    const enemyLanePoint = this.getActorLanePointFromSprite(
      enemy.sprite,
      'enemyNinja',
      enemy.facingDirection,
      this.getEnemyBoundsAction(enemy)
    );
    const knockbackDirection = new Phaser.Math.Vector2(
      playerLanePoint.x - enemyLanePoint.x,
      0
    );

    if (knockbackDirection.lengthSq() === 0) {
      knockbackDirection.set(enemy.facingDirection === 'left' ? -1 : 1, 0);
    }

    knockbackDirection.normalize();
    this.damageKnockbackVector.copy(knockbackDirection);
    this.damageKnockbackOrigin.copy(playerLanePoint);
    this.currentAction = 'hurt';
    this.clearAttackHitArea();

    const towardEnemy = new Phaser.Math.Vector2(
      enemyLanePoint.x - playerLanePoint.x,
      enemyLanePoint.y - playerLanePoint.y
    );
    this.updateFacingFromVector(towardEnemy);
    const knockbackSpeed = this.debug.get().gameplayTuning.playerKnockbackSpeed;
    this.player.setVelocity(knockbackDirection.x * knockbackSpeed, 0);
    this.applyActorPlaybackRate(this.player, 'mainNinja', 'impact');
    this.player.play(
      getMainNinjaAnimationKey('impact', this.facingDirection),
      false
    );
    this.applyActorCollisionBounds(this.player, 'mainNinja', this.facingDirection, 'impact');
    this.setPlayerPositionForLane(
      playerLanePoint.x,
      this.playerLaneMovement?.currentY ?? playerLanePoint.y,
      'impact'
    );
  }

  private startPlayerDeath(): void {
    if (this.player === null) {
      return;
    }

    this.gameOver = true;
    this.roundTransitionRemainingMs = 0;

    if (this.currentAction === 'dead') {
      this.stopAllEnemiesForGameOver();
      this.renderProgressionHud();
      this.scheduleGameOverOverlay(this.getPlayerDeathOverlayFallbackDelay());
      return;
    }

    const lanePoint = this.getRenderedActorLanePoint(
      this.player,
      'mainNinja',
      this.facingDirection,
      this.getPlayerBoundsAction()
    );

    this.currentAction = 'dead';
    this.playerHealth = 0;
    this.clearAttackHitArea();
    this.clearAllEnemyAttackHitAreas();
    this.playSfx('main-ninja-death');
    this.stopAllEnemiesForGameOver();
    this.player.disableBody(false, false);
    this.player.setVelocity(0, 0).setAlpha(1);
    this.player.anims.resume();
    this.applyActorPlaybackRate(this.player, 'mainNinja', 'death');
    this.player.play(getMainNinjaAnimationKey('death', this.facingDirection), false);
    this.applyActorCollisionBounds(this.player, 'mainNinja', this.facingDirection, 'death');
    this.setPlayerPositionForLane(
      lanePoint.x,
      this.playerLaneMovement?.currentY ?? lanePoint.y,
      'death'
    );
    this.scheduleGameOverOverlay(this.getPlayerDeathOverlayFallbackDelay());
    this.renderProgressionHud();
    this.renderHealthBars(this.time.now);
  }

  private scheduleGameOverOverlay(delayMs: number): void {
    this.playerDeathOverlayTimer?.remove(false);
    this.playerDeathOverlayTimer = this.time.delayedCall(delayMs, () => {
      this.playerDeathOverlayTimer = null;

      if (!this.gameOver || this.currentAction !== 'dead') {
        return;
      }

      if (this.isPlayerDeathAnimationStillPlaying()) {
        this.scheduleGameOverOverlay(PLAYER_DEATH_OVERLAY_RECHECK_MS);
        return;
      }

      this.showGameOverOverlay();
    });
  }

  private getPlayerDeathOverlayFallbackDelay(): number {
    const animationState = this.player?.anims;

    return getAnimationFallbackDelayMs({
      durationMs: animationState?.duration ?? 0,
      localTimeScale: animationState?.timeScale ?? 1,
      globalTimeScale: animationState?.animationManager.globalTimeScale ?? 1,
      bufferMs: PLAYER_DEATH_OVERLAY_FALLBACK_BUFFER_MS
    });
  }

  private isPlayerDeathAnimationStillPlaying(): boolean {
    const animationState = this.player?.anims;

    return (
      animationState?.currentAnim?.key.endsWith('.death') === true &&
      animationState.isPlaying
    );
  }

  private stopAllEnemiesForGameOver(): void {
    for (const enemy of this.enemies) {
      enemy.sprite.setVelocity(0, 0);
      enemy.sprite.anims.pause();
      enemy.corpseTimer?.remove(false);
      enemy.corpseTimer = null;
      enemy.corpseTween?.pause();
      this.clearEnemyAttackHitArea(enemy);
    }
  }

  private stopAllEnemyMovement(): void {
    for (const enemy of this.enemies) {
      enemy.sprite.setVelocity(0, 0);
      this.syncEnemyToCurrentLane(enemy);
    }
  }

  private showGameOverOverlay(): void {
    this.playerDeathOverlayTimer?.remove(false);
    this.playerDeathOverlayTimer = null;

    if (this.gameOverOverlay !== null) {
      return;
    }

    const overlay = this.add.container(0, 0).setDepth(GAME_OVER_DEPTH);
    const backdrop = this.add
      .rectangle(0, 0, this.profile.width, this.profile.height, 0x050910, 0.74)
      .setOrigin(0)
      .setInteractive();
    const title = this.add
      .text(this.centerX, this.centerY - 118, 'GAME OVER', {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '48px',
        fontStyle: '700',
        color: '#f8fbff'
      })
      .setOrigin(0.5);
    const detail = this.add
      .text(
        this.centerX,
        this.centerY - 64,
        `Round ${this.currentRound} | KO ${this.totalDefeatedCount} | ${formatElapsedTime(
          this.elapsedMs
        )}`,
        {
          fontFamily: 'Arial, Helvetica, sans-serif',
          fontSize: '20px',
          color: '#cbd7e6'
        }
      )
      .setOrigin(0.5);
    const restartButton = this.createGameOverButton(
      this.centerX - 92,
      this.centerY + 14,
      'Restart',
      () => this.scene.restart()
    );
    const menuButton = this.createGameOverButton(
      this.centerX + 92,
      this.centerY + 14,
      'Menu',
      () => this.goTo(SceneKeys.MainMenu)
    );

    overlay.add([backdrop, title, detail, restartButton, menuButton]);
    this.gameOverOverlay = overlay;
    this.app.audio.playBgm(this, GAME_OVER_BGM_TRACK_ID);
  }

  private createGameOverButton(
    x: number,
    y: number,
    label: string,
    onClick: () => void
  ): Phaser.GameObjects.Container {
    const width = 152;
    const height = 48;
    const button = this.add.container(x, y);
    const background = this.add
      .rectangle(0, 0, width, height, 0x182235, 1)
      .setStrokeStyle(2, 0x7ed7ff, 0.92);
    const text = this.add
      .text(0, 0, label, {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '20px',
        fontStyle: '700',
        color: '#f8fbff'
      })
      .setOrigin(0.5);

    button.add([background, text]);
    button.setSize(width, height);
    button.setInteractive(
      new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height),
      Phaser.Geom.Rectangle.Contains
    );
    button.on('pointerover', () => background.setFillStyle(0x223150, 1));
    button.on('pointerout', () => background.setFillStyle(0x182235, 1));
    button.on('pointerdown', () => background.setFillStyle(0x2d5f91, 1));
    button.on('pointerup', () => {
      background.setFillStyle(0x223150, 1);
      this.playSfx('ui-select');
      onClick();
    });

    return button;
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
    const lanePoint = this.getRenderedActorLanePoint(
      this.player,
      'mainNinja',
      this.facingDirection,
      this.getPlayerBoundsAction()
    );

    this.applyActorPlaybackRate(this.player, 'mainNinja', action);

    if (!restart && this.player.anims.currentAnim?.key === animationKey) {
      return;
    }

    this.currentAction = action;
    this.player.play(animationKey, !restart);
    this.applyActorCollisionBounds(this.player, 'mainNinja', this.facingDirection, action);
    this.setPlayerPositionForLane(
      lanePoint.x,
      this.playerLaneMovement?.isTransitioning === true
        ? lanePoint.y
        : (this.playerLaneMovement?.currentY ?? lanePoint.y),
      action
    );
  }

  private updateEnemyFacingFromVector(enemy: EnemyState, vector: Phaser.Math.Vector2): void {
    if (vector.x < 0) {
      enemy.facingDirection = 'left';
      return;
    }

    if (vector.x > 0) {
      enemy.facingDirection = 'right';
    }
  }

  private playEnemyAnimation(
    enemy: EnemyState,
    action: EnemyNinjaAction,
    restart = false
  ): void {
    const animationKey = getEnemyNinjaAnimationKey(action, enemy.facingDirection);
    const lanePoint = this.getRenderedActorLanePoint(
      enemy.sprite,
      'enemyNinja',
      enemy.facingDirection,
      this.getEnemyBoundsAction(enemy)
    );

    this.applyActorPlaybackRate(enemy.sprite, 'enemyNinja', action);

    if (!restart && enemy.sprite.anims.currentAnim?.key === animationKey) {
      return;
    }

    if (action === 'death') {
      enemy.action = 'dead';
    } else if (action !== 'idle' || enemy.action !== 'recover') {
      enemy.action = action;
    }

    enemy.sprite.play(animationKey, !restart);
    this.applyActorCollisionBounds(enemy.sprite, 'enemyNinja', enemy.facingDirection, action);
    this.setEnemyPositionForLane(
      enemy,
      lanePoint.x,
      enemy.laneMovement.isTransitioning ? lanePoint.y : enemy.laneMovement.currentY,
      action
    );
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
      getNinjaAnimationBounds(
        this.app.getNinjaBoundsConfig(),
        'mainNinja',
        this.facingDirection,
        action
      ).attack
    );
    const hitEnemies = this.enemies.filter(
      (enemy) =>
        enemy.roundActive &&
        enemy.health > 0 &&
        enemy.action !== 'dead' &&
        enemy.sprite.active &&
        this.isHitAreaOverlappingActor(this.attackHitArea, enemy.sprite)
    );

    this.attackHitCount = hitEnemies.length;

    for (const enemy of hitEnemies) {
      if (!this.damagedEnemiesThisAttack.has(enemy)) {
        this.damagedEnemiesThisAttack.add(enemy);
        this.damageEnemyFromPlayer(enemy);
      }
    }
  }

  private damageEnemyFromPlayer(enemy: EnemyState): void {
    if (!enemy.roundActive || enemy.health <= 0 || enemy.action === 'dead') {
      return;
    }

    enemy.health = applyAttackDamage(enemy.health);
    this.renderHealthBars(this.time.now);

    if (enemy.health <= 0) {
      this.startEnemyDeath(enemy);
      return;
    }

    this.playSfx('hit');
  }

  private startEnemyDeath(enemy: EnemyState): void {
    if (enemy.action === 'dead') {
      return;
    }

    const lanePoint = this.getRenderedActorLanePoint(
      enemy.sprite,
      'enemyNinja',
      enemy.facingDirection,
      this.getEnemyBoundsAction(enemy)
    );

    enemy.health = 0;
    enemy.action = 'dead';
    enemy.recoveryUntil = 0;
    enemy.attackDamageDealt = false;
    this.clearEnemyAttackHitArea(enemy);
    enemy.corpseTimer?.remove(false);
    enemy.corpseTimer = null;
    enemy.corpseTween?.stop();
    enemy.corpseTween = null;
    enemy.sprite.disableBody(false, false);
    enemy.sprite.setVelocity(0, 0).setAlpha(1).setActive(true).setVisible(true);
    enemy.sprite.anims.resume();
    this.applyActorPlaybackRate(enemy.sprite, 'enemyNinja', 'death');
    enemy.sprite.play(getEnemyNinjaAnimationKey('death', enemy.facingDirection), false);
    this.applyActorCollisionBounds(enemy.sprite, 'enemyNinja', enemy.facingDirection, 'death');
    this.setEnemyPositionForLane(
      enemy,
      lanePoint.x,
      enemy.laneMovement.currentY,
      'death'
    );
    this.playSfx('enemy-defeat');
    this.recordEnemyDefeat(enemy);
    this.renderHealthBars(this.time.now);
  }

  private recordEnemyDefeat(enemy: EnemyState): void {
    if (!enemy.roundActive || enemy.defeated) {
      return;
    }

    enemy.defeated = true;
    this.defeatedThisRound = Math.min(
      this.currentRoundEnemyCount,
      this.defeatedThisRound + 1
    );
    this.totalDefeatedCount += 1;
    this.renderProgressionHud();

    if (this.defeatedThisRound >= this.currentRoundEnemyCount) {
      this.completeRound();
    } else {
      this.publishDebugTelemetry(this.time.now, true);
    }
  }

  private completeRound(): void {
    if (this.gameOver || this.roundPhase !== 'fighting') {
      return;
    }

    this.roundPhase = 'cleared';
    this.roundTransitionRemainingMs = normalizeGameplayTuning(
      this.debug.get().gameplayTuning
    ).roundIntermissionMs;
    this.clearAttackHitArea();
    this.clearAllEnemyAttackHitAreas();
    this.stopAllEnemyMovement();
    this.renderProgressionHud();
    this.publishDebugTelemetry(this.time.now, true);
  }

  private beginEnemyCorpseDecay(enemy: EnemyState): void {
    if (this.gameOver) {
      return;
    }

    enemy.corpseTimer?.remove(false);
    enemy.corpseTimer = this.time.delayedCall(ENEMY_CORPSE_HOLD_MS, () => {
      if (this.gameOver || enemy.action !== 'dead') {
        return;
      }

      enemy.corpseTween = this.tweens.add({
        targets: enemy.sprite,
        alpha: 0.18,
        duration: ENEMY_CORPSE_BLINK_DURATION_MS,
        yoyo: true,
        repeat: ENEMY_CORPSE_BLINK_REPEAT,
        onComplete: () => {
          if (enemy.action !== 'dead') {
            return;
          }

          enemy.sprite.setVisible(false).setActive(false).setAlpha(1);
          enemy.corpseTween = null;
          this.renderHealthBars(this.time.now);
        }
      });
    });
  }

  private updateEnemyAttackHitArea(enemy: EnemyState): void {
    if (this.player === null) {
      return;
    }

    this.setAttackHitArea(
      enemy.attackHitArea,
      enemy.sprite,
      getNinjaAnimationBounds(
        this.app.getNinjaBoundsConfig(),
        'enemyNinja',
        enemy.facingDirection,
        'slash'
      ).attack
    );
    enemy.attackHitCount = this.isHitAreaOverlappingActor(
      enemy.attackHitArea,
      this.player,
      ENEMY_ATTACK_REQUIRED_OVERLAP_X,
      ENEMY_ATTACK_REQUIRED_OVERLAP_Y
    )
      ? 1
      : 0;
  }

  private canEnemySlashReachPlayer(enemy: EnemyState): boolean {
    if (
      this.gameOver ||
      !canPlayerReceiveEnemyAttack(this.currentAction) ||
      !enemy.roundActive ||
      enemy.action === 'dead' ||
      !this.isPlayerOnEnemyLane(enemy)
    ) {
      return false;
    }

    if (this.player === null || !this.updateEnemyAttackProbeArea(enemy)) {
      return false;
    }

    return this.isHitAreaOverlappingActor(
      enemy.attackProbeArea,
      this.player,
      ENEMY_ATTACK_REQUIRED_OVERLAP_X,
      ENEMY_ATTACK_REQUIRED_OVERLAP_Y
    );
  }

  private updateEnemyAttackProbeArea(enemy: EnemyState): boolean {
    this.setAttackHitArea(
      enemy.attackProbeArea,
      enemy.sprite,
      getNinjaAnimationBounds(
        this.app.getNinjaBoundsConfig(),
        'enemyNinja',
        enemy.facingDirection,
        'slash'
      ).attack
    );

    return true;
  }

  private setAttackHitArea(
    hitArea: Phaser.Geom.Rectangle,
    actor: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    rect: NinjaRect
  ): void {
    this.getWorldRectFromFrameRect(actor, rect, hitArea);
  }

  private isHitAreaOverlappingActor(
    hitArea: Phaser.Geom.Rectangle,
    actor: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    requiredOverlapX = 1,
    requiredOverlapY = 1
  ): boolean {
    const body = actor.body;
    const overlapX =
      Math.min(hitArea.x + hitArea.width, body.x + body.width) - Math.max(hitArea.x, body.x);
    const overlapY =
      Math.min(hitArea.y + hitArea.height, body.y + body.height) - Math.max(hitArea.y, body.y);

    return overlapX >= requiredOverlapX && overlapY >= requiredOverlapY;
  }

  private clearAttackHitArea(): void {
    this.attackHitCount = 0;
    this.attackHitArea.setTo(0, 0, 0, 0);
    this.renderDebugOverlays();
  }

  private clearEnemyAttackHitArea(enemy: EnemyState): void {
    enemy.attackHitCount = 0;
    enemy.attackHitArea.setTo(0, 0, 0, 0);
  }

  private markActiveEnemyAttacksAsDodged(): void {
    for (const enemy of this.enemies) {
      if (enemy.action !== 'slash') {
        continue;
      }

      enemy.attackDamageDealt = true;
      this.clearEnemyAttackHitArea(enemy);
    }
  }

  private clearAllEnemyAttackHitAreas(): void {
    for (const enemy of this.enemies) {
      this.clearEnemyAttackHitArea(enemy);
    }
  }

  private getAnimationFrameIndex(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null
  ): number {
    return sprite?.anims.currentFrame?.index ?? 0;
  }

  private getAnimationFrameZeroIndex(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null
  ): number {
    return Math.max(0, this.getAnimationFrameIndex(sprite) - 1);
  }

  private isPlayerAttackReachFrame(): boolean {
    return (
      isPlayerAttackAction(this.currentAction) &&
      isNinjaHitFrameActive(
        this.app.getNinjaBoundsConfig(),
        'mainNinja',
        this.facingDirection,
        this.currentAction,
        this.getAnimationFrameZeroIndex(this.player)
      )
    );
  }

  private isEnemyAttackReachFrame(enemy: EnemyState): boolean {
    return (
      enemy.action === 'slash' &&
      isNinjaHitFrameActive(
        this.app.getNinjaBoundsConfig(),
        'enemyNinja',
        enemy.facingDirection,
        'slash',
        this.getAnimationFrameZeroIndex(enemy.sprite)
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
    if (this.player === null) {
      return;
    }

    const restoreDebugBgm = this.gameOver || this.gameOverOverlay !== null;

    this.facingDirection = 'right';
    this.forwardVector.set(1, 0);
    this.playerLaneMovement = this.createLaneMovementController('middle');
    this.damageKnockbackVector.set(0, 0);
    this.damageKnockbackOrigin.set(0, 0);
    this.currentAction = 'idle';
    this.playerHealth = PLAYER_MAX_HEALTH;
    this.damagedEnemiesThisAttack.clear();
    this.gameOver = false;
    this.roundPhase = 'fighting';
    this.currentRound = 1;
    this.currentRoundEnemyCount = 0;
    this.defeatedThisRound = 0;
    this.totalDefeatedCount = 0;
    this.elapsedMs = 0;
    this.roundTransitionRemainingMs = 0;
    this.gameOverOverlay?.destroy(true);
    this.gameOverOverlay = null;
    this.playerDeathOverlayTimer?.remove(false);
    this.playerDeathOverlayTimer = null;
    this.clearAttackHitArea();
    this.clearAllEnemyAttackHitAreas();

    if (restoreDebugBgm) {
      this.app.audio.playBgm(this, this.debug.get().bgmTrackId);
    }

    const playerLaneY = this.playerLaneMovement.currentY;
    const playerSpritePosition = getNinjaSpritePositionForLane({
      boundsConfig: this.app.getNinjaBoundsConfig(),
      actorId: 'mainNinja',
      direction: this.facingDirection,
      actionId: 'idle',
      scale: NINJA_SPRITE_SCALE,
      laneX: this.centerX,
      laneY: playerLaneY
    });

    this.player
      .enableBody(true, playerSpritePosition.x, playerSpritePosition.y, true, true)
      .setPosition(playerSpritePosition.x, playerSpritePosition.y)
      .setVelocity(0, 0)
      .setAlpha(1);
    this.player.anims.resume();
    this.applyActorPlaybackRate(this.player, 'mainNinja', 'idle');
    this.player.play(getMainNinjaAnimationKey('idle', 'right'), false);
    this.applyActorCollisionBounds(this.player, 'mainNinja', this.facingDirection, 'idle');
    this.setPlayerToLaneY(playerLaneY, 'idle');

    this.startRound(1);
    this.finishDebugFrame(this.time.now, true);
  }

  private finishDebugFrame(time: number, forceTelemetry = false): void {
    this.syncActorCollisionBounds();
    this.syncActorPlaybackRates();
    this.publishDebugTelemetry(time, forceTelemetry);
    this.renderHealthBars(time);
    this.renderProgressionHud();
    this.renderDebugOverlays();
  }

  private publishDebugTelemetry(time: number, force = false): void {
    if (!force && time - this.lastDebugTelemetryAt < 100) {
      return;
    }

    this.lastDebugTelemetryAt = time;
    const attackActive = this.isPlayerAttackReachFrame();
    const primaryEnemy = this.enemies[0] ?? null;

    const playerBoundsAction = this.getPlayerBoundsAction();
    const enemyBoundsAction =
      primaryEnemy === null ? 'none' : this.getEnemyBoundsAction(primaryEnemy);

    this.debug.update((state) => ({
      ...state,
      player: this.createActorDebugState(
        this.player,
        this.currentAction,
        playerBoundsAction,
        'mainNinja',
        this.facingDirection
      ),
      enemy: this.createActorDebugState(
        primaryEnemy?.sprite ?? null,
        primaryEnemy?.action ?? 'none',
        enemyBoundsAction,
        'enemyNinja',
        primaryEnemy?.facingDirection ?? 'left'
      ),
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
      round: {
        status: this.gameOver ? 'gameOver' : this.roundPhase,
        round: this.currentRound,
        enemies: this.currentRoundEnemyCount,
        defeated: this.defeatedThisRound,
        totalDefeated: this.totalDefeatedCount,
        elapsedMs: Math.round(this.elapsedMs),
        nextRoundInMs: Math.round(this.roundTransitionRemainingMs)
      },
      performance: {
        fps: this.game.loop.actualFps,
        physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
      }
    }));
  }

  private createActorDebugState(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    action: string,
    boundsAction: string,
    actorId: 'mainNinja' | 'enemyNinja',
    direction: FacingDirection
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
      x: Math.round(this.getActorLaneXFromSprite(sprite, actorId, direction, boundsAction)),
      y: Math.round(this.getActorLaneYFromSprite(sprite, actorId, direction, boundsAction)),
      velocityX: Math.round(body.velocity.x),
      velocityY: Math.round(body.velocity.y),
      bodyX: Math.round(body.x),
      bodyY: Math.round(body.y),
      bodyWidth: Math.round(body.width),
      bodyHeight: Math.round(body.height)
    };
  }

  private renderHealthBars(time: number): void {
    const graphic = this.healthGraphic;

    if (graphic === null) {
      return;
    }

    graphic.clear();
    this.renderPlayerHealthBar(graphic, time);
  }

  private renderProgressionHud(): void {
    const nextRoundSeconds = Math.ceil(this.roundTransitionRemainingMs / 1000);
    const suffix =
      this.gameOver
        ? 'GAME OVER'
        : this.roundPhase === 'cleared'
          ? `NEXT ${nextRoundSeconds}`
          : formatElapsedTime(this.elapsedMs);

    this.progressionLabel?.setText(
      `R${this.currentRound} ${this.defeatedThisRound}/${this.currentRoundEnemyCount} | KO ${this.totalDefeatedCount} | ${suffix}`
    );
    this.roundBannerLabel
      ?.setText(
        this.gameOver
          ? ''
          : this.roundPhase === 'cleared'
            ? 'ROUND CLEAR'
            : `ROUND ${this.currentRound}`
      )
      .setVisible(!this.gameOver);
  }

  private renderPlayerHealthBar(graphic: Phaser.GameObjects.Graphics, time: number): void {
    const ratio = getHealthRatio(this.playerHealth, PLAYER_MAX_HEALTH);
    const fillWidth = Math.round((PLAYER_HEALTH_BAR_WIDTH - 6) * ratio);
    const color = this.getPlayerHealthColor();
    const fillAlpha = ratio <= 0.25 && Math.floor(time / 130) % 2 === 0 ? 0.32 : 1;

    graphic.fillStyle(0x050910, 0.82);
    graphic.fillRect(
      PLAYER_HEALTH_BAR_X,
      PLAYER_HEALTH_BAR_Y,
      PLAYER_HEALTH_BAR_WIDTH,
      PLAYER_HEALTH_BAR_HEIGHT
    );
    graphic.lineStyle(3, 0xf8fbff, 0.86);
    graphic.strokeRect(
      PLAYER_HEALTH_BAR_X,
      PLAYER_HEALTH_BAR_Y,
      PLAYER_HEALTH_BAR_WIDTH,
      PLAYER_HEALTH_BAR_HEIGHT
    );

    if (fillWidth > 0) {
      graphic.fillStyle(color, fillAlpha);
      graphic.fillRect(
        PLAYER_HEALTH_BAR_X + 3,
        PLAYER_HEALTH_BAR_Y + 3,
        fillWidth,
        PLAYER_HEALTH_BAR_HEIGHT - 6
      );
    }

    this.playerHealthLabel?.setText(`HP ${this.playerHealth}/${PLAYER_MAX_HEALTH}`);
  }

  private getPlayerHealthColor(): number {
    switch (getHealthBand(this.playerHealth, PLAYER_MAX_HEALTH)) {
      case 'healthy':
        return 0x35d08f;
      case 'warning':
        return 0xf6c961;
      case 'critical':
        return 0xe94b5f;
    }
  }

  private renderDebugOverlays(): void {
    const graphic = this.debugOverlayGraphic;

    if (graphic === null) {
      return;
    }

    const state = this.debug.get();
    graphic.clear();

    if (state.showLaneGuides) {
      this.renderLaneGuides(graphic);
    }

    if (state.showWorldBounds) {
      graphic.lineStyle(4, 0xf6c961, 0.95);
      graphic.strokeRect(2, 2, this.profile.width - 4, this.profile.height - 4);
    }

    if (state.showEnemyRanges) {
      for (const enemy of this.enemies) {
        if (enemy.roundActive && this.updateEnemyAttackProbeArea(enemy)) {
          this.renderAttackHitBox(
            enemy.attackProbeArea,
            this.canEnemySlashReachPlayer(enemy) ? 1 : 0,
            0xff8a65,
            0xffc857
          );
        }
      }
    }

    if (state.showVisualBounds) {
      this.renderVisualBounds(
        this.player,
        'mainNinja',
        this.facingDirection,
        this.getPlayerBoundsAction(),
        0x8fffad
      );
      for (const enemy of this.enemies) {
        if (!enemy.roundActive || !enemy.sprite.active) {
          continue;
        }

        this.renderVisualBounds(
          enemy.sprite,
          'enemyNinja',
          enemy.facingDirection,
          this.getEnemyBoundsAction(enemy),
          0xff91d0
        );
      }
    }

    if (state.showHitBoxes) {
      this.renderPhysicsBody(this.player, 0x35d08f);
      for (const enemy of this.enemies) {
        if (!enemy.roundActive || !enemy.sprite.active) {
          continue;
        }

        this.renderPhysicsBody(enemy.sprite, 0xe56b6f);
      }
    }

    if (state.showAttackBoxes) {
      if (this.isPlayerAttackReachFrame()) {
        this.renderAttackHitBox(this.attackHitArea, this.attackHitCount, 0x7ed7ff, 0xffc857);
      }

      for (const enemy of this.enemies) {
        if (enemy.roundActive && this.isEnemyAttackReachFrame(enemy)) {
          this.renderAttackHitBox(
            enemy.attackHitArea,
            enemy.attackHitCount,
            0xff91d0,
            0xffc857
          );
        }
      }
    }

    if (state.showOrigins) {
      this.renderOrigin(this.player, 0x8fffad);
      for (const enemy of this.enemies) {
        if (!enemy.roundActive || !enemy.sprite.active) {
          continue;
        }

        this.renderOrigin(enemy.sprite, 0xff91d0);
      }
    }

    if (state.showPointerProbe) {
      this.renderCrosshair(state.pointer.worldX, state.pointer.worldY, 12, 0xffffff, 0.85);
    }
  }

  private renderLaneGuides(graphic: Phaser.GameObjects.Graphics): void {
    const laneColors: Record<PlayerLaneId, number> = {
      upper: 0x64b5ff,
      middle: 0xf6c961,
      lower: 0x35d08f
    };

    for (const lane of this.getLaneLayout().lanes) {
      const isMiddle = lane.id === 'middle';
      const color = laneColors[lane.id];

      graphic.lineStyle(isMiddle ? 3 : 2, color, isMiddle ? 0.78 : 0.58);
      graphic.lineBetween(0, lane.y, this.profile.width, lane.y);
      graphic.fillStyle(color, isMiddle ? 0.95 : 0.82);
      graphic.fillCircle(32, lane.y, isMiddle ? 5 : 4);
      graphic.fillCircle(this.profile.width - 32, lane.y, isMiddle ? 5 : 4);
    }
  }

  private renderVisualBounds(
    sprite: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null,
    actorId: 'mainNinja' | 'enemyNinja',
    direction: FacingDirection,
    action: string,
    color: number
  ): void {
    if (sprite === null || this.debugOverlayGraphic === null) {
      return;
    }

    const bounds = this.getWorldRectFromFrameRect(
      sprite,
      getNinjaAnimationBounds(
        this.app.getNinjaBoundsConfig(),
        actorId,
        direction,
        action
      ).visual,
      this.visualBoundsRect
    );
    this.debugOverlayGraphic.lineStyle(2, color, 0.78);
    this.debugOverlayGraphic.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
  }

  private getWorldRectFromFrameRect(
    actor: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody,
    rect: NinjaRect,
    out: Phaser.Geom.Rectangle
  ): Phaser.Geom.Rectangle {
    const scale = actor.scaleX;
    const frameLeft = actor.x - (NINJA_FRAME_SIZE / 2) * scale;
    const frameTop = actor.y - NINJA_FRAME_SIZE * scale;

    return out.setTo(
      frameLeft + rect.x * scale,
      frameTop + rect.y * scale,
      rect.width * scale,
      rect.height * scale
    );
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
