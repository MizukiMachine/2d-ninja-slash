import type { GameProfile } from '../game/profiles';
import type { NinjaBoundsConfig } from '../game/ninjaBounds';
import type { SandboxLaneSettings } from '../game/debugFeatures';
import type { GameAudio } from '../game/audio/gameAudio';
import type { DebugStore } from '../stores/debugStore';
import type { SettingsStore } from '../stores/settingsStore';
import type { SceneKey } from '../game/sceneKeys';

export interface AppContext {
  readonly debugStore: DebugStore;
  readonly settingsStore: SettingsStore;
  readonly audio: GameAudio;
  getProfile(): GameProfile;
  getNinjaBoundsConfig(): NinjaBoundsConfig;
  setSandboxLaneSettings(settings: SandboxLaneSettings): void;
  /**
   * Writes the current lane settings to disk (sandbox-lanes.json).
   * Provided by the debug console so the Lane Editor can auto-save on
   * drag-release; undefined in builds without a save endpoint.
   */
  persistSandboxLaneSettings?(): void;
  /**
   * Optional scene to open after Boot/Splash instead of the MainMenu.
   * The debug console leaves this undefined (keeps the full menu); the
   * standalone game build returns the gameplay scene to jump straight in.
   */
  getInitialScene?(): SceneKey;
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
