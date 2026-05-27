import { describe, expect, it } from 'vitest';
import { createDefaultThreeLaneYSettings } from '../src/game/playerLaneMovement';
import { createDebugStore } from '../src/stores/debugStore';
import { createSettingsStore, DEFAULT_SETTINGS } from '../src/stores/settingsStore';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('settingsStore', () => {
  it('persists volume and muted settings', () => {
    const storage = new MemoryStorage();
    const store = createSettingsStore(storage);

    store.setVolume(0.35);
    store.setMuted(true);

    const reloadedStore = createSettingsStore(storage);

    expect(reloadedStore.get()).toEqual({
      volume: 0.35,
      muted: true
    });
  });

  it('resets to defaults', () => {
    const storage = new MemoryStorage();
    const store = createSettingsStore(storage);

    store.setVolume(0);
    store.setMuted(true);
    store.reset();

    expect(store.get()).toEqual(DEFAULT_SETTINGS);
  });
});

describe('debugStore', () => {
  it('defaults enemy chase to disabled', () => {
    const store = createDebugStore();

    expect(store.get().enemyChaseEnabled).toBe(false);
    expect(store.get().showLaneGuides).toBe(true);
    expect(store.get().sandboxLaneSettings).toEqual(
      createDefaultThreeLaneYSettings({ worldHeight: 720 })
    );
  });

  it('tracks scene, pause, world bounds, pointer, and input state', () => {
    const store = createDebugStore();

    store.setActiveScene('Sandbox');
    store.setPaused(true);
    store.setShowWorldBounds(true);
    store.setShowVisualBounds(true);
    store.setShowHitBoxes(true);
    store.setShowAttackBoxes(true);
    store.setShowOrigins(true);
    store.setShowPointerProbe(true);
    store.setShowEnemyRanges(true);
    store.setShowLaneGuides(false);
    store.setEnemyChaseEnabled(false);
    store.setBackgroundFileName('three-lane-rough-bamboo-shrine.png');
    store.setSandboxLaneSettings({ upperY: 320, middleY: 455, lowerY: 610 });
    store.requestActorReset();
    store.setPointer({ x: 12, y: 24, worldX: 120, worldY: 240, down: true });
    store.setInput({ left: true, lastKey: 'KeyA' });
    store.setPlayer({ action: 'run', x: 100, y: 200, velocityX: 260 });
    store.setEnemy({ action: 'slash', x: 300, y: 220, velocityX: -260 });
    store.setAttack({
      active: true,
      action: 'slash',
      x: 180,
      y: 130,
      width: 132,
      height: 34,
      hitCount: 1
    });
    store.setRound({
      status: 'fighting',
      round: 3,
      enemies: 4,
      defeated: 2,
      totalDefeated: 7,
      elapsedMs: 92000,
      nextRoundInMs: 0
    });
    store.setPerformance({ fps: 59.8, physicsBodies: 2 });

    expect(store.get()).toMatchObject({
      activeScene: 'Sandbox',
      paused: true,
      showWorldBounds: true,
      showVisualBounds: true,
      showHitBoxes: true,
      showAttackBoxes: true,
      showOrigins: true,
      showPointerProbe: true,
      showEnemyRanges: true,
      showLaneGuides: false,
      enemyChaseEnabled: false,
      backgroundFileName: 'three-lane-rough-bamboo-shrine.png',
      sandboxLaneSettings: {
        upperY: 320,
        middleY: 455,
        lowerY: 610
      },
      actorResetRequestId: 1,
      pointer: {
        x: 12,
        y: 24,
        worldX: 120,
        worldY: 240,
        down: true
      },
      input: {
        left: true,
        lastKey: 'KeyA'
      },
      player: {
        action: 'run',
        x: 100,
        y: 200,
        velocityX: 260
      },
      enemy: {
        action: 'slash',
        x: 300,
        y: 220,
        velocityX: -260
      },
      attack: {
        active: true,
        action: 'slash',
        x: 180,
        y: 130,
        width: 132,
        height: 34,
        hitCount: 1
      },
      round: {
        status: 'fighting',
        round: 3,
        enemies: 4,
        defeated: 2,
        totalDefeated: 7,
        elapsedMs: 92000,
        nextRoundInMs: 0
      },
      performance: {
        fps: 59.8,
        physicsBodies: 2
      }
    });
  });

  it('preserves debug controls while clearing runtime telemetry', () => {
    const store = createDebugStore();

    store.setPaused(true);
    store.setShowWorldBounds(true);
    store.setShowVisualBounds(true);
    store.setShowHitBoxes(true);
    store.setShowAttackBoxes(true);
    store.setShowOrigins(true);
    store.setShowPointerProbe(true);
    store.setShowEnemyRanges(true);
    store.setShowLaneGuides(false);
    store.setEnemyChaseEnabled(false);
    store.setBackgroundFileName('three-lane-rough-bamboo-shrine.png');
    store.setSandboxLaneSettings({ upperY: 320, middleY: 455, lowerY: 610 });
    store.requestActorReset();
    store.setPlayer({ action: 'run', x: 100 });
    store.setRound({
      status: 'fighting',
      round: 3,
      enemies: 4,
      defeated: 2,
      totalDefeated: 7,
      elapsedMs: 92000
    });
    store.setPerformance({ fps: 60, physicsBodies: 2 });

    store.resetRuntime();

    expect(store.get()).toMatchObject({
      paused: true,
      showWorldBounds: true,
      showVisualBounds: true,
      showHitBoxes: true,
      showAttackBoxes: true,
      showOrigins: true,
      showPointerProbe: true,
      showEnemyRanges: true,
      showLaneGuides: false,
      enemyChaseEnabled: false,
      backgroundFileName: 'three-lane-rough-bamboo-shrine.png',
      sandboxLaneSettings: {
        upperY: 320,
        middleY: 455,
        lowerY: 610
      },
      actorResetRequestId: 1,
      player: {
        action: 'none',
        x: 0
      },
      round: {
        status: 'ready',
        round: 1,
        enemies: 0,
        defeated: 0,
        totalDefeated: 0,
        elapsedMs: 0
      },
      performance: {
        fps: 0,
        physicsBodies: 0
      }
    });
  });
});
