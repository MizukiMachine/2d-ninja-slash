import Phaser from 'phaser';

/**
 * SceneJuice bundles the "game feel" presentation effects that make combat read
 * with weight: a noise-based camera shake, hitstop (brief time freeze), a
 * full-screen colour flash, and pooled particle bursts.
 *
 * It is intentionally decoupled from gameplay logic. The owning scene calls the
 * trigger methods (`shake`, `hitstop`, `flash`, `burst*`) from combat events and
 * drives the controller once per frame via `update(deltaMs)`. Hitstop is driven
 * by real (unscaled) delta so it always resolves even while physics/animations
 * are frozen.
 */

const SPARK_TEXTURE_KEY = 'fx.juice.spark';
const GLINT_TEXTURE_KEY = 'fx.juice.glint';

const FX_DEPTH = 100;
const FLASH_DEPTH = 200;

// Camera shake (trauma model — offset scales with trauma squared and decays).
const SHAKE_MAX_OFFSET = 16;
const SHAKE_DECAY_PER_SECOND = 1.6;
const SHAKE_FREQUENCY_HZ = 24;
const SHAKE_SEED_X = 1.37;
const SHAKE_SEED_Y = 8.91;

// HUD shake is independent of the world shake: the world can stay calm while
// the HUD gives a noticeable jolt to flag a defeat. Slightly snappier and a
// touch larger, with its own noise seeds so the two never move in lockstep.
const HUD_SHAKE_MAX_OFFSET = 13;
const HUD_SHAKE_DECAY_PER_SECOND = 2.4;
const HUD_SHAKE_FREQUENCY_HZ = 26;
const HUD_SHAKE_SEED_X = 4.21;
const HUD_SHAKE_SEED_Y = 6.53;

// Low-saturation silver/white — a moonlit blade glint rather than confetti.
const DEFEAT_GLINT_TINTS = [0xffffff, 0xeaf2ff, 0xcfd6e0, 0xaab8d0];

// The glint streaks fire as a tight cone along the slash; ±X by facing.
const GLINT_CONE_HALF_ANGLE = 22;

export class SceneJuice {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  private shakeTrauma = 0;
  private shakeTimeMs = 0;

  // Optional HUD layer shaken separately from the world (see attachHud).
  private hudContainer: Phaser.GameObjects.Container | null = null;
  private hudShakeTrauma = 0;
  private hudShakeTimeMs = 0;

  private hitstopRemainingMs = 0;
  private frozen = false;

  private flashRect: Phaser.GameObjects.Rectangle;
  private flashTween: Phaser.Tweens.Tween | null = null;

  private readonly sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly glintEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.camera = scene.cameras.main;

    this.ensureTextures();

    const { width, height } = scene.scale;
    this.flashRect = scene.add
      .rectangle(width / 2, height / 2, width, height, 0xffffff, 1)
      .setScrollFactor(0)
      .setDepth(FLASH_DEPTH)
      .setAlpha(0)
      .setVisible(false);

    this.sparkEmitter = scene.add
      .particles(0, 0, SPARK_TEXTURE_KEY, {
        lifespan: { min: 220, max: 420 },
        speed: { min: 120, max: 340 },
        angle: { min: 0, max: 360 },
        scale: { start: 0.9, end: 0 },
        alpha: { start: 1, end: 0 },
        blendMode: 'ADD',
        emitting: false
      })
      .setDepth(FX_DEPTH);

    // Few, fast, short-lived silver streaks fired in a tight directional cone:
    // a blade glint that flicks along the cut and fades, not a confetti pop.
    this.glintEmitter = scene.add
      .particles(0, 0, GLINT_TEXTURE_KEY, {
        lifespan: { min: 100, max: 200 },
        speed: { min: 260, max: 480 },
        angle: { min: -GLINT_CONE_HALF_ANGLE, max: GLINT_CONE_HALF_ANGLE },
        scale: 1,
        alpha: { start: 0.95, end: 0 },
        rotate: { min: -GLINT_CONE_HALF_ANGLE, max: GLINT_CONE_HALF_ANGLE },
        blendMode: 'ADD',
        tint: DEFEAT_GLINT_TINTS,
        emitting: false
      })
      .setDepth(FX_DEPTH + 1);
  }

  /** Add camera-shake trauma (0..1). Multiple hits accumulate up to 1. */
  shake(trauma: number): void {
    this.shakeTrauma = Phaser.Math.Clamp(this.shakeTrauma + trauma, 0, 1);
  }

  /**
   * Register a HUD container (positioned at the origin) to be shaken
   * independently of the world via {@link shakeHud}. Its base position is
   * assumed to be (0, 0); the shake writes a small offset onto it each frame.
   */
  attachHud(container: Phaser.GameObjects.Container): void {
    this.hudContainer = container;
  }

  /** Add HUD-shake trauma (0..1). Independent of the world camera shake. */
  shakeHud(trauma: number): void {
    this.hudShakeTrauma = Phaser.Math.Clamp(this.hudShakeTrauma + trauma, 0, 1);
  }

  /** Freeze gameplay for the given duration. The longest pending request wins. */
  hitstop(durationMs: number): void {
    if (durationMs <= 0) {
      return;
    }

    this.hitstopRemainingMs = Math.max(this.hitstopRemainingMs, durationMs);
    this.applyFreeze(true);
  }

  /** True while a hitstop freeze is active; the scene should skip its update. */
  isFrozen(): boolean {
    return this.frozen;
  }

  /** Flash the whole screen with a colour that fades out. */
  flash(color: number, alpha: number, durationMs: number): void {
    this.flashTween?.stop();
    this.flashRect
      .setFillStyle(color, 1)
      .setVisible(true)
      .setAlpha(Phaser.Math.Clamp(alpha, 0, 1));
    this.flashTween = this.scene.tweens.add({
      targets: this.flashRect,
      alpha: 0,
      duration: durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.flashRect.setVisible(false);
        this.flashTween = null;
      }
    });
  }

  /** Small additive spark burst, e.g. when a blade connects. */
  burstHitSpark(x: number, y: number, scale = 1): void {
    const sparkScale = 0.7 * scale;
    this.sparkEmitter.setParticleScale(sparkScale, sparkScale);
    this.sparkEmitter.explode(Phaser.Math.Between(6, 9), x, y);
  }

  /**
   * Enemy defeat: a directional silver blade-glint along the slash plus a tight
   * core flash at the point of impact. `directionX` is the slash direction
   * (sign of X); positive fires the streaks rightward, negative leftward.
   */
  burstEnemyDefeat(x: number, y: number, scale = 1, directionX = 1): void {
    const rightward = directionX >= 0;
    this.glintEmitter.setEmitterAngle(
      rightward
        ? { min: -GLINT_CONE_HALF_ANGLE, max: GLINT_CONE_HALF_ANGLE }
        : { min: 180 - GLINT_CONE_HALF_ANGLE, max: 180 + GLINT_CONE_HALF_ANGLE }
    );
    this.glintEmitter.setParticleScale(scale, scale);
    this.glintEmitter.explode(Phaser.Math.Between(2, 4), x, y);

    // Small, tight core flash — the spark of the cut, not a burst of debris.
    const coreScale = 0.16 * scale;
    this.sparkEmitter.setParticleScale(coreScale, coreScale);
    this.sparkEmitter.explode(Phaser.Math.Between(1, 2), x, y);
  }

  update(deltaMs: number): void {
    this.updateHitstop(deltaMs);
    this.updateShake(deltaMs);
    this.updateHudShake(deltaMs);
  }

  /** Reset transient runtime state (freeze, shake, flash) without tearing down. */
  clear(): void {
    this.hitstopRemainingMs = 0;
    this.applyFreeze(false);
    this.shakeTrauma = 0;
    this.shakeTimeMs = 0;
    this.camera.setScroll(0, 0);
    this.hudShakeTrauma = 0;
    this.hudShakeTimeMs = 0;
    this.hudContainer?.setPosition(0, 0);
    this.flashTween?.stop();
    this.flashTween = null;
    this.flashRect.setAlpha(0).setVisible(false);
  }

  /** Restore any global state this controller mutated. */
  destroy(): void {
    this.clear();
  }

  private updateHitstop(deltaMs: number): void {
    if (!this.frozen) {
      return;
    }

    this.hitstopRemainingMs -= deltaMs;

    if (this.hitstopRemainingMs <= 0) {
      this.hitstopRemainingMs = 0;
      this.applyFreeze(false);
    }
  }

  /**
   * Freeze or thaw every time-driven subsystem so a hitstop reads as a true
   * time stop: physics, sprite animations, tweens (flash/blink) and the
   * particle simulations all halt together.
   */
  private applyFreeze(frozen: boolean): void {
    if (this.frozen === frozen) {
      return;
    }

    this.frozen = frozen;
    const timeScale = frozen ? 0 : 1;

    if (frozen) {
      this.scene.physics.world.pause();
    } else {
      this.scene.physics.world.resume();
    }

    this.scene.anims.globalTimeScale = timeScale;
    this.scene.tweens.timeScale = timeScale;
    this.sparkEmitter.timeScale = timeScale;
    this.glintEmitter.timeScale = timeScale;
  }

  private updateShake(deltaMs: number): void {
    if (this.shakeTrauma <= 0) {
      if (this.camera.scrollX !== 0 || this.camera.scrollY !== 0) {
        this.camera.setScroll(0, 0);
      }
      return;
    }

    this.shakeTimeMs += deltaMs;
    this.shakeTrauma = Math.max(
      0,
      this.shakeTrauma - (SHAKE_DECAY_PER_SECOND * deltaMs) / 1000
    );

    const amount = this.shakeTrauma * this.shakeTrauma;
    const phase = (this.shakeTimeMs / 1000) * SHAKE_FREQUENCY_HZ;
    const offsetX = SHAKE_MAX_OFFSET * amount * this.noise(SHAKE_SEED_X, phase);
    const offsetY = SHAKE_MAX_OFFSET * amount * this.noise(SHAKE_SEED_Y, phase);

    this.camera.setScroll(offsetX, offsetY);
  }

  private updateHudShake(deltaMs: number): void {
    const hud = this.hudContainer;
    if (hud === null) {
      return;
    }

    if (this.hudShakeTrauma <= 0) {
      if (hud.x !== 0 || hud.y !== 0) {
        hud.setPosition(0, 0);
      }
      return;
    }

    this.hudShakeTimeMs += deltaMs;
    this.hudShakeTrauma = Math.max(
      0,
      this.hudShakeTrauma - (HUD_SHAKE_DECAY_PER_SECOND * deltaMs) / 1000
    );

    const amount = this.hudShakeTrauma * this.hudShakeTrauma;
    const phase = (this.hudShakeTimeMs / 1000) * HUD_SHAKE_FREQUENCY_HZ;
    const offsetX = HUD_SHAKE_MAX_OFFSET * amount * this.noise(HUD_SHAKE_SEED_X, phase);
    const offsetY = HUD_SHAKE_MAX_OFFSET * amount * this.noise(HUD_SHAKE_SEED_Y, phase);

    hud.setPosition(offsetX, offsetY);
  }

  /** Smooth 1D value noise in [-1, 1] so the shake reads organic, not jittery. */
  private noise(seed: number, t: number): number {
    const i = Math.floor(t);
    const f = t - i;
    const u = f * f * (3 - 2 * f);
    const a = this.hash(seed, i);
    const b = this.hash(seed, i + 1);
    return (a + (b - a) * u) * 2 - 1;
  }

  private hash(seed: number, n: number): number {
    const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return x - Math.floor(x);
  }

  private ensureTextures(): void {
    const textures = this.scene.textures;

    if (!textures.exists(SPARK_TEXTURE_KEY)) {
      const spark = this.scene.make.graphics({ x: 0, y: 0 }, false);
      spark.fillStyle(0xffffff, 0.35);
      spark.fillCircle(10, 10, 10);
      spark.fillStyle(0xffffff, 1);
      spark.fillCircle(10, 10, 5);
      spark.generateTexture(SPARK_TEXTURE_KEY, 20, 20);
      spark.destroy();
    }

    if (!textures.exists(GLINT_TEXTURE_KEY)) {
      // An elongated horizontal lens: soft halo around a thin bright core, so a
      // tinted, additively-blended particle reads as a sharp blade streak.
      const glint = this.scene.make.graphics({ x: 0, y: 0 }, false);
      glint.fillStyle(0xffffff, 0.25);
      glint.fillEllipse(24, 8, 40, 4);
      glint.fillStyle(0xffffff, 1);
      glint.fillEllipse(24, 8, 30, 1.4);
      glint.generateTexture(GLINT_TEXTURE_KEY, 48, 16);
      glint.destroy();
    }
  }
}
