import {
  DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
  type DebugBackgroundFileName
} from './assets/ninjaAssetCatalog';
import {
  createDefaultThreeLaneYSettings,
  normalizeThreeLaneYSettings,
  type ThreeLaneYSettings
} from './playerLaneMovement';

export type DebugElementKind = 'platform' | 'hazard' | 'pickup' | 'spawn' | 'goal' | 'enemy';
export type BackgroundFitMode = 'cover' | 'contain' | 'native';
export type ElementEditorCommandKind = 'none' | 'add' | 'delete' | 'duplicate' | 'nudge';
export type RoundEnemyGrowthMode = 'linear' | 'fibonacci';
export type SandboxLaneSettings = ThreeLaneYSettings;

export interface DebugRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface DebugLevelElement extends DebugRect {
  readonly id: string;
  readonly kind: DebugElementKind;
  readonly label: string;
}

export interface DebugLevelDefinition {
  readonly id: string;
  readonly label: string;
  readonly width: number;
  readonly surfaceY: number;
  readonly backgroundFileName: DebugBackgroundFileName;
  readonly elements: readonly DebugLevelElement[];
}

export interface LevelProgressState {
  readonly version: 1;
  readonly unlockedLevelIds: readonly string[];
  readonly completedLevelIds: readonly string[];
}

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

export interface RunnerGenerationSettings {
  readonly seed: number;
  readonly difficulty: number;
  readonly gapDensity: number;
  readonly laneCount: number;
  readonly scrollSpeed: number;
  readonly showPlanView: boolean;
  readonly showHitboxes: boolean;
}

export interface BaselineLabSettings {
  readonly selectedLevelId: string;
  readonly showHitboxes: boolean;
  readonly showSpawnGoal: boolean;
  readonly showCameraBands: boolean;
}

export interface BackgroundLabSettings {
  readonly fitMode: BackgroundFitMode;
  readonly showGrid: boolean;
  readonly showSafeFrame: boolean;
  readonly showBaseline: boolean;
  readonly scrollSpeed: number;
}

export interface ElementEditorSettings {
  readonly selectedLevelId: string;
  readonly selectedKind: DebugElementKind;
  readonly selectedElementId: string | null;
  readonly showGrid: boolean;
  readonly showLabels: boolean;
  readonly showCollision: boolean;
  readonly command: ElementEditorCommandKind;
  readonly commandSerial: number;
  readonly nudgeX: number;
  readonly nudgeY: number;
}

export interface DebugElementsLevelConfig {
  readonly levelId: string;
  readonly elements: readonly DebugLevelElement[];
}

export interface DebugElementsConfig {
  readonly version: 1;
  readonly savedAt: string | null;
  readonly levels: readonly DebugElementsLevelConfig[];
}

export const DEBUG_ELEMENTS_CONFIG_URL = '/assets/config/debug-elements.json';
export const DEBUG_ELEMENTS_SAVE_ENDPOINT = '/__debug/debug-elements';
export const GAMEPLAY_TUNING_CONFIG_URL = '/assets/config/gameplay-tuning.json';
export const GAMEPLAY_TUNING_SAVE_ENDPOINT = '/__debug/gameplay-tuning';
export const LEVEL_PROGRESS_STORAGE_KEY = 'ninja-slash.levelProgress.v1';
export const LEVEL_PROGRESS_CHANGED_EVENT = 'ninja-slash-level-progress-changed';
export const SANDBOX_LANE_SETTINGS_STORAGE_KEY_PREFIX =
  'ninja-slash.sandboxLaneSettings.v1';

export const DEBUG_ELEMENT_KINDS: readonly DebugElementKind[] = [
  'platform',
  'hazard',
  'pickup',
  'spawn',
  'goal',
  'enemy'
];

export const BACKGROUND_FIT_MODES: readonly BackgroundFitMode[] = [
  'cover',
  'contain',
  'native'
];

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
  enemySpeed: 260,
  enemyRecoveryMs: 900,
  playerKnockbackSpeed: 360,
  roundEnemyBaseCount: 1,
  roundEnemyIncrease: 1,
  roundEnemyMaxCount: 9,
  roundEnemyGrowthMode: 'fibonacci',
  roundIntermissionMs: 1200
};

export const DEFAULT_SANDBOX_LANE_SETTINGS: SandboxLaneSettings =
  createDefaultThreeLaneYSettings({ worldHeight: 720 });

export const DEFAULT_RUNNER_SETTINGS: RunnerGenerationSettings = {
  seed: 7,
  difficulty: 0.42,
  gapDensity: 0.34,
  laneCount: 3,
  scrollSpeed: 230,
  showPlanView: true,
  showHitboxes: true
};

export const DEFAULT_BASELINE_LAB_SETTINGS: BaselineLabSettings = {
  selectedLevelId: 'training-yard',
  showHitboxes: true,
  showSpawnGoal: true,
  showCameraBands: true
};

export const DEFAULT_BACKGROUND_LAB_SETTINGS: BackgroundLabSettings = {
  fitMode: 'cover',
  showGrid: true,
  showSafeFrame: true,
  showBaseline: true,
  scrollSpeed: 0
};

export const DEFAULT_ELEMENT_EDITOR_SETTINGS: ElementEditorSettings = {
  selectedLevelId: DEFAULT_BASELINE_LAB_SETTINGS.selectedLevelId,
  selectedKind: 'platform',
  selectedElementId: null,
  showGrid: true,
  showLabels: true,
  showCollision: true,
  command: 'none',
  commandSerial: 0,
  nudgeX: 0,
  nudgeY: 0
};

export const DEBUG_LEVELS: readonly DebugLevelDefinition[] = [
  {
    id: 'training-yard',
    label: 'Training Yard',
    width: 1840,
    surfaceY: 565,
    backgroundFileName: DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
    elements: [
      element('training-spawn', 'spawn', 170, 485, 54, 78, 'Spawn'),
      element('training-ground-a', 'platform', 80, 565, 560, 34, 'Ground A'),
      element('training-platform-a', 'platform', 760, 475, 260, 28, 'Mid Platform'),
      element('training-pickup-a', 'pickup', 840, 420, 32, 32, 'Pickup'),
      element('training-enemy-a', 'enemy', 1180, 488, 54, 74, 'Enemy'),
      element('training-goal', 'goal', 1640, 470, 76, 95, 'Goal')
    ]
  },
  {
    id: 'roof-run',
    label: 'Roof Run',
    width: 2280,
    surfaceY: 540,
    backgroundFileName: DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
    elements: [
      element('roof-spawn', 'spawn', 155, 460, 54, 78, 'Spawn'),
      element('roof-ground-a', 'platform', 0, 540, 470, 34, 'Roof A'),
      element('roof-gap-hazard', 'hazard', 540, 570, 190, 54, 'Gap'),
      element('roof-platform-a', 'platform', 760, 494, 360, 28, 'Step 1'),
      element('roof-platform-b', 'platform', 1240, 440, 310, 28, 'Step 2'),
      element('roof-pickup-a', 'pickup', 1350, 386, 32, 32, 'Pickup'),
      element('roof-enemy-a', 'enemy', 1630, 464, 54, 74, 'Enemy'),
      element('roof-goal', 'goal', 2050, 445, 76, 95, 'Goal')
    ]
  },
  {
    id: 'moon-gauntlet',
    label: 'Moon Gauntlet',
    width: 2600,
    surfaceY: 585,
    backgroundFileName: DEFAULT_DEBUG_BACKGROUND_FILE_NAME,
    elements: [
      element('gauntlet-spawn', 'spawn', 150, 505, 54, 78, 'Spawn'),
      element('gauntlet-ground-a', 'platform', 0, 585, 520, 34, 'Ground A'),
      element('gauntlet-platform-a', 'platform', 665, 500, 260, 28, 'Platform A'),
      element('gauntlet-hazard-a', 'hazard', 980, 595, 210, 44, 'Blade Pit'),
      element('gauntlet-platform-b', 'platform', 1210, 452, 300, 28, 'Platform B'),
      element('gauntlet-enemy-a', 'enemy', 1530, 515, 54, 74, 'Enemy A'),
      element('gauntlet-platform-c', 'platform', 1750, 535, 420, 30, 'Platform C'),
      element('gauntlet-pickup-a', 'pickup', 1900, 480, 32, 32, 'Pickup'),
      element('gauntlet-enemy-b', 'enemy', 2140, 515, 54, 74, 'Enemy B'),
      element('gauntlet-goal', 'goal', 2440, 490, 76, 95, 'Goal')
    ]
  }
];

export const PLAYABLE_LEVEL_IDS = DEBUG_LEVELS.map((level) => level.id);

export const DEFAULT_LEVEL_PROGRESS: LevelProgressState = {
  version: 1,
  unlockedLevelIds: [PLAYABLE_LEVEL_IDS[0]],
  completedLevelIds: []
};

export function getDebugLevel(levelId: string): DebugLevelDefinition {
  return DEBUG_LEVELS.find((level) => level.id === levelId) ?? DEBUG_LEVELS[0];
}

export function getEditableDebugLevel(
  levelId: string,
  config: DebugElementsConfig
): DebugLevelDefinition {
  const level = getDebugLevel(levelId);

  return {
    ...level,
    elements: getDebugLevelElements(config, level.id)
  };
}

export function isDebugElementKind(value: string): value is DebugElementKind {
  return DEBUG_ELEMENT_KINDS.includes(value as DebugElementKind);
}

export function isBackgroundFitMode(value: string): value is BackgroundFitMode {
  return BACKGROUND_FIT_MODES.includes(value as BackgroundFitMode);
}

export function isPlayableLevelId(value: string): value is (typeof PLAYABLE_LEVEL_IDS)[number] {
  return PLAYABLE_LEVEL_IDS.includes(value);
}

export function createDefaultDebugElementsConfig(): DebugElementsConfig {
  return {
    version: 1,
    savedAt: null,
    levels: DEBUG_LEVELS.map((level) => ({
      levelId: level.id,
      elements: cloneElements(level.elements)
    }))
  };
}

export function normalizeDebugElementsConfig(value: unknown): DebugElementsConfig {
  const candidate = value as
    | (Partial<DebugElementsConfig> & {
        readonly elements?: unknown;
        readonly levels?: unknown;
      })
    | null;
  const configuredLevels = new Map<string, readonly DebugLevelElement[]>();
  const rawLevels = Array.isArray(candidate?.levels) ? candidate.levels : [];
  const legacyElements = Array.isArray(candidate?.elements) ? candidate.elements : null;

  rawLevels.forEach((entry) => {
    const levelCandidate = entry as Partial<DebugElementsLevelConfig> | null;
    const levelId =
      typeof levelCandidate?.levelId === 'string' && isPlayableLevelId(levelCandidate.levelId)
        ? levelCandidate.levelId
        : null;
    const rawElements = Array.isArray(levelCandidate?.elements)
      ? levelCandidate.elements
      : null;

    if (levelId !== null && rawElements !== null) {
      configuredLevels.set(levelId, rawElements.map((elementEntry, index) => normalizeDebugElement(elementEntry, index)));
    }
  });

  if (legacyElements !== null) {
    configuredLevels.set(
      PLAYABLE_LEVEL_IDS[0],
      legacyElements.map((entry, index) => normalizeDebugElement(entry, index))
    );
  }

  return {
    version: 1,
    savedAt: typeof candidate?.savedAt === 'string' ? candidate.savedAt : null,
    levels: DEBUG_LEVELS.map((level) => ({
      levelId: level.id,
      elements: cloneElements(configuredLevels.get(level.id) ?? level.elements)
    }))
  };
}

export function getDebugLevelElements(
  config: DebugElementsConfig,
  levelId: string
): readonly DebugLevelElement[] {
  const level = getDebugLevel(levelId);
  const normalized = normalizeDebugElementsConfig(config);
  const editableLevel = normalized.levels.find((entry) => entry.levelId === level.id);

  return cloneElements(editableLevel?.elements ?? level.elements);
}

export function setDebugLevelElements(
  config: DebugElementsConfig,
  levelId: string,
  elements: readonly DebugLevelElement[]
): DebugElementsConfig {
  const normalized = normalizeDebugElementsConfig(config);
  const selectedLevelId = isPlayableLevelId(levelId) ? levelId : PLAYABLE_LEVEL_IDS[0];

  return {
    ...normalized,
    levels: normalized.levels.map((level) =>
      level.levelId === selectedLevelId
        ? {
            ...level,
            elements: elements.map((entry, index) => normalizeDebugElement(entry, index))
          }
        : level
    )
  };
}

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

export function createDefaultSandboxLaneSettings(
  worldHeight: number
): SandboxLaneSettings {
  return createDefaultThreeLaneYSettings({ worldHeight });
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

export function normalizeRunnerSettings(value: unknown): RunnerGenerationSettings {
  const candidate = value as Partial<RunnerGenerationSettings> | null;

  return {
    seed: clampInteger(candidate?.seed, 1, 99999, DEFAULT_RUNNER_SETTINGS.seed),
    difficulty: clampNumber(
      candidate?.difficulty,
      0,
      1,
      DEFAULT_RUNNER_SETTINGS.difficulty
    ),
    gapDensity: clampNumber(
      candidate?.gapDensity,
      0,
      1,
      DEFAULT_RUNNER_SETTINGS.gapDensity
    ),
    laneCount: clampInteger(candidate?.laneCount, 1, 5, DEFAULT_RUNNER_SETTINGS.laneCount),
    scrollSpeed: clampNumber(
      candidate?.scrollSpeed,
      0,
      520,
      DEFAULT_RUNNER_SETTINGS.scrollSpeed
    ),
    showPlanView:
      typeof candidate?.showPlanView === 'boolean'
        ? candidate.showPlanView
        : DEFAULT_RUNNER_SETTINGS.showPlanView,
    showHitboxes:
      typeof candidate?.showHitboxes === 'boolean'
        ? candidate.showHitboxes
        : DEFAULT_RUNNER_SETTINGS.showHitboxes
  };
}

export function normalizeBaselineLabSettings(value: unknown): BaselineLabSettings {
  const candidate = value as Partial<BaselineLabSettings> | null;

  return {
    selectedLevelId:
      typeof candidate?.selectedLevelId === 'string' && isPlayableLevelId(candidate.selectedLevelId)
        ? candidate.selectedLevelId
        : DEFAULT_BASELINE_LAB_SETTINGS.selectedLevelId,
    showHitboxes:
      typeof candidate?.showHitboxes === 'boolean'
        ? candidate.showHitboxes
        : DEFAULT_BASELINE_LAB_SETTINGS.showHitboxes,
    showSpawnGoal:
      typeof candidate?.showSpawnGoal === 'boolean'
        ? candidate.showSpawnGoal
        : DEFAULT_BASELINE_LAB_SETTINGS.showSpawnGoal,
    showCameraBands:
      typeof candidate?.showCameraBands === 'boolean'
        ? candidate.showCameraBands
        : DEFAULT_BASELINE_LAB_SETTINGS.showCameraBands
  };
}

export function normalizeBackgroundLabSettings(value: unknown): BackgroundLabSettings {
  const candidate = value as Partial<BackgroundLabSettings> | null;

  return {
    fitMode:
      typeof candidate?.fitMode === 'string' && isBackgroundFitMode(candidate.fitMode)
        ? candidate.fitMode
        : DEFAULT_BACKGROUND_LAB_SETTINGS.fitMode,
    showGrid:
      typeof candidate?.showGrid === 'boolean'
        ? candidate.showGrid
        : DEFAULT_BACKGROUND_LAB_SETTINGS.showGrid,
    showSafeFrame:
      typeof candidate?.showSafeFrame === 'boolean'
        ? candidate.showSafeFrame
        : DEFAULT_BACKGROUND_LAB_SETTINGS.showSafeFrame,
    showBaseline:
      typeof candidate?.showBaseline === 'boolean'
        ? candidate.showBaseline
        : DEFAULT_BACKGROUND_LAB_SETTINGS.showBaseline,
    scrollSpeed: clampNumber(
      candidate?.scrollSpeed,
      -220,
      220,
      DEFAULT_BACKGROUND_LAB_SETTINGS.scrollSpeed
    )
  };
}

export function normalizeElementEditorSettings(value: unknown): ElementEditorSettings {
  const candidate = value as Partial<ElementEditorSettings> | null;

  return {
    selectedLevelId:
      typeof candidate?.selectedLevelId === 'string' && isPlayableLevelId(candidate.selectedLevelId)
        ? candidate.selectedLevelId
        : DEFAULT_ELEMENT_EDITOR_SETTINGS.selectedLevelId,
    selectedKind:
      typeof candidate?.selectedKind === 'string' && isDebugElementKind(candidate.selectedKind)
        ? candidate.selectedKind
        : DEFAULT_ELEMENT_EDITOR_SETTINGS.selectedKind,
    selectedElementId:
      typeof candidate?.selectedElementId === 'string' ? candidate.selectedElementId : null,
    showGrid:
      typeof candidate?.showGrid === 'boolean'
        ? candidate.showGrid
        : DEFAULT_ELEMENT_EDITOR_SETTINGS.showGrid,
    showLabels:
      typeof candidate?.showLabels === 'boolean'
        ? candidate.showLabels
        : DEFAULT_ELEMENT_EDITOR_SETTINGS.showLabels,
    showCollision:
      typeof candidate?.showCollision === 'boolean'
        ? candidate.showCollision
        : DEFAULT_ELEMENT_EDITOR_SETTINGS.showCollision,
    command:
      candidate?.command === 'add' ||
      candidate?.command === 'delete' ||
      candidate?.command === 'duplicate' ||
      candidate?.command === 'nudge'
        ? candidate.command
        : 'none',
    commandSerial: clampNumber(candidate?.commandSerial, 0, 999999, 0),
    nudgeX: clampNumber(candidate?.nudgeX, -256, 256, 0),
    nudgeY: clampNumber(candidate?.nudgeY, -256, 256, 0)
  };
}

export function normalizeLevelProgress(value: unknown): LevelProgressState {
  const candidate = value as Partial<LevelProgressState> | null;
  const unlocked = new Set(
    Array.isArray(candidate?.unlockedLevelIds)
      ? candidate.unlockedLevelIds.filter(isPlayableLevelId)
      : DEFAULT_LEVEL_PROGRESS.unlockedLevelIds
  );
  const completed = new Set(
    Array.isArray(candidate?.completedLevelIds)
      ? candidate.completedLevelIds.filter(isPlayableLevelId)
      : DEFAULT_LEVEL_PROGRESS.completedLevelIds
  );

  unlocked.add(PLAYABLE_LEVEL_IDS[0]);
  completed.forEach((levelId) => {
    unlocked.add(levelId);
    const nextLevelId = getNextLevelId(levelId);

    if (nextLevelId !== null) {
      unlocked.add(nextLevelId);
    }
  });

  return {
    version: 1,
    unlockedLevelIds: sortPlayableIds([...unlocked]),
    completedLevelIds: sortPlayableIds([...completed])
  };
}

export function loadLevelProgress(storage: Storage = window.localStorage): LevelProgressState {
  try {
    const raw = storage.getItem(LEVEL_PROGRESS_STORAGE_KEY);

    return raw === null ? DEFAULT_LEVEL_PROGRESS : normalizeLevelProgress(JSON.parse(raw));
  } catch {
    return DEFAULT_LEVEL_PROGRESS;
  }
}

export function saveLevelProgress(
  progress: LevelProgressState,
  storage: Storage = window.localStorage
): LevelProgressState {
  const normalized = normalizeLevelProgress(progress);
  storage.setItem(LEVEL_PROGRESS_STORAGE_KEY, JSON.stringify(normalized));
  dispatchProgressChanged();

  return normalized;
}

export function resetLevelProgress(storage: Storage = window.localStorage): LevelProgressState {
  return saveLevelProgress(DEFAULT_LEVEL_PROGRESS, storage);
}

export function markLevelCompleted(
  levelId: string,
  storage: Storage = window.localStorage
): LevelProgressState {
  const current = loadLevelProgress(storage);

  return saveLevelProgress(
    {
      ...current,
      completedLevelIds: [...current.completedLevelIds, levelId]
    },
    storage
  );
}

export function setLevelUnlocked(
  levelId: string,
  unlocked: boolean,
  storage: Storage = window.localStorage
): LevelProgressState {
  const current = loadLevelProgress(storage);
  const unlockedIds = new Set(current.unlockedLevelIds);

  if (unlocked) {
    unlockedIds.add(levelId);
  } else if (levelId !== PLAYABLE_LEVEL_IDS[0]) {
    unlockedIds.delete(levelId);
  }

  return saveLevelProgress(
    {
      ...current,
      unlockedLevelIds: [...unlockedIds]
    },
    storage
  );
}

export function buildDebugElementsExport(config: DebugElementsConfig): DebugElementsConfig {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    levels: normalizeDebugElementsConfig(config).levels
  };
}

export function createDebugElement(
  kind: DebugElementKind,
  x: number,
  y: number,
  serial: number
): DebugLevelElement {
  const size = getDefaultElementSize(kind);

  return {
    id: `${kind}-${String(serial).padStart(3, '0')}`,
    kind,
    label: formatElementKind(kind),
    x: Math.round(x - size.width / 2),
    y: Math.round(y - size.height / 2),
    width: size.width,
    height: size.height
  };
}

export function formatElementKind(kind: DebugElementKind): string {
  return kind
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

function element(
  id: string,
  kind: DebugElementKind,
  x: number,
  y: number,
  width: number,
  height: number,
  label: string
): DebugLevelElement {
  return { id, kind, x, y, width, height, label };
}

function cloneElements(elements: readonly DebugLevelElement[]): readonly DebugLevelElement[] {
  return elements.map((elementDefinition) => ({ ...elementDefinition }));
}

function getDefaultElementSize(kind: DebugElementKind): { width: number; height: number } {
  switch (kind) {
    case 'platform':
      return { width: 240, height: 32 };
    case 'hazard':
      return { width: 132, height: 42 };
    case 'pickup':
      return { width: 34, height: 34 };
    case 'spawn':
    case 'enemy':
      return { width: 56, height: 78 };
    case 'goal':
      return { width: 74, height: 96 };
  }
}

function normalizeDebugElement(value: unknown, index: number): DebugLevelElement {
  const candidate = value as Partial<DebugLevelElement> | null;
  const kind =
    typeof candidate?.kind === 'string' && isDebugElementKind(candidate.kind)
      ? candidate.kind
      : 'platform';
  const fallback = getDefaultElementSize(kind);

  return {
    id: sanitizeId(candidate?.id, `${kind}-${index + 1}`),
    kind,
    label: typeof candidate?.label === 'string' ? candidate.label : formatElementKind(kind),
    x: clampNumber(candidate?.x, -9999, 99999, 120 + index * 48),
    y: clampNumber(candidate?.y, -9999, 99999, 480),
    width: clampNumber(candidate?.width, 8, 4000, fallback.width),
    height: clampNumber(candidate?.height, 8, 4000, fallback.height)
  };
}

function sanitizeId(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }

  const id = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/^-+|-+$/gu, '');

  return id || fallback;
}

function getNextLevelId(levelId: string): string | null {
  const index = PLAYABLE_LEVEL_IDS.indexOf(levelId);

  return index >= 0 ? PLAYABLE_LEVEL_IDS[index + 1] ?? null : null;
}

function getSandboxLaneSettingsStorageKey(profileId: string): string {
  return `${SANDBOX_LANE_SETTINGS_STORAGE_KEY_PREFIX}.${encodeURIComponent(profileId)}`;
}

function sortPlayableIds(levelIds: readonly string[]): readonly string[] {
  return PLAYABLE_LEVEL_IDS.filter((levelId) => levelIds.includes(levelId));
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

function dispatchProgressChanged(): void {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new CustomEvent(LEVEL_PROGRESS_CHANGED_EVENT));
}
