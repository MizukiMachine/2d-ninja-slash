import { describe, expect, it } from 'vitest';
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
  it('tracks scene, pause, world bounds, pointer, and input state', () => {
    const store = createDebugStore();

    store.setActiveScene('Sandbox');
    store.setPaused(true);
    store.setShowWorldBounds(true);
    store.setEnemyChaseEnabled(false);
    store.setSpriteSheetSet('legacy');
    store.setPointer({ x: 12, y: 24, worldX: 120, worldY: 240, down: true });
    store.setInput({ left: true, lastKey: 'KeyA' });

    expect(store.get()).toMatchObject({
      activeScene: 'Sandbox',
      paused: true,
      showWorldBounds: true,
      enemyChaseEnabled: false,
      spriteSheetSet: 'legacy',
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
      }
    });
  });
});
