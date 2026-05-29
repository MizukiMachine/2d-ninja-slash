import {
  createDefaultThreeLaneYSettings,
  normalizeThreeLaneYSettings,
  type ThreeLaneYSettings
} from './playerLaneMovement';
import {
  DEFAULT_PROFILE_ID,
  GAME_PROFILES,
  isProfileId,
  type ProfileId
} from './profiles';

export type BackgroundFitMode = 'cover' | 'contain' | 'native';
export type RoundEnemyGrowthMode = 'linear' | 'fibonacci';
export type SandboxLaneSettings = ThreeLaneYSettings;

export interface GameplayTuning {
  readonly playerSpeed: number;
  readonly enemySpeed: number;
  readonly enemyRecoveryMs: number;
  readonly playerKnockbackSpeed: number;
  readonly roundEnemyBaseCount: number;
  readonly roundEnemyIncrease: number;
  readonly roundEnemyMaxCount: number;
  readonly roundEnemyGrowthMode: RoundEnemyGrowthMode;
  readonly roundIntermissionMs: number;
}

export type SandboxLaneSettingsByProfile = Readonly<
  Record<ProfileId, SandboxLaneSettings>
>;

export interface SandboxLaneSettingsConfig {
  readonly version: 1;
  readonly savedAt: string | null;
  readonly profiles: SandboxLaneSettingsByProfile;
}

export const GAMEPLAY_TUNING_CONFIG_URL = '/assets/config/gameplay-tuning.json';
export const GAMEPLAY_TUNING_SAVE_ENDPOINT = '/__debug/gameplay-tuning';
export const SANDBOX_LANE_SETTINGS_CONFIG_URL =
  '/assets/config/sandbox-lanes.json';
export const SANDBOX_LANE_SETTINGS_SAVE_ENDPOINT = '/__debug/sandbox-lanes';
export const SANDBOX_LANE_SETTINGS_STORAGE_KEY_PREFIX =
  'ninja-slash.sandboxLaneSettings.v1';

export const ROUND_ENEMY_GROWTH_MODES: readonly RoundEnemyGrowthMode[] = [
  'linear',
  'fibonacci'
];

export const GAMEPLAY_TUNING_LIMITS = {
  playerSpeed: { min: 120, max: 520, step: 10 },
  enemySpeed: { min: 80, max: 480, step: 10 },
  enemyRecoveryMs: { min: 120, max: 1800, step: 30 },
  playerKnockbackSpeed: { min: 80, max: 760, step: 10 },
  roundEnemyBaseCount: { min: 1, max: 6, step: 1 },
  roundEnemyIncrease: { min: 1, max: 4, step: 1 },
  roundEnemyMaxCount: { min: 2, max: 12, step: 1 },
  roundIntermissionMs: { min: 500, max: 3000, step: 100 }
} as const;

export const DEFAULT_GAMEPLAY_TUNING: GameplayTuning = {
  playerSpeed: 260,
  enemySpeed: 200,
  enemyRecoveryMs: 900,
  playerKnockbackSpeed: 360,
  roundEnemyBaseCount: 1,
  roundEnemyIncrease: 1,
  roundEnemyMaxCount: 9,
  roundEnemyGrowthMode: 'fibonacci',
  roundIntermissionMs: 1200
};

export const ENEMY_MOVEMENT_SPEED_PLAYER_RATIO = 0.8;

export const DEFAULT_SANDBOX_LANE_SETTINGS: SandboxLaneSettings =
  createDefaultThreeLaneYSettings({ worldHeight: 720 });

export function normalizeGameplayTuning(value: unknown): GameplayTuning {
  const candidate = value as Partial<GameplayTuning> | null;
  const roundEnemyBaseCount = clampInteger(
    candidate?.roundEnemyBaseCount,
    GAMEPLAY_TUNING_LIMITS.roundEnemyBaseCount.min,
    GAMEPLAY_TUNING_LIMITS.roundEnemyBaseCount.max,
    DEFAULT_GAMEPLAY_TUNING.roundEnemyBaseCount
  );
  const roundEnemyMaxCount = clampInteger(
    candidate?.roundEnemyMaxCount,
    GAMEPLAY_TUNING_LIMITS.roundEnemyMaxCount.min,
    GAMEPLAY_TUNING_LIMITS.roundEnemyMaxCount.max,
    DEFAULT_GAMEPLAY_TUNING.roundEnemyMaxCount
  );

  return {
    playerSpeed: clampNumber(
      candidate?.playerSpeed,
      GAMEPLAY_TUNING_LIMITS.playerSpeed.min,
      GAMEPLAY_TUNING_LIMITS.playerSpeed.max,
      DEFAULT_GAMEPLAY_TUNING.playerSpeed
    ),
    enemySpeed: clampNumber(
      candidate?.enemySpeed,
      GAMEPLAY_TUNING_LIMITS.enemySpeed.min,
      GAMEPLAY_TUNING_LIMITS.enemySpeed.max,
      DEFAULT_GAMEPLAY_TUNING.enemySpeed
    ),
    enemyRecoveryMs: clampNumber(
      candidate?.enemyRecoveryMs,
      GAMEPLAY_TUNING_LIMITS.enemyRecoveryMs.min,
      GAMEPLAY_TUNING_LIMITS.enemyRecoveryMs.max,
      DEFAULT_GAMEPLAY_TUNING.enemyRecoveryMs
    ),
    playerKnockbackSpeed: clampNumber(
      candidate?.playerKnockbackSpeed,
      GAMEPLAY_TUNING_LIMITS.playerKnockbackSpeed.min,
      GAMEPLAY_TUNING_LIMITS.playerKnockbackSpeed.max,
      DEFAULT_GAMEPLAY_TUNING.playerKnockbackSpeed
    ),
    roundEnemyBaseCount,
    roundEnemyIncrease: clampInteger(
      candidate?.roundEnemyIncrease,
      GAMEPLAY_TUNING_LIMITS.roundEnemyIncrease.min,
      GAMEPLAY_TUNING_LIMITS.roundEnemyIncrease.max,
      DEFAULT_GAMEPLAY_TUNING.roundEnemyIncrease
    ),
    roundEnemyMaxCount: Math.max(roundEnemyBaseCount, roundEnemyMaxCount),
    roundEnemyGrowthMode:
      typeof candidate?.roundEnemyGrowthMode === 'string' &&
      ROUND_ENEMY_GROWTH_MODES.includes(candidate.roundEnemyGrowthMode as RoundEnemyGrowthMode)
        ? (candidate.roundEnemyGrowthMode as RoundEnemyGrowthMode)
        : DEFAULT_GAMEPLAY_TUNING.roundEnemyGrowthMode,
    roundIntermissionMs: clampInteger(
      candidate?.roundIntermissionMs,
      GAMEPLAY_TUNING_LIMITS.roundIntermissionMs.min,
      GAMEPLAY_TUNING_LIMITS.roundIntermissionMs.max,
      DEFAULT_GAMEPLAY_TUNING.roundIntermissionMs
    )
  };
}

export function getEnemyMovementSpeed(gameplayTuning: GameplayTuning): number {
  const tuning = normalizeGameplayTuning(gameplayTuning);
  const maxEnemySpeed = Math.max(
    GAMEPLAY_TUNING_LIMITS.enemySpeed.min,
    Math.floor(tuning.playerSpeed * ENEMY_MOVEMENT_SPEED_PLAYER_RATIO)
  );

  return Math.min(tuning.enemySpeed, maxEnemySpeed);
}

export function createDefaultSandboxLaneSettings(
  worldHeight: number
): SandboxLaneSettings {
  return createDefaultThreeLaneYSettings({ worldHeight });
}

export function createDefaultSandboxLaneSettingsConfig(): SandboxLaneSettingsConfig {
  return {
    version: 1,
    savedAt: null,
    profiles: {
      landscape: createDefaultSandboxLaneSettings(GAME_PROFILES.landscape.height),
      portrait: createDefaultSandboxLaneSettings(GAME_PROFILES.portrait.height)
    }
  };
}

export function normalizeSandboxLaneSettings(
  value: unknown,
  worldHeight: number
): SandboxLaneSettings {
  return normalizeThreeLaneYSettings(value, {
    worldHeight,
    fallback: createDefaultSandboxLaneSettings(worldHeight)
  });
}

export function normalizeSandboxLaneSettingsConfig(
  value: unknown
): SandboxLaneSettingsConfig {
  const candidate = value as
    | (Partial<SandboxLaneSettingsConfig> & {
        readonly profiles?: unknown;
      })
    | null;
  const rawProfiles = candidate?.profiles;
  const profilesCandidate =
    rawProfiles !== null &&
    typeof rawProfiles === 'object' &&
    !Array.isArray(rawProfiles)
      ? (rawProfiles as Partial<Record<ProfileId, unknown>>)
      : {};
  const defaultConfig = createDefaultSandboxLaneSettingsConfig();
  const profiles = Object.fromEntries(
    Object.values(GAME_PROFILES).map((profile) => {
      const profileValue = profilesCandidate[profile.id];
      const legacyRootValue =
        profile.id === DEFAULT_PROFILE_ID ? candidate : undefined;

      return [
        profile.id,
        normalizeSandboxLaneSettings(
          profileValue ?? legacyRootValue,
          profile.height
        )
      ];
    })
  ) as SandboxLaneSettingsByProfile;

  return {
    version: 1,
    savedAt: typeof candidate?.savedAt === 'string' ? candidate.savedAt : null,
    profiles: {
      ...defaultConfig.profiles,
      ...profiles
    }
  };
}

export function getSandboxLaneSettingsForProfile(
  config: SandboxLaneSettingsConfig,
  profileId: string,
  worldHeight: number
): SandboxLaneSettings {
  const normalizedConfig = normalizeSandboxLaneSettingsConfig(config);
  const selectedProfileId = isProfileId(profileId) ? profileId : DEFAULT_PROFILE_ID;

  return normalizeSandboxLaneSettings(
    normalizedConfig.profiles[selectedProfileId],
    worldHeight
  );
}

export function setSandboxLaneSettingsForProfile(
  config: SandboxLaneSettingsConfig,
  profileId: string,
  settings: SandboxLaneSettings,
  worldHeight: number
): SandboxLaneSettingsConfig {
  const normalizedConfig = normalizeSandboxLaneSettingsConfig(config);
  const selectedProfileId = isProfileId(profileId) ? profileId : DEFAULT_PROFILE_ID;

  return {
    ...normalizedConfig,
    profiles: {
      ...normalizedConfig.profiles,
      [selectedProfileId]: normalizeSandboxLaneSettings(settings, worldHeight)
    }
  };
}

export function buildSandboxLaneSettingsExport(
  config: SandboxLaneSettingsConfig
): SandboxLaneSettingsConfig {
  return {
    ...normalizeSandboxLaneSettingsConfig(config),
    savedAt: new Date().toISOString()
  };
}

export function loadSandboxLaneSettings(
  profileId: string,
  worldHeight: number,
  storage: Storage = window.localStorage
): SandboxLaneSettings {
  try {
    const raw = storage.getItem(getSandboxLaneSettingsStorageKey(profileId));

    return raw === null
      ? createDefaultSandboxLaneSettings(worldHeight)
      : normalizeSandboxLaneSettings(JSON.parse(raw), worldHeight);
  } catch {
    return createDefaultSandboxLaneSettings(worldHeight);
  }
}

export function saveSandboxLaneSettings(
  profileId: string,
  settings: SandboxLaneSettings,
  worldHeight: number,
  storage: Storage = window.localStorage
): SandboxLaneSettings {
  const normalized = normalizeSandboxLaneSettings(settings, worldHeight);
  storage.setItem(
    getSandboxLaneSettingsStorageKey(profileId),
    JSON.stringify(normalized)
  );

  return normalized;
}

export function resetSandboxLaneSettings(
  profileId: string,
  worldHeight: number,
  storage: Storage = window.localStorage
): SandboxLaneSettings {
  return saveSandboxLaneSettings(
    profileId,
    createDefaultSandboxLaneSettings(worldHeight),
    worldHeight,
    storage
  );
}

export function getRoundEnemyCount(
  gameplayTuning: GameplayTuning,
  round: number
): number {
  const tuning = normalizeGameplayTuning(gameplayTuning);
  const roundIndex = Math.max(0, clampInteger(round, 1, 999, 1) - 1);
  const growthStep =
    tuning.roundEnemyGrowthMode === 'fibonacci'
      ? getFibonacciGrowthStep(roundIndex)
      : roundIndex;
  const enemyCount =
    tuning.roundEnemyBaseCount + growthStep * tuning.roundEnemyIncrease;

  return clampInteger(enemyCount, 1, tuning.roundEnemyMaxCount, tuning.roundEnemyBaseCount);
}

function getSandboxLaneSettingsStorageKey(profileId: string): string {
  return `${SANDBOX_LANE_SETTINGS_STORAGE_KEY_PREFIX}.${encodeURIComponent(profileId)}`;
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value * 100) / 100));
}

function getFibonacciGrowthStep(index: number): number {
  if (index <= 0) {
    return 0;
  }

  let previous = 0;
  let current = 1;

  for (let step = 1; step < index; step += 1) {
    const next = previous + current;
    previous = current;
    current = next;
  }

  return current;
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
