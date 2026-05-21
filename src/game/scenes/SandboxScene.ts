import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';

type FacingDirection = 'left' | 'right';
type NinjaAction = 'idle' | 'walk' | 'slash' | 'impact';

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

const BACKGROUND_KEY = 'background.darkCathedralCourtyardBalancedPixel';
const BACKGROUND_URL = '/assets/backgrounds/dark-cathedral-courtyard-balanced-pixel.png';
const MAIN_NINJA_ASSET_URL = '/assets/actors/main-ninja';
const NINJA_FRAME_SIZE = 512;
const NINJA_SCALE = 0.58;
const NINJA_SPEED = 260;
const IMPACT_ADVANCE_SPEED = 210;
const IMPACT_HIT_RADIUS = 168;
const IMPACT_HIT_Y_OFFSET = -82;
const NINJA_BODY = {
  width: 132,
  height: 148,
  offsetX: 190,
  offsetY: 324
} as const;

const getMainNinjaSpritesheetUrl = (action: NinjaAction, direction: FacingDirection): string =>
  `${MAIN_NINJA_ASSET_URL}/${action}-${direction}.png`;

const NINJA_ANIMATIONS: readonly NinjaAnimationConfig[] = [
  {
    action: 'idle',
    direction: 'left',
    textureKey: 'character.mainNinja.left.idle.spritesheet',
    animationKey: 'anim.mainNinja.left.idle',
    url: getMainNinjaSpritesheetUrl('idle', 'left'),
    frameCount: 16,
    frameRate: 8,
    repeat: -1
  },
  {
    action: 'idle',
    direction: 'right',
    textureKey: 'character.mainNinja.right.idle.spritesheet',
    animationKey: 'anim.mainNinja.right.idle',
    url: getMainNinjaSpritesheetUrl('idle', 'right'),
    frameCount: 16,
    frameRate: 8,
    repeat: -1
  },
  {
    action: 'walk',
    direction: 'left',
    textureKey: 'character.mainNinja.left.walk.spritesheet',
    animationKey: 'anim.mainNinja.left.walk',
    url: getMainNinjaSpritesheetUrl('walk', 'left'),
    frameCount: 16,
    frameRate: 12,
    repeat: -1
  },
  {
    action: 'walk',
    direction: 'right',
    textureKey: 'character.mainNinja.right.walk.spritesheet',
    animationKey: 'anim.mainNinja.right.walk',
    url: getMainNinjaSpritesheetUrl('walk', 'right'),
    frameCount: 16,
    frameRate: 12,
    repeat: -1
  },
  {
    action: 'slash',
    direction: 'left',
    textureKey: 'character.mainNinja.left.slash.spritesheet',
    animationKey: 'anim.mainNinja.left.slash',
    url: getMainNinjaSpritesheetUrl('slash', 'left'),
    frameCount: 16,
    frameRate: 12,
    repeat: 0
  },
  {
    action: 'slash',
    direction: 'right',
    textureKey: 'character.mainNinja.right.slash.spritesheet',
    animationKey: 'anim.mainNinja.right.slash',
    url: getMainNinjaSpritesheetUrl('slash', 'right'),
    frameCount: 16,
    frameRate: 12,
    repeat: 0
  },
  {
    action: 'impact',
    direction: 'left',
    textureKey: 'character.mainNinja.left.impact.spritesheet',
    animationKey: 'anim.mainNinja.left.impact',
    url: getMainNinjaSpritesheetUrl('impact', 'left'),
    frameCount: 32,
    frameRate: 16,
    repeat: 0
  },
  {
    action: 'impact',
    direction: 'right',
    textureKey: 'character.mainNinja.right.impact.spritesheet',
    animationKey: 'anim.mainNinja.right.impact',
    url: getMainNinjaSpritesheetUrl('impact', 'right'),
    frameCount: 32,
    frameRate: 16,
    repeat: 0
  }
] as const;

export class SandboxScene extends BaseScene {
  private player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody | null = null;
  private moveKeys: MoveKeys | null = null;
  private boundsGraphic: Phaser.GameObjects.Graphics | null = null;
  private attackGraphic: Phaser.GameObjects.Graphics | null = null;
  private pauseLabel: Phaser.GameObjects.Text | null = null;
  private facingDirection: FacingDirection = 'right';
  private currentAction: NinjaAction = 'idle';
  private forwardVector = new Phaser.Math.Vector2(1, 0);
  private impactHitArea = new Phaser.Geom.Circle(0, 0, IMPACT_HIT_RADIUS);

  constructor() {
    super(SceneKeys.Sandbox);
  }

  preload(): void {
    if (!this.textures.exists(BACKGROUND_KEY)) {
      this.load.image(BACKGROUND_KEY, BACKGROUND_URL);
    }

    for (const animation of NINJA_ANIMATIONS) {
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
    this.registerPointerDebug();
    this.onStore(this.debug, (state) => {
      this.renderWorldBounds(state.showWorldBounds);
      this.pauseLabel?.setVisible(state.paused);
      this.player?.setAlpha(state.paused ? 0.55 : 1);
    });
  }

  update(_time: number, _delta: number): void {
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
      return;
    }

    if (this.currentAction === 'slash') {
      this.player.setVelocity(0, 0);
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
    const background = this.add.image(this.centerX, this.centerY, BACKGROUND_KEY).setOrigin(0.5);
    const scale = Math.max(this.profile.width / background.width, this.profile.height / background.height);

    background.setScale(scale).setDepth(-10);
  }

  private createAnimations(): void {
    for (const animation of NINJA_ANIMATIONS) {
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
      if (animation.key.endsWith('.slash') || animation.key.endsWith('.impact')) {
        this.finishAttack();
      }
    };

    this.player.on('animationcomplete', completeAttack);
    this.trackCleanup(() => {
      this.player?.off('animationcomplete', completeAttack);
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
    this.playNinjaAnimation('walk');
  }

  private startAttack(action: 'slash' | 'impact'): void {
    if (this.player === null || this.currentAction === 'slash' || this.currentAction === 'impact') {
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
