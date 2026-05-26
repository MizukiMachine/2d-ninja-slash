import { createStore, type WritableStore } from './store';
import {
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
  type DebugBackgroundFileName
} from '../game/assets/ninjaAssetCatalog';

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

export interface DebugActorState {
  readonly action: string;
  readonly animation: string;
  readonly frame: number;
  readonly x: number;
  readonly y: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly bodyX: number;
  readonly bodyY: number;
  readonly bodyWidth: number;
  readonly bodyHeight: number;
}

export interface DebugAttackState {
  readonly active: boolean;
  readonly action: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly hitCount: number;
}

export interface DebugPerformanceState {
  readonly fps: number;
  readonly physicsBodies: number;
}

export interface DebugState {
  readonly activeScene: string;
  readonly paused: boolean;
  readonly showWorldBounds: boolean;
  readonly showVisualBounds: boolean;
  readonly showHitBoxes: boolean;
  readonly showAttackBoxes: boolean;
  readonly showOrigins: boolean;
  readonly showPointerProbe: boolean;
  readonly showEnemyRanges: boolean;
  readonly enemyChaseEnabled: boolean;
  readonly backgroundFileName: DebugBackgroundFileName;
  readonly actorResetRequestId: number;
  readonly pointer: DebugPointerState;
  readonly input: DebugInputState;
  readonly player: DebugActorState;
  readonly enemy: DebugActorState;
  readonly attack: DebugAttackState;
  readonly performance: DebugPerformanceState;
}

export interface DebugStore extends WritableStore<DebugState> {
  setActiveScene(activeScene: string): void;
  setPaused(paused: boolean): void;
  togglePaused(): void;
  setShowWorldBounds(showWorldBounds: boolean): void;
  toggleWorldBounds(): void;
  setShowVisualBounds(showVisualBounds: boolean): void;
  setShowHitBoxes(showHitBoxes: boolean): void;
  setShowAttackBoxes(showAttackBoxes: boolean): void;
  setShowOrigins(showOrigins: boolean): void;
  setShowPointerProbe(showPointerProbe: boolean): void;
  setShowEnemyRanges(showEnemyRanges: boolean): void;
  setEnemyChaseEnabled(enemyChaseEnabled: boolean): void;
  toggleEnemyChase(): void;
  setBackgroundFileName(backgroundFileName: DebugBackgroundFileName): void;
  requestActorReset(): void;
  setPointer(pointer: Partial<DebugPointerState>): void;
  setInput(input: Partial<DebugInputState>): void;
  setPlayer(player: Partial<DebugActorState>): void;
  setEnemy(enemy: Partial<DebugActorState>): void;
  setAttack(attack: Partial<DebugAttackState>): void;
  setPerformance(performance: Partial<DebugPerformanceState>): void;
  resetRuntime(): void;
}

function createEmptyActorState(): DebugActorState {
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

function createInitialDebugState(): DebugState {
  return {
    activeScene: 'Boot',
    paused: false,
    showWorldBounds: false,
    showVisualBounds: false,
    showHitBoxes: false,
    showAttackBoxes: false,
    showOrigins: false,
    showPointerProbe: false,
    showEnemyRanges: false,
    enemyChaseEnabled: true,
    backgroundFileName: DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
    actorResetRequestId: 0,
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
    },
    player: createEmptyActorState(),
    enemy: createEmptyActorState(),
    attack: {
      active: false,
      action: 'none',
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      hitCount: 0
    },
    performance: {
      fps: 0,
      physicsBodies: 0
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
    setShowVisualBounds: (showVisualBounds) => {
      store.update((state) => ({ ...state, showVisualBounds }));
    },
    setShowHitBoxes: (showHitBoxes) => {
      store.update((state) => ({ ...state, showHitBoxes }));
    },
    setShowAttackBoxes: (showAttackBoxes) => {
      store.update((state) => ({ ...state, showAttackBoxes }));
    },
    setShowOrigins: (showOrigins) => {
      store.update((state) => ({ ...state, showOrigins }));
    },
    setShowPointerProbe: (showPointerProbe) => {
      store.update((state) => ({ ...state, showPointerProbe }));
    },
    setShowEnemyRanges: (showEnemyRanges) => {
      store.update((state) => ({ ...state, showEnemyRanges }));
    },
    setEnemyChaseEnabled: (enemyChaseEnabled) => {
      store.update((state) => ({ ...state, enemyChaseEnabled }));
    },
    toggleEnemyChase: () => {
      store.update((state) => ({ ...state, enemyChaseEnabled: !state.enemyChaseEnabled }));
    },
    setBackgroundFileName: (backgroundFileName) => {
      store.update((state) => ({ ...state, backgroundFileName }));
    },
    requestActorReset: () => {
      store.update((state) => ({
        ...state,
        actorResetRequestId: state.actorResetRequestId + 1
      }));
    },
    setPointer: (pointer) => {
      store.update((state) => ({ ...state, pointer: { ...state.pointer, ...pointer } }));
    },
    setInput: (input) => {
      store.update((state) => ({ ...state, input: { ...state.input, ...input } }));
    },
    setPlayer: (player) => {
      store.update((state) => ({ ...state, player: { ...state.player, ...player } }));
    },
    setEnemy: (enemy) => {
      store.update((state) => ({ ...state, enemy: { ...state.enemy, ...enemy } }));
    },
    setAttack: (attack) => {
      store.update((state) => ({ ...state, attack: { ...state.attack, ...attack } }));
    },
    setPerformance: (performance) => {
      store.update((state) => ({
        ...state,
        performance: { ...state.performance, ...performance }
      }));
    },
    resetRuntime: () => {
      const current = store.get();
      const initial = createInitialDebugState();
      store.set({
        ...initial,
        paused: current.paused,
        showWorldBounds: current.showWorldBounds,
        showVisualBounds: current.showVisualBounds,
        showHitBoxes: current.showHitBoxes,
        showAttackBoxes: current.showAttackBoxes,
        showOrigins: current.showOrigins,
        showPointerProbe: current.showPointerProbe,
        showEnemyRanges: current.showEnemyRanges,
        enemyChaseEnabled: current.enemyChaseEnabled,
        backgroundFileName: current.backgroundFileName,
        actorResetRequestId: current.actorResetRequestId
      });
    }
  };
}
