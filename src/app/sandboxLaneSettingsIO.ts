import {
  SANDBOX_LANE_SETTINGS_SAVE_ENDPOINT,
  buildSandboxLaneSettingsExport,
  setSandboxLaneSettingsForProfile,
  type SandboxLaneSettings,
  type SandboxLaneSettingsConfig
} from '../game/debugFeatures';
import { saveJsonConfig } from './debugConfigIO';

export interface WriteSandboxLaneSettingsResult {
  /** True when the dev-server write endpoint accepted the payload. */
  readonly ok: boolean;
  /** The serialized config that was sent (carries a fresh savedAt). */
  readonly payload: SandboxLaneSettingsConfig;
}

/**
 * Folds one profile's lane settings into the config, serializes it, and writes
 * it to sandbox-lanes.json via the dev-server endpoint.
 *
 * Shared by the debug console ({@link createApp}) and the standalone game
 * ({@link createGameContext}) so both persist lane edits through identical
 * mechanics. A missing endpoint (static production build) resolves with
 * `ok: false` instead of throwing; callers keep the in-memory change and may
 * fall back to a download. The returned `payload` is the config that was sent,
 * so callers can adopt it as their new in-memory config on success.
 */
export async function writeSandboxLaneSettings(
  config: SandboxLaneSettingsConfig,
  profileId: string,
  settings: SandboxLaneSettings,
  worldHeight: number
): Promise<WriteSandboxLaneSettingsResult> {
  const nextConfig = setSandboxLaneSettingsForProfile(
    config,
    profileId,
    settings,
    worldHeight
  );
  const payload = buildSandboxLaneSettingsExport(nextConfig);

  try {
    await saveJsonConfig(SANDBOX_LANE_SETTINGS_SAVE_ENDPOINT, payload);

    return { ok: true, payload };
  } catch {
    return { ok: false, payload };
  }
}
