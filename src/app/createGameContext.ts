import {
  DEFAULT_PROFILE_ID,
  getProfileById,
  type ProfileId
} from '../game/profiles';
import { SceneKeys, type SceneKey } from '../game/sceneKeys';
import { createGameAudio } from '../game/audio/gameAudio';
import {
  DEBUG_ELEMENTS_CONFIG_URL,
  GAMEPLAY_TUNING_CONFIG_URL,
  SANDBOX_LANE_SETTINGS_CONFIG_URL,
  createDefaultDebugElementsConfig,
  createDefaultSandboxLaneSettingsConfig,
  getSandboxLaneSettingsForProfile,
  loadLevelProgress,
  normalizeDebugElementsConfig,
  normalizeGameplayTuning,
  normalizeSandboxLaneSettingsConfig
} from '../game/debugFeatures';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  NINJA_BOUNDS_CONFIG_URL,
  cloneNinjaBoundsConfig,
  normalizeNinjaBoundsConfig
} from '../game/ninjaBounds';
import { createDebugStore } from '../stores/debugStore';
import { createSettingsStore } from '../stores/settingsStore';
import { loadJsonConfig } from './debugConfigIO';
import { writeSandboxLaneSettings } from './sandboxLaneSettingsIO';
import type { AppContext } from './context';

export interface CreateGameContextOptions {
  /** Profile (canvas size) to play in. Defaults to landscape. */
  readonly profileId?: ProfileId;
  /** Scene to open after Boot/Splash. Defaults to the Sandbox battle. */
  readonly initialScene?: SceneKey;
}

/**
 * Builds a minimal {@link AppContext} for the standalone game build.
 *
 * Unlike {@link createApp}, this creates no debug-console DOM. It simply loads
 * the tuned config JSON from `public/assets/config/` into the in-memory stores
 * so the gameplay scenes run with the same values the debug lab produced, then
 * hands back a context that opens straight into the chosen scene.
 *
 * Config is loaded before the context resolves, so the game starts with the
 * correct values on the very first frame (no flicker from late-arriving JSON).
 */
export async function createGameContext(
  options: CreateGameContextOptions = {}
): Promise<AppContext> {
  const profileId = options.profileId ?? DEFAULT_PROFILE_ID;
  const initialScene = options.initialScene ?? SceneKeys.Sandbox;

  const debugStore = createDebugStore();
  const settingsStore = createSettingsStore();
  const audio = createGameAudio();

  const profile = getProfileById(profileId);

  let ninjaBoundsConfig = cloneNinjaBoundsConfig(DEFAULT_NINJA_BOUNDS_CONFIG);
  let debugElementsConfig = createDefaultDebugElementsConfig();

  const [
    loadedNinjaBounds,
    loadedTuning,
    loadedLaneSettings,
    loadedElements
  ] = await Promise.all([
    loadJsonConfig(NINJA_BOUNDS_CONFIG_URL, normalizeNinjaBoundsConfig),
    loadJsonConfig(GAMEPLAY_TUNING_CONFIG_URL, normalizeGameplayTuning),
    loadJsonConfig(
      SANDBOX_LANE_SETTINGS_CONFIG_URL,
      normalizeSandboxLaneSettingsConfig
    ),
    loadJsonConfig(DEBUG_ELEMENTS_CONFIG_URL, normalizeDebugElementsConfig)
  ]);

  if (loadedNinjaBounds !== null) {
    ninjaBoundsConfig = loadedNinjaBounds;
  }

  if (loadedTuning !== null) {
    debugStore.setGameplayTuning(loadedTuning);
  }

  if (loadedElements !== null) {
    debugElementsConfig = loadedElements;
  }

  let laneSettingsConfig =
    loadedLaneSettings ?? createDefaultSandboxLaneSettingsConfig();
  debugStore.setSandboxLaneSettings(
    getSandboxLaneSettingsForProfile(laneSettingsConfig, profileId, profile.height)
  );

  debugStore.setLevelProgress(loadLevelProgress());

  // Mirror the debug console's lane auto-save so the Lane Editor's drag-release
  // also persists to sandbox-lanes.json in the standalone game build. Writes are
  // coalesced; a missing dev-server endpoint (static production build) fails
  // silently and just keeps the in-memory change.
  let laneSaveInFlight = false;
  let laneSavePendingAfterFlight = false;
  const persistLaneSettings = async (): Promise<void> => {
    if (laneSaveInFlight) {
      laneSavePendingAfterFlight = true;
      return;
    }

    laneSaveInFlight = true;

    const { ok, payload } = await writeSandboxLaneSettings(
      laneSettingsConfig,
      profileId,
      debugStore.get().sandboxLaneSettings,
      profile.height
    );

    if (ok) {
      laneSettingsConfig = payload;
    }
    // On failure (no write endpoint in a static build) keep the in-memory
    // change only; nothing to persist to.

    laneSaveInFlight = false;

    if (laneSavePendingAfterFlight) {
      laneSavePendingAfterFlight = false;
      void persistLaneSettings();
    }
  };

  return {
    debugStore,
    settingsStore,
    audio,
    getProfile: () => profile,
    getNinjaBoundsConfig: () => ninjaBoundsConfig,
    getDebugElementsConfig: () => debugElementsConfig,
    setDebugElementsConfig: (config) => {
      debugElementsConfig = normalizeDebugElementsConfig(config);
    },
    setSandboxLaneSettings: (settings) => {
      debugStore.setSandboxLaneSettings(settings);
    },
    persistSandboxLaneSettings: () => {
      void persistLaneSettings();
    },
    getInitialScene: () => initialScene
  };
}
