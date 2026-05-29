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
const SHARD_TEXTURE_KEY = 'fx.juice.shard';

const FX_DEPTH = 100;
const FLASH_DEPTH = 200;

// Camera shake (trauma model — offset scales with trauma squared and decays).
const SHAKE_MAX_OFFSET = 16;
const SHAKE_DECAY_PER_SECOND = 1.6;
const SHAKE_FREQUENCY_HZ = 24;
const SHAKE_SEED_X = 1.37;
const SHAKE_SEED_Y = 8.91;

const DEFEAT_DEBRIS_TINTS = [0xff5a3c, 0xffb24a, 0xfff0c2, 0xffffff];

export class SceneJuice {
  private readonly scene: Phaser.Scene;
  private readonly camera: Phaser.Cameras.Scene2D.Camera;

  private shakeTrauma = 0;
  private shakeTimeMs = 0;

  private hitstopRemainingMs = 0;
  private frozen = false;

  private flashRect: Phaser.GameObjects.Rectangle;
  private flashTween: Phaser.Tweens.Tween | null = null;

  private readonly sparkEmitter: Phaser.GameObjects.Particles.ParticleEmitter;
  private readonly debrisEmitter: Phaser.GameObjects.Particles.ParticleEmitter;

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

    this.debrisEmitter = scene.add
      .particles(0, 0, SHARD_TEXTURE_KEY, {
        lifespan: { min: 360, max: 680 },
        speed: { min: 150, max: 440 },
        angle: { min: 0, max: 360 },
        gravityY: 760,
        scale: { start: 1, end: 0.1 },
        alpha: { start: 1, end: 0 },
        rotate: { min: 0, max: 360 },
        tint: DEFEAT_DEBRIS_TINTS,
        emitting: false
      })
      .setDepth(FX_DEPTH + 1);
  }

  /** Add camera-shake trauma (0..1). Multiple hits accumulate up to 1. */
  shake(trauma: number): void {
    this.shakeTrauma = Phaser.Math.Clamp(this.shakeTrauma + trauma, 0, 1);
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

  /** Larger debris + spark burst for an enemy defeat. */
  burstEnemyDefeat(x: number, y: number, scale = 1): void {
    this.debrisEmitter.setParticleScale(scale, scale);
    this.debrisEmitter.explode(Phaser.Math.Between(16, 22), x, y);
    this.sparkEmitter.setParticleScale(scale, scale);
    this.sparkEmitter.explode(Phaser.Math.Between(8, 12), x, y);
  }

  update(deltaMs: number): void {
    this.updateHitstop(deltaMs);
    this.updateShake(deltaMs);
  }

  /** Reset transient runtime state (freeze, shake, flash) without tearing down. */
  clear(): void {
    this.hitstopRemainingMs = 0;
    this.applyFreeze(false);
    this.shakeTrauma = 0;
    this.shakeTimeMs = 0;
    this.camera.setScroll(0, 0);
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
    this.debrisEmitter.timeScale = timeScale;
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

    if (!textures.exists(SHARD_TEXTURE_KEY)) {
      const shard = this.scene.make.graphics({ x: 0, y: 0 }, false);
      shard.fillStyle(0xffffff, 1);
      shard.fillRect(0, 0, 8, 8);
      shard.generateTexture(SHARD_TEXTURE_KEY, 8, 8);
      shard.destroy();
    }
  }
}
