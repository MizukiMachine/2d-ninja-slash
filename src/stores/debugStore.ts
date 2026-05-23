import { createStore, type WritableStore } from './store';

export type DebugSpriteSheetSet = 'current' | 'legacy';

export const DEFAULT_DEBUG_SPRITE_SHEET_SET: DebugSpriteSheetSet = 'current';

export interface DebugPointerState {
  readonly x: number;
  readonly y: number;
  readonly worldX: number;
  readonly worldY: number;
  readonly down: boolean;
}

export interface DebugInputState {
  readonly left: boolean;
  readonly right: boolean;
  readonly up: boolean;
  readonly down: boolean;
  readonly lastKey: string;
}

export interface DebugState {
  readonly activeScene: string;
  readonly paused: boolean;
  readonly showWorldBounds: boolean;
  readonly enemyChaseEnabled: boolean;
  readonly spriteSheetSet: DebugSpriteSheetSet;
  readonly pointer: DebugPointerState;
  readonly input: DebugInputState;
}

export interface DebugStore extends WritableStore<DebugState> {
  setActiveScene(activeScene: string): void;
  setPaused(paused: boolean): void;
  togglePaused(): void;
  setShowWorldBounds(showWorldBounds: boolean): void;
  toggleWorldBounds(): void;
  setEnemyChaseEnabled(enemyChaseEnabled: boolean): void;
  toggleEnemyChase(): void;
  setSpriteSheetSet(spriteSheetSet: DebugSpriteSheetSet): void;
  setPointer(pointer: Partial<DebugPointerState>): void;
  setInput(input: Partial<DebugInputState>): void;
  resetRuntime(): void;
}

function createInitialDebugState(): DebugState {
  return {
    activeScene: 'Boot',
    paused: false,
    showWorldBounds: false,
    enemyChaseEnabled: true,
    spriteSheetSet: DEFAULT_DEBUG_SPRITE_SHEET_SET,
    pointer: {
      x: 0,
      y: 0,
      worldX: 0,
      worldY: 0,
      down: false
    },
    input: {
      left: false,
      right: false,
      up: false,
      down: false,
      lastKey: ''
    }
  };
}

export function createDebugStore(): DebugStore {
  const store = createStore(createInitialDebugState());

  return {
    ...store,
    setActiveScene: (activeScene) => {
      store.update((state) => ({ ...state, activeScene }));
    },
    setPaused: (paused) => {
      store.update((state) => ({ ...state, paused }));
    },
    togglePaused: () => {
      store.update((state) => ({ ...state, paused: !state.paused }));
    },
    setShowWorldBounds: (showWorldBounds) => {
      store.update((state) => ({ ...state, showWorldBounds }));
    },
    toggleWorldBounds: () => {
      store.update((state) => ({ ...state, showWorldBounds: !state.showWorldBounds }));
    },
    setEnemyChaseEnabled: (enemyChaseEnabled) => {
      store.update((state) => ({ ...state, enemyChaseEnabled }));
    },
    toggleEnemyChase: () => {
      store.update((state) => ({ ...state, enemyChaseEnabled: !state.enemyChaseEnabled }));
    },
    setSpriteSheetSet: (spriteSheetSet) => {
      store.update((state) => ({ ...state, spriteSheetSet }));
    },
    setPointer: (pointer) => {
      store.update((state) => ({ ...state, pointer: { ...state.pointer, ...pointer } }));
    },
    setInput: (input) => {
      store.update((state) => ({ ...state, input: { ...state.input, ...input } }));
    },
    resetRuntime: () => {
      const current = store.get();
      const initial = createInitialDebugState();
      store.set({
        ...initial,
        paused: current.paused,
        showWorldBounds: current.showWorldBounds,
        enemyChaseEnabled: current.enemyChaseEnabled,
        spriteSheetSet: current.spriteSheetSet
      });
    }
  };
}
