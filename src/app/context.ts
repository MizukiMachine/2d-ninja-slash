import type { GameProfile } from '../game/profiles';
import type { NinjaBoundsConfig } from '../game/ninjaBounds';
import type { DebugElementsConfig } from '../game/debugFeatures';
import type { GameAudio } from '../game/audio/gameAudio';
import type { DebugStore } from '../stores/debugStore';
import type { SettingsStore } from '../stores/settingsStore';

export interface AppContext {
  readonly debugStore: DebugStore;
  readonly settingsStore: SettingsStore;
  readonly audio: GameAudio;
  getProfile(): GameProfile;
  getNinjaBoundsConfig(): NinjaBoundsConfig;
  getDebugElementsConfig(): DebugElementsConfig;
  setDebugElementsConfig(config: DebugElementsConfig): void;
}

let activeContext: AppContext | null = null;

export function setAppContext(context: AppContext): void {
  activeContext = context;
}

export function getAppContext(): AppContext {
  if (activeContext === null) {
    throw new Error('AppContext has not been initialized.');
  }

  return activeContext;
}
