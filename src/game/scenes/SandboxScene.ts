import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';

type FacingDirection = 'left' | 'right';
type NinjaAction = 'idle' | 'run' | 'slash' | 'impact';
type PlayerAction = NinjaAction | 'hurt';
type EnemyAction = 'idle' | 'run' | 'slash' | 'recover';

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
  readonly esc: Phaser.Input.Keyboard.Key;
}

interface NinjaAnimationConfig {
  readonly action: NinjaAction;
  readonly direction: FacingDirection;
  readonly textureKey: string;
  readonly animationKey: string;
  readonly url: string;
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

const MAIN_NINJA_ASSET_URL = '/assets/actors/main-ninja';
const ENEMY_NINJA_ASSET_URL = '/assets/actors/enemy-ninja';
const NINJA_FRAME_SIZE = 216;
const NINJA_FRAME_COUNT = 32;
const NINJA_ANIMATION_PLAYBACK_RATE = 3;
const NINJA_SCALE = 1.38;
const ENEMY_NINJA_SCALE = NINJA_SCALE * 1.14;
const NINJA_SPEED = 260;
const ENEMY_NINJA_SPEED = NINJA_SPEED;
const ENEMY_ATTACK_RANGE = 112;
const ENEMY_ATTACK_RECOVERY_MS = 900;
const PLAYER_DAMAGE_KNOCKBACK_SPEED = 360;
const IMPACT_ADVANCE_SPEED = 210;
const IMPACT_HIT_RADIUS = 168;
const IMPACT_HIT_Y_OFFSET = -82;
const NINJA_BODY = {
  width: 56,
  height: 62,
  offsetX: 80,
  offsetY: 137
} as const;

const getMainNinjaSpritesheetUrl = (action: NinjaAction, direction: FacingDirection): string =>
  `${MAIN_NINJA_ASSET_URL}/${action}-${direction}.png`;

const getEnemyNinjaSpritesheetUrl = (
  action: Exclude<NinjaAction, 'impact'>,
  direction: FacingDirection
): string => `${ENEMY_NINJA_ASSET_URL}/${action}-${direction}.png`;

const NINJA_ANIMATIONS: readonly NinjaAnimationConfig[] = [
  {
    action: 'idle',
    direction: 'left',
    textureKey: 'character.mainNinja.left.idle.spritesheet',
    animationKey: 'anim.mainNinja.left.idle',
    url: getMainNinjaSpritesheetUrl('idle', 'left'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'idle',
    direction: 'right',
    textureKey: 'character.mainNinja.right.idle.spritesheet',
    animationKey: 'anim.mainNinja.right.idle',
    url: getMainNinjaSpritesheetUrl('idle', 'right'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'left',
    textureKey: 'character.mainNinja.left.run.spritesheet',
    animationKey: 'anim.mainNinja.left.run',
    url: getMainNinjaSpritesheetUrl('run', 'left'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'right',
    textureKey: 'character.mainNinja.right.run.spritesheet',
    animationKey: 'anim.mainNinja.right.run',
    url: getMainNinjaSpritesheetUrl('run', 'right'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'slash',
    direction: 'left',
    textureKey: 'character.mainNinja.left.slash.spritesheet',
    animationKey: 'anim.mainNinja.left.slash',
    url: getMainNinjaSpritesheetUrl('slash', 'left'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash',
    direction: 'right',
    textureKey: 'character.mainNinja.right.slash.spritesheet',
    animationKey: 'anim.mainNinja.right.slash',
    url: getMainNinjaSpritesheetUrl('slash', 'right'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'impact',
    direction: 'left',
    textureKey: 'character.mainNinja.left.impact.spritesheet',
    animationKey: 'anim.mainNinja.left.impact',
    url: getMainNinjaSpritesheetUrl('impact', 'left'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 16 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'impact',
    direction: 'right',
    textureKey: 'character.mainNinja.right.impact.spritesheet',
    animationKey: 'anim.mainNinja.right.impact',
    url: getMainNinjaSpritesheetUrl('impact', 'right'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 16 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  }
] as const;

const ENEMY_NINJA_ANIMATIONS: readonly NinjaAnimationConfig[] = [
  {
    action: 'idle',
    direction: 'left',
    textureKey: 'character.enemyNinja.left.idle.spritesheet',
    animationKey: 'anim.enemyNinja.left.idle',
    url: getEnemyNinjaSpritesheetUrl('idle', 'left'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'idle',
    direction: 'right',
    textureKey: 'character.enemyNinja.right.idle.spritesheet',
    animationKey: 'anim.enemyNinja.right.idle',
    url: getEnemyNinjaSpritesheetUrl('idle', 'right'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 8 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'left',
    textureKey: 'character.enemyNinja.left.run.spritesheet',
    animationKey: 'anim.enemyNinja.left.run',
    url: getEnemyNinjaSpritesheetUrl('run', 'left'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'run',
    direction: 'right',
    textureKey: 'character.enemyNinja.right.run.spritesheet',
    animationKey: 'anim.enemyNinja.right.run',
    url: getEnemyNinjaSpritesheetUrl('run', 'right'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: -1
  },
  {
    action: 'slash',
    direction: 'left',
    textureKey: 'character.enemyNinja.left.slash.spritesheet',
    animationKey: 'anim.enemyNinja.left.slash',
    url: getEnemyNinjaSpritesheetUrl('slash', 'left'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  },
  {
    action: 'slash',
    direction: 'right',
    textureKey: 'character.enemyNinja.right.slash.spritesheet',
    animationKey: 'anim.enemyNinja.right.slash',
    url: getEnemyNinjaSpritesheetUrl('slash', 'right'),
    frameCount: NINJA_FRAME_COUNT,
    frameRate: 12 * NINJA_ANIMATION_PLAYBACK_RATE,
    repeat: 0
  }
] as const;

export class SandboxScene extends BaseScene {
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private enemy: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private moveKeys: MoveKeys | null = null;
  private boundsGraphic: Phaser.GameObjects.Graphics | null = null;
  private attackGraphic: Phaser.GameObjects.Graphics | null = null;
  private pauseLabel: Phaser.GameObjects.Text | null = null;
  private facingDirection: FacingDirection = 'right';
  private enemyFacingDirection: FacingDirection = 'left';
  private currentAction: PlayerAction = 'idle';
  private enemyAction: EnemyAction = 'idle';
  private enemyRecoveryUntil = 0;
  private forwardVector = new Phaser.Math.Vector2(1, 0);
  private damageKnockbackVector = new Phaser.Math.Vector2(0, 0);
  private impactHitArea = new Phaser.Geom.Circle(0, 0, IMPACT_HIT_RADIUS);

  constructor() {
    super(SceneKeys.Sandbox);
  }

  preload(): void {
    for (const animation of [...NINJA_ANIMATIONS, ...ENEMY_NINJA_ANIMATIONS]) {
      if (this.textures.exists(animation.textureKey)) {
        continue;
      }

      this.load.spritesheet(animation.textureKey, animation.url, {
        frameWidth: NINJA_FRAME_SIZE,
        frameHeight: NINJA_FRAME_SIZE,
        margin: 0,
        spacing: 0,
        startFrame: 0,
        endFrame: animation.frameCount - 1
      });
    }
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.createAnimations();
    this.createBackground();
    this.physics.world.setBounds(0, 0, this.profile.width, this.profile.height);

    this.player = this.physics.add.sprite(
      this.centerX,
      this.centerY + 108,
      'character.mainNinja.right.idle.spritesheet',
      0
    );
    this.player
      .setOrigin(0.5, 1)
      .setScale(NINJA_SCALE)
      .setCollideWorldBounds(true)
      .setBodySize(NINJA_BODY.width, NINJA_BODY.height, false)
      .setOffset(NINJA_BODY.offsetX, NINJA_BODY.offsetY)
      .setDepth(10)
      .play('anim.mainNinja.right.idle');

    const enemyX = Phaser.Math.Clamp(this.centerX + 320, 120, this.profile.width - 120);

    this.enemy = this.physics.add.sprite(
      enemyX,
      this.centerY + 108,
      'character.enemyNinja.left.idle.spritesheet',
      0
    );
    this.enemy
      .setOrigin(0.5, 1)
      .setScale(ENEMY_NINJA_SCALE)
      .setCollideWorldBounds(true)
      .setBodySize(NINJA_BODY.width, NINJA_BODY.height, false)
      .setOffset(NINJA_BODY.offsetX, NINJA_BODY.offsetY)
      .setDepth(9)
      .play('anim.enemyNinja.left.idle');

    this.physics.add.collider(this.player, this.enemy);

    this.boundsGraphic = this.add.graphics();
    this.attackGraphic = this.add.graphics().setDepth(9);
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
      this.renderWorldBounds(state.showWorldBounds);
      this.pauseLabel?.setVisible(state.paused);
      this.player?.setAlpha(state.paused ? 0.55 : 1);
      this.enemy?.setAlpha(state.paused ? 0.55 : 1);
    });
  }

  update(time: number, _delta: number): void {
    if (this.player === null || this.moveKeys === null) {
      return;
    }

    const movement = this.readMovementInput();

    this.debug.setInput({
      left: movement.left,
      right: movement.right,
      up: movement.up,
      down: movement.down
    });

    if (this.debug.get().paused) {
      this.player.setVelocity(0, 0);
      this.enemy?.setVelocity(0, 0);
      return;
    }

    this.updateEnemy(time);

    if (this.currentAction === 'slash') {
      this.player.setVelocity(0, 0);
      return;
    }

    if (this.currentAction === 'hurt') {
      this.player.setVelocity(
        this.damageKnockbackVector.x * PLAYER_DAMAGE_KNOCKBACK_SPEED,
        this.damageKnockbackVector.y * PLAYER_DAMAGE_KNOCKBACK_SPEED
      );
      return;
    }

    if (this.currentAction === 'impact') {
      this.player.setVelocity(
        this.forwardVector.x * IMPACT_ADVANCE_SPEED,
        this.forwardVector.y * IMPACT_ADVANCE_SPEED
      );
      this.updateImpactHitArea();
      return;
    }

    this.movePlayer(movement);
  }

  private createBackground(): void {
    const { width, height } = this.profile;
    const background = this.add.graphics().setDepth(-10);

    background.fillStyle(0x071018, 1);
    background.fillRect(0, 0, width, height);
    background.fillStyle(0x0d1d2a, 1);
    background.fillRect(0, height * 0.55, width, height * 0.45);
    background.fillStyle(0x10283a, 1);
    background.fillRect(0, height * 0.53, width, 14);
    background.fillStyle(0x142336, 0.85);

    for (let x = -24; x < width; x += 118) {
      background.fillRect(x, height * 0.14, 42, height * 0.42);
    }

    background.fillStyle(0x1b7c85, 0.18);
    background.fillCircle(width * 0.78, height * 0.18, 86);
    background.fillStyle(0x172337, 0.9);
    background.fillRect(0, height * 0.74, width, height * 0.26);
    background.lineStyle(2, 0x1f5b67, 0.35);

    for (let x = -80; x < width; x += 96) {
      background.lineBetween(x, height, x + 170, height * 0.74);
    }
  }

  private createAnimations(): void {
    for (const animation of [...NINJA_ANIMATIONS, ...ENEMY_NINJA_ANIMATIONS]) {
      if (this.anims.exists(animation.animationKey)) {
        continue;
      }

      this.anims.create({
        key: animation.animationKey,
        frames: this.anims.generateFrameNumbers(animation.textureKey, {
          start: 0,
          end: animation.frameCount - 1
        }),
        frameRate: animation.frameRate,
        repeat: animation.repeat
      });
    }
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
      this.startAttack(this.moveKeys?.shift.isDown === true ? 'impact' : 'slash');
    };

    keyboard.on('keydown', syncLastKey);
    escKey.on('down', goBackToMenu);
    this.moveKeys.z.on('down', startAttack);

    this.trackCleanup(() => {
      keyboard.off('keydown', syncLastKey);
      escKey.off('down', goBackToMenu);
      this.moveKeys?.z.off('down', startAttack);
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

      if (animation.key.endsWith('.slash') || animation.key.endsWith('.impact')) {
        this.finishAttack();
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

  private startAttack(action: 'slash' | 'impact'): void {
    if (
      this.player === null ||
      this.currentAction === 'slash' ||
      this.currentAction === 'impact' ||
      this.currentAction === 'hurt'
    ) {
      return;
    }

    const movement = this.readMovementInput();

    if (movement.x !== 0 || movement.y !== 0) {
      this.forwardVector.set(movement.x, movement.y).normalize();
      this.updateFacingFromVector(this.forwardVector);
    }

    this.currentAction = action;
    this.player.setVelocity(
      action === 'impact' ? this.forwardVector.x * IMPACT_ADVANCE_SPEED : 0,
      action === 'impact' ? this.forwardVector.y * IMPACT_ADVANCE_SPEED : 0
    );
    this.playNinjaAnimation(action, true);

    if (action === 'impact') {
      this.updateImpactHitArea();
      return;
    }

    this.clearAttackHitArea();
  }

  private finishAttack(): void {
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
    this.enemy.setVelocity(0, 0);
    this.updateEnemyFacingFromVector(
      new Phaser.Math.Vector2(this.player.x - this.enemy.x, this.player.y - this.enemy.y)
    );
    this.playEnemyAnimation('slash', true);
    this.damagePlayerFromEnemy();
  }

  private startEnemyRecovery(): void {
    if (this.enemy === null) {
      return;
    }

    this.enemyAction = 'recover';
    this.enemyRecoveryUntil = this.time.now + ENEMY_ATTACK_RECOVERY_MS;
    this.enemy.setVelocity(0, 0);
    this.playEnemyAnimation('idle', true);
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
    this.player.play(`anim.mainNinja.${this.facingDirection}.impact`, false);
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

  private playNinjaAnimation(action: NinjaAction, restart = false): void {
    if (this.player === null) {
      return;
    }

    const animationKey = `anim.mainNinja.${this.facingDirection}.${action}`;

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

  private playEnemyAnimation(action: Exclude<NinjaAction, 'impact'>, restart = false): void {
    if (this.enemy === null) {
      return;
    }

    const animationKey = `anim.enemyNinja.${this.enemyFacingDirection}.${action}`;

    if (!restart && this.enemy.anims.currentAnim?.key === animationKey) {
      return;
    }

    if (action !== 'idle' || this.enemyAction !== 'recover') {
      this.enemyAction = action;
    }

    this.enemy.play(animationKey, !restart);
  }

  private updateImpactHitArea(): void {
    if (this.player === null) {
      return;
    }

    const centerX = this.player.x;
    const centerY = this.player.y + IMPACT_HIT_Y_OFFSET;
    this.impactHitArea.setTo(centerX, centerY, IMPACT_HIT_RADIUS);

    const bodies: readonly (Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody)[] =
      this.physics.overlapCirc(centerX, centerY, IMPACT_HIT_RADIUS);
    const hitCount = bodies.filter((body) => body.gameObject !== this.player).length;

    this.renderAttackHitArea(hitCount);
  }

  private renderAttackHitArea(hitCount: number): void {
    if (this.attackGraphic === null) {
      return;
    }

    this.attackGraphic.clear();
    this.attackGraphic.fillStyle(hitCount > 0 ? 0xffc857 : 0x7ed7ff, 0.12);
    this.attackGraphic.lineStyle(3, hitCount > 0 ? 0xffc857 : 0x7ed7ff, 0.72);
    this.attackGraphic.fillCircleShape(this.impactHitArea);
    this.attackGraphic.strokeCircleShape(this.impactHitArea);
  }

  private clearAttackHitArea(): void {
    this.attackGraphic?.clear();
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

  private renderWorldBounds(visible: boolean): void {
    if (this.boundsGraphic === null) {
      return;
    }

    this.boundsGraphic.clear();

    if (!visible) {
      return;
    }

    this.boundsGraphic.lineStyle(4, 0xf6c961, 0.95);
    this.boundsGraphic.strokeRect(2, 2, this.profile.width - 4, this.profile.height - 4);
  }
}
