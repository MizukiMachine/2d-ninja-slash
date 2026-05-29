import { createStore, type WritableStore } from './store';

export interface SettingsState {
  readonly volume: number;
  readonly muted: boolean;
  /** When false, background music is silenced while SFX keep playing. */
  readonly bgmEnabled: boolean;
}

export interface SettingsStore extends WritableStore<SettingsState> {
  setVolume(volume: number): void;
  increaseVolume(step?: number): void;
  decreaseVolume(step?: number): void;
  setMuted(muted: boolean): void;
  toggleMuted(): void;
  setBgmEnabled(bgmEnabled: boolean): void;
  toggleBgm(): void;
  reset(): void;
}

export const DEFAULT_SETTINGS: SettingsState = {
  volume: 0.8,
  muted: false,
  bgmEnabled: true
};

const SETTINGS_STORAGE_KEY = 'phaser-4-starter-settings';

function clampVolume(volume: number): number {
  return Math.min(1, Math.max(0, Number(volume.toFixed(2))));
}

function normalizeSettings(value: unknown): SettingsState {
  if (typeof value !== 'object' || value === null) {
    return DEFAULT_SETTINGS;
  }

  const maybeSettings = value as Partial<SettingsState>;

  return {
    volume: typeof maybeSettings.volume === 'number' ? clampVolume(maybeSettings.volume) : DEFAULT_SETTINGS.volume,
    muted: typeof maybeSettings.muted === 'boolean' ? maybeSettings.muted : DEFAULT_SETTINGS.muted,
    bgmEnabled:
      typeof maybeSettings.bgmEnabled === 'boolean'
        ? maybeSettings.bgmEnabled
        : DEFAULT_SETTINGS.bgmEnabled
  };
}

function readStoredSettings(storage: Storage | null): SettingsState {
  if (storage === null) {
    return DEFAULT_SETTINGS;
  }

  const raw = storage.getItem(SETTINGS_STORAGE_KEY);

  if (raw === null) {
    return DEFAULT_SETTINGS;
  }

  try {
    return normalizeSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function persistSettings(storage: Storage | null, settings: SettingsState): void {
  if (storage === null) {
    return;
  }

  storage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createSettingsStore(storage: Storage | null = getBrowserStorage()): SettingsStore {
  const baseStore = createStore(readStoredSettings(storage));

  const setAndPersist = (nextState: SettingsState): void => {
    baseStore.set(nextState);
    persistSettings(storage, nextState);
  };

  const store: SettingsStore = {
    ...baseStore,
    set: (nextState) => {
      setAndPersist(normalizeSettings(nextState));
    },
    update: (updater) => {
      setAndPersist(normalizeSettings(updater(baseStore.get())));
    },
    setVolume: (volume) => {
      store.update((state) => ({ ...state, volume: clampVolume(volume) }));
    },
    increaseVolume: (step = 0.1) => {
      store.update((state) => ({ ...state, volume: clampVolume(state.volume + step) }));
    },
    decreaseVolume: (step = 0.1) => {
      store.update((state) => ({ ...state, volume: clampVolume(state.volume - step) }));
    },
    setMuted: (muted) => {
      store.update((state) => ({ ...state, muted }));
    },
    toggleMuted: () => {
      store.update((state) => ({ ...state, muted: !state.muted }));
    },
    setBgmEnabled: (bgmEnabled) => {
      store.update((state) => ({ ...state, bgmEnabled }));
    },
    toggleBgm: () => {
      store.update((state) => ({ ...state, bgmEnabled: !state.bgmEnabled }));
    },
    reset: () => {
      store.set(DEFAULT_SETTINGS);
    }
  };

  return store;
}
