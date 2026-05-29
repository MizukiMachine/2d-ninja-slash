import { createGame } from '../game/createGame';
import {
  DEFAULT_PROFILE_ID,
  GAME_PROFILES,
  getProfileById,
  type ProfileId
} from '../game/profiles';
import { SceneKeys } from '../game/sceneKeys';
import {
  BACKGROUND_FILE_NAMES,
  isDebugBackgroundFileName
} from '../game/assets/ninjaAssetCatalog';
import {
  BGM_TRACKS,
  isBgmTrackId
} from '../game/assets/audioAssetCatalog';
import { createGameAudio } from '../game/audio/gameAudio';
import {
  BACKGROUND_FIT_MODES,
  DEBUG_ELEMENT_KINDS,
  DEBUG_ELEMENTS_CONFIG_URL,
  DEBUG_ELEMENTS_SAVE_ENDPOINT,
  DEBUG_LEVELS,
  DEFAULT_GAMEPLAY_TUNING,
  GAMEPLAY_TUNING_CONFIG_URL,
  GAMEPLAY_TUNING_LIMITS,
  GAMEPLAY_TUNING_SAVE_ENDPOINT,
  ROUND_ENEMY_GROWTH_MODES,
  SANDBOX_LANE_SETTINGS_CONFIG_URL,
  SANDBOX_LANE_SETTINGS_SAVE_ENDPOINT,
  buildDebugElementsExport,
  buildSandboxLaneSettingsExport,
  createDefaultDebugElementsConfig,
  createDefaultSandboxLaneSettingsConfig,
  createDefaultSandboxLaneSettings,
  formatElementKind,
  getDebugLevel,
  getDebugLevelElements,
  getSandboxLaneSettingsForProfile,
  loadLevelProgress,
  markLevelCompleted,
  normalizeBackgroundLabSettings,
  normalizeBaselineLabSettings,
  normalizeDebugElementsConfig,
  normalizeElementEditorSettings,
  normalizeGameplayTuning,
  normalizeLevelProgress,
  normalizeRunnerSettings,
  normalizeSandboxLaneSettingsConfig,
  normalizeSandboxLaneSettings,
  resetLevelProgress,
  setSandboxLaneSettingsForProfile,
  setLevelUnlocked,
  type BackgroundFitMode,
  type DebugElementKind,
  type DebugElementsConfig,
  type GameplayTuning,
  type RoundEnemyGrowthMode,
  type SandboxLaneSettingsConfig,
  type SandboxLaneSettings
} from '../game/debugFeatures';
import {
  THREE_LANE_BOTTOM_INSET,
  THREE_LANE_MIN_Y
} from '../game/playerLaneMovement';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  FACING_DIRECTIONS,
  NINJA_ACTORS,
  NINJA_BOUNDS_CONFIG_URL,
  NINJA_BOUNDS_SAVE_ENDPOINT,
  NINJA_FRAME_SIZE,
  NINJA_PLAYBACK_RATE_LIMITS,
  areNinjaRectsEqual,
  applyAllNinjaBoundsToAllActions,
  applyNinjaBoundsKindToAllActions,
  applyNinjaLaneAnchorToAllActions,
  buildNinjaBoundsExport,
  cloneNinjaBoundsConfig,
  getDefaultNinjaActionId,
  getNinjaAction,
  getNinjaAnimationBounds,
  getNinjaAnimationPlaybackRate,
  getNinjaAnimationsForActor,
  getNinjaLaneAnchor,
  getOppositeFacingDirection,
  isNinjaHitFrameActive,
  mirrorNinjaLaneAnchorHorizontally,
  mirrorNinjaRectHorizontally,
  normalizeFacingDirection,
  normalizeNinjaActionId,
  normalizeNinjaActorId,
  normalizeNinjaBoundsConfig,
  normalizeNinjaBoundsKind,
  normalizeNinjaPlaybackRate,
  resetNinjaAnimationConfig,
  setNinjaAnimationBounds,
  setNinjaLaneAnchor,
  setNinjaAnimationPlaybackRate,
  setNinjaHitFrame,
  type FacingDirection,
  type NinjaActorId,
  type NinjaBoundsConfig,
  type NinjaBoundsKind,
  type NinjaLaneAnchor,
  type NinjaRect
} from '../game/ninjaBounds';
import { createDebugStore } from '../stores/debugStore';
import { createSettingsStore } from '../stores/settingsStore';
import type { AppContext } from './context';
import type { Unsubscribe } from '../stores/store';

function requireElement<T extends Element>(
  root: ParentNode,
  selector: string,
  elementType: new (...args: never[]) => T
): T {
  const element = root.querySelector(selector);

  if (!(element instanceof elementType)) {
    throw new Error(`Missing required element: ${selector}`);
  }

  return element;
}

function requestAnimationFrameOnce(callback: () => void): void {
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(callback);
  });
}

function formatProfileLabel(profileId: ProfileId): string {
  return GAME_PROFILES[profileId].id === 'landscape' ? 'Landscape' : 'Portrait';
}

function formatNumber(value: number): string {
  return String(Math.round(value));
}

function formatElapsedMs(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatVector(x: number, y: number): string {
  return `${formatNumber(x)}, ${formatNumber(y)}`;
}

function formatFrameList(frameIndices: readonly number[]): string {
  if (frameIndices.length === 0) {
    return 'none';
  }

  return frameIndices.map((frameIndex) => String(frameIndex + 1)).join(', ');
}

function formatBackgroundLabel(fileName: string): string {
  return fileName.replace(/\.png$/u, '').replaceAll('-', ' ');
}

function formatFrameStripButtons(
  frameCount: number,
  isActive: (frameIndex: number) => boolean,
  currentFrame: number
): string {
  return Array.from({ length: frameCount }, (_, frameIndex) => {
    const active = isActive(frameIndex);
    const activeClass = active ? ' is-active' : '';
    const currentClass = frameIndex === currentFrame ? ' is-current' : '';

    return `<button class="frame-toggle${activeClass}${currentClass}" type="button" data-frame-index="${frameIndex}" aria-pressed="${
      active ? 'true' : 'false'
    }" aria-label="Toggle attack frame ${frameIndex + 1}, currently ${
      active ? 'active' : 'inactive'
    }" title="Attack frame ${frameIndex + 1}: ${active ? 'active' : 'inactive'}"><span class="frame-toggle__number">F${String(
      frameIndex + 1
    ).padStart(2, '0')}</span><span class="frame-toggle__state">${
      active ? 'ON' : 'off'
    }</span></button>`;
  }).join('');
}

function clampRectToFrame(rect: NinjaRect): NinjaRect {
  const x = clampInteger(rect.x, 0, 255);
  const y = clampInteger(rect.y, 0, 255);
  const width = clampInteger(rect.width, 1, 256 - x);
  const height = clampInteger(rect.height, 1, 256 - y);

  return { x, y, width, height };
}

function clampLaneAnchorToFrame(anchor: NinjaLaneAnchor): NinjaLaneAnchor {
  return {
    x: clampInteger(anchor.x, 0, NINJA_FRAME_SIZE - 1),
    y: clampInteger(anchor.y, 0, NINJA_FRAME_SIZE - 1)
  };
}

function areNinjaLaneAnchorsEqual(left: NinjaLaneAnchor, right: NinjaLaneAnchor): boolean {
  return left.x === right.x && left.y === right.y;
}

function clampInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}

function downloadJsonFile(filename: string, payload: object): void {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: 'application/json'
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadNinjaBoundsConfig(): Promise<NinjaBoundsConfig | null> {
  try {
    const response = await fetch(NINJA_BOUNDS_CONFIG_URL, { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    return normalizeNinjaBoundsConfig(await response.json());
  } catch {
    return null;
  }
}

async function loadGameplayTuningConfig(): Promise<GameplayTuning | null> {
  try {
    const response = await fetch(GAMEPLAY_TUNING_CONFIG_URL, { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    return normalizeGameplayTuning(await response.json());
  } catch {
    return null;
  }
}

async function loadDebugElementsConfig(): Promise<DebugElementsConfig | null> {
  try {
    const response = await fetch(DEBUG_ELEMENTS_CONFIG_URL, { cache: 'no-store' });

    if (!response.ok) {
      return null;
    }

    return normalizeDebugElementsConfig(await response.json());
  } catch {
    return null;
  }
}

async function loadSandboxLaneSettingsConfig(): Promise<SandboxLaneSettingsConfig | null> {
  try {
    const response = await fetch(SANDBOX_LANE_SETTINGS_CONFIG_URL, {
      cache: 'no-store'
    });

    if (!response.ok) {
      return null;
    }

    return normalizeSandboxLaneSettingsConfig(await response.json());
  } catch {
    return null;
  }
}

const DEBUG_PANEL_WIDTH_STORAGE_KEY = 'ninja-slash.debugPanelWidth';
const DEBUG_PANEL_DEFAULT_WIDTH = 330;
const DEBUG_PANEL_MIN_WIDTH = 300;
const DEBUG_PANEL_MIN_GAME_WIDTH = 420;
const DEBUG_PANEL_PORTRAIT_MIN_GAME_WIDTH = 320;
const DEBUG_PANEL_RESIZE_STEP = 24;

function loadDebugPanelWidth(): number {
  try {
    const storedWidth = window.localStorage.getItem(DEBUG_PANEL_WIDTH_STORAGE_KEY);

    return clampInteger(
      storedWidth === null ? DEBUG_PANEL_DEFAULT_WIDTH : Number(storedWidth),
      DEBUG_PANEL_MIN_WIDTH,
      900
    );
  } catch {
    return DEBUG_PANEL_DEFAULT_WIDTH;
  }
}

function saveDebugPanelWidth(width: number): void {
  try {
    window.localStorage.setItem(DEBUG_PANEL_WIDTH_STORAGE_KEY, String(width));
  } catch {
    // Ignore storage failures; resizing should still work for the current session.
  }
}

export function createApp(root: HTMLDivElement | null): void {
  if (root === null) {
    throw new Error('Missing #app root.');
  }

  let profileId: ProfileId = DEFAULT_PROFILE_ID;
  let game: ReturnType<typeof createGame> | null = null;
  let playMode = false;
  let playToastTimeout: number | null = null;
  let ninjaBoundsConfig = cloneNinjaBoundsConfig(DEFAULT_NINJA_BOUNDS_CONFIG);
  let debugElementsConfig = createDefaultDebugElementsConfig();
  let sandboxLaneSettingsConfig = createDefaultSandboxLaneSettingsConfig();
  let sandboxLaneSettingsLoadedFromFile = false;
  let sandboxLaneSettingsDirty = false;
  let gymSaveStatus = 'Loaded defaults';
  let gameplayTuningSaveStatus = 'Loaded defaults';
  let laneEditorSaveStatus = 'Loaded defaults';
  let elementEditorSaveStatus = 'Loaded defaults';
  let gymSelectedActorId: NinjaActorId = 'mainNinja';
  let gymSelectedDirection: FacingDirection = 'right';
  let gymSelectedActionId = getDefaultNinjaActionId(gymSelectedActorId);
  let gymSelectedBoundsKind: NinjaBoundsKind = 'collision';
  let gymShowVisualBounds = true;
  let gymShowCollisionBounds = true;
  let gymShowAttackBounds = true;
  let gymPlaybackRate = 1;
  let gymControlsRenderFrame: number | null = null;
  let gymFrameStripSignature = '';
  let levelProgressControlsSignature = '';
  let debugPanelWidth = loadDebugPanelWidth();

  const debugStore = createDebugStore();
  const settingsStore = createSettingsStore();
  const audio = createGameAudio();
  const getCurrentProfileHeight = (): number => getProfileById(profileId).height;
  const getCurrentSandboxLaneSettings = (): SandboxLaneSettings =>
    getSandboxLaneSettingsForProfile(
      sandboxLaneSettingsConfig,
      profileId,
      getCurrentProfileHeight()
    );
  const applySandboxLaneSettingsForCurrentProfile = (): void => {
    debugStore.setSandboxLaneSettings(getCurrentSandboxLaneSettings());
  };
  const setSandboxLaneSettingsForCurrentProfile = (
    settings: SandboxLaneSettings,
    saveStatus = 'Unsaved lane changes'
  ): SandboxLaneSettings => {
    const worldHeight = getCurrentProfileHeight();
    const normalizedSettings = normalizeSandboxLaneSettings(settings, worldHeight);

    sandboxLaneSettingsConfig = setSandboxLaneSettingsForProfile(
      sandboxLaneSettingsConfig,
      profileId,
      normalizedSettings,
      worldHeight
    );
    sandboxLaneSettingsDirty = true;
    laneEditorSaveStatus = saveStatus;
    debugStore.setSandboxLaneSettings(normalizedSettings);

    return normalizedSettings;
  };
  const context: AppContext = {
    debugStore,
    settingsStore,
    audio,
    getProfile: () => getProfileById(profileId),
    getNinjaBoundsConfig: () => ninjaBoundsConfig,
    getDebugElementsConfig: () => debugElementsConfig,
    setDebugElementsConfig: (config) => {
      debugElementsConfig = normalizeDebugElementsConfig(config);
      elementEditorSaveStatus = 'Unsaved element changes';
      debugStore.setElementEditor(normalizeElementEditorSettings(debugStore.get().elementEditor));
    },
    setSandboxLaneSettings: (settings) => {
      setSandboxLaneSettingsForCurrentProfile(settings);
    }
  };

  root.className = 'app-shell';
  root.dataset.profile = profileId;
  root.innerHTML = `
    <header class="app-shell__header">
      <div class="app-shell__brand">
        <p class="eyebrow">PHASER 4 DEBUG LAB</p>
        <h1>2D Ninja Slash</h1>
        <p class="subtitle">Level, element, runner, and tuning workspace</p>
      </div>
      <div class="app-shell__header-action">
        <button id="play-toggle" class="shell-button" data-variant="primary" type="button" aria-pressed="false">Play</button>
      </div>
      <div class="app-shell__status">
        <button id="profile-toggle" class="status-chip" type="button" title="Toggle profile">Landscape</button>
        <span id="scene-badge" class="status-chip" data-tone="muted" aria-live="polite">Boot</span>
      </div>
    </header>
    <main class="app-shell__workspace">
      <section class="game-host" aria-label="Game canvas">
        <div class="game-host__bezel-label">
          <span>Game Canvas</span>
          <span class="dots"><i></i><i></i><i></i></span>
        </div>
        <div id="game-root" class="game-root"></div>
      </section>
      <div id="debug-resize" class="debug-resize" role="separator" aria-label="Resize debug console" aria-orientation="vertical" tabindex="0"></div>
      <aside id="debug-panel" class="debug-panel">
        <div class="debug-panel__header">
          <h2 class="debug-panel__title">Debug Console</h2>
          <button id="debug-collapse" class="shell-button" type="button">Collapse</button>
        </div>
        <div class="debug-panel__body">
          <div id="debug-controls" class="debug-panel__controls"></div>
        </div>
      </aside>
    </main>
    <div id="play-toast" class="play-toast" role="status" aria-live="polite">Press ESC to return to editor</div>
  `;

  const playButton = requireElement(root, '#play-toggle', HTMLButtonElement);
  const profileToggle = requireElement(root, '#profile-toggle', HTMLButtonElement);
  const sceneBadge = requireElement(root, '#scene-badge', HTMLElement);
  const workspace = requireElement(root, '.app-shell__workspace', HTMLElement);
  const gameMount = requireElement(root, '#game-root', HTMLDivElement);
  const debugResizeHandle = requireElement(root, '#debug-resize', HTMLDivElement);
  const debugPanel = requireElement(root, '#debug-panel', HTMLElement);
  const debugCollapse = requireElement(root, '#debug-collapse', HTMLButtonElement);
  const debugControls = requireElement(root, '#debug-controls', HTMLDivElement);
  const playToast = requireElement(root, '#play-toast', HTMLElement);

  gameMount.tabIndex = 0;

  debugControls.innerHTML = `
    <div class="panel-group">
      <p class="panel-group__title">Runtime</p>
      <button id="pause-toggle" class="shell-button" data-variant="primary" type="button">Pause</button>
      <button id="reset-actors" class="shell-button" type="button">Reset actors</button>
      <label class="toggle-row"><input id="show-world" type="checkbox" /> World bounds</label>
      <label class="toggle-row"><input id="enemy-ai" type="checkbox" /> Enemy AI</label>
      <label class="select-row" for="background-file">
        <span>Background</span>
        <select id="background-file"></select>
      </label>
      <label class="select-row" for="bgm-track">
        <span>BGM</span>
        <select id="bgm-track">
          ${BGM_TRACKS.map((track) => `<option value="${track.id}">${track.label}</option>`).join('')}
        </select>
      </label>
    </div>
    <div class="panel-group">
      <p class="panel-group__title">Scenes</p>
      <div class="panel-group__row">
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.Sandbox}">Sandbox</button>
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.Gym}">Gym</button>
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.LaneEditor}">Lanes</button>
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.LevelProgress}">Levels</button>
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.ElementEditor}">Elements</button>
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.BaselineLevel}">Baseline</button>
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.RunnerLab}">Runner</button>
        <button class="shell-button" type="button" data-debug-scene="${SceneKeys.BackgroundLab}">Background</button>
      </div>
    </div>
    <div class="panel-group">
      <p class="panel-group__title">Overlays</p>
      <label class="toggle-row"><input id="show-visual-bounds" type="checkbox" /> Visual bounds</label>
      <label class="toggle-row"><input id="show-hit-boxes" type="checkbox" /> Hit boxes</label>
      <label class="toggle-row"><input id="show-attack-boxes" type="checkbox" /> Attack boxes</label>
      <label class="toggle-row"><input id="show-origins" type="checkbox" /> Origins</label>
      <label class="toggle-row"><input id="show-pointer-probe" type="checkbox" /> Pointer probe</label>
      <label class="toggle-row"><input id="show-enemy-ranges" type="checkbox" /> Enemy attack box</label>
    </div>
    <div id="lane-editor-controls" class="panel-group">
      <p class="panel-group__title">Lane Editor</p>
      <label class="toggle-row"><input id="show-lane-guides" type="checkbox" /> Show in Sandbox</label>
      <label class="range-row">
        <span>Upper Y</span>
        <input id="lane-upper-y" type="range" min="0" max="720" step="1" />
        <strong id="lane-upper-y-readout">372</strong>
      </label>
      <label class="range-row">
        <span>Middle Y</span>
        <input id="lane-middle-y" type="range" min="0" max="720" step="1" />
        <strong id="lane-middle-y-readout">468</strong>
      </label>
      <label class="range-row">
        <span>Lower Y</span>
        <input id="lane-lower-y" type="range" min="0" max="720" step="1" />
        <strong id="lane-lower-y-readout">564</strong>
      </label>
      <div class="editor-grid">
        <label class="number-row"><span>U</span><input id="lane-upper-y-number" type="number" min="0" max="720" step="1" /></label>
        <label class="number-row"><span>M</span><input id="lane-middle-y-number" type="number" min="0" max="720" step="1" /></label>
        <label class="number-row"><span>L</span><input id="lane-lower-y-number" type="number" min="0" max="720" step="1" /></label>
      </div>
      <div class="panel-group__row">
        <button id="lane-save" class="shell-button" data-variant="primary" type="button">Save</button>
        <button id="lane-reset" class="shell-button" type="button">Reset</button>
      </div>
      <p id="lane-save-status" class="panel-note">Loaded defaults</p>
    </div>
    <div class="panel-group">
      <p class="panel-group__title">Gameplay Tuning</p>
      <label class="range-row">
        <span>Player</span>
        <input id="tuning-player-speed" type="range" min="${GAMEPLAY_TUNING_LIMITS.playerSpeed.min}" max="${GAMEPLAY_TUNING_LIMITS.playerSpeed.max}" step="${GAMEPLAY_TUNING_LIMITS.playerSpeed.step}" />
        <strong id="tuning-player-speed-readout">260</strong>
      </label>
      <label class="range-row">
        <span>Enemy</span>
        <input id="tuning-enemy-speed" type="range" min="${GAMEPLAY_TUNING_LIMITS.enemySpeed.min}" max="${GAMEPLAY_TUNING_LIMITS.enemySpeed.max}" step="${GAMEPLAY_TUNING_LIMITS.enemySpeed.step}" />
        <strong id="tuning-enemy-speed-readout">260</strong>
      </label>
      <label class="range-row">
        <span>Recover</span>
        <input id="tuning-recovery" type="range" min="${GAMEPLAY_TUNING_LIMITS.enemyRecoveryMs.min}" max="${GAMEPLAY_TUNING_LIMITS.enemyRecoveryMs.max}" step="${GAMEPLAY_TUNING_LIMITS.enemyRecoveryMs.step}" />
        <strong id="tuning-recovery-readout">900</strong>
      </label>
      <label class="range-row">
        <span>Knockback</span>
        <input id="tuning-knockback" type="range" min="${GAMEPLAY_TUNING_LIMITS.playerKnockbackSpeed.min}" max="${GAMEPLAY_TUNING_LIMITS.playerKnockbackSpeed.max}" step="${GAMEPLAY_TUNING_LIMITS.playerKnockbackSpeed.step}" />
        <strong id="tuning-knockback-readout">360</strong>
      </label>
      <label class="range-row">
        <span>Round base</span>
        <input id="tuning-round-base" type="range" min="${GAMEPLAY_TUNING_LIMITS.roundEnemyBaseCount.min}" max="${GAMEPLAY_TUNING_LIMITS.roundEnemyBaseCount.max}" step="${GAMEPLAY_TUNING_LIMITS.roundEnemyBaseCount.step}" />
        <strong id="tuning-round-base-readout">1</strong>
      </label>
      <label class="range-row">
        <span>Round step</span>
        <input id="tuning-round-step" type="range" min="${GAMEPLAY_TUNING_LIMITS.roundEnemyIncrease.min}" max="${GAMEPLAY_TUNING_LIMITS.roundEnemyIncrease.max}" step="${GAMEPLAY_TUNING_LIMITS.roundEnemyIncrease.step}" />
        <strong id="tuning-round-step-readout">1</strong>
      </label>
      <label class="range-row">
        <span>Round max</span>
        <input id="tuning-round-max" type="range" min="${GAMEPLAY_TUNING_LIMITS.roundEnemyMaxCount.min}" max="${GAMEPLAY_TUNING_LIMITS.roundEnemyMaxCount.max}" step="${GAMEPLAY_TUNING_LIMITS.roundEnemyMaxCount.step}" />
        <strong id="tuning-round-max-readout">9</strong>
      </label>
      <label class="range-row">
        <span>Wait</span>
        <input id="tuning-round-wait" type="range" min="${GAMEPLAY_TUNING_LIMITS.roundIntermissionMs.min}" max="${GAMEPLAY_TUNING_LIMITS.roundIntermissionMs.max}" step="${GAMEPLAY_TUNING_LIMITS.roundIntermissionMs.step}" />
        <strong id="tuning-round-wait-readout">1200</strong>
      </label>
      <label class="select-row" for="tuning-round-growth">
        <span>Round growth</span>
        <select id="tuning-round-growth">
          ${ROUND_ENEMY_GROWTH_MODES.map((mode) => `<option value="${mode}">${mode}</option>`).join('')}
        </select>
      </label>
      <div class="panel-group__row">
        <button id="tuning-save" class="shell-button" data-variant="primary" type="button">Save</button>
        <button id="tuning-reset" class="shell-button" type="button">Reset</button>
      </div>
      <p id="tuning-save-status" class="panel-note">Loaded defaults</p>
    </div>
    <div class="panel-group">
      <p class="panel-group__title">Level Progress</p>
      <div id="level-progress-list" class="toggle-list"></div>
      <div class="panel-group__row">
        <button id="level-progress-complete" class="shell-button" type="button">Complete selected</button>
        <button id="level-progress-reset" class="shell-button" type="button">Reset progress</button>
      </div>
    </div>
    <div id="background-lab-controls" class="panel-group" hidden>
      <p class="panel-group__title">Background Lab</p>
      <label class="select-row" for="background-fit-mode">
        <span>Fit</span>
        <select id="background-fit-mode">
          ${BACKGROUND_FIT_MODES.map((mode) => `<option value="${mode}">${mode}</option>`).join('')}
        </select>
      </label>
      <label class="toggle-row"><input id="background-show-grid" type="checkbox" /> Grid</label>
      <label class="toggle-row"><input id="background-show-safe" type="checkbox" /> Safe frame</label>
      <label class="toggle-row"><input id="background-show-baseline" type="checkbox" /> Baseline</label>
      <label class="range-row">
        <span>Scroll</span>
        <input id="background-scroll-speed" type="range" min="-220" max="220" step="10" />
        <strong id="background-scroll-readout">0</strong>
      </label>
    </div>
    <div id="runner-controls" class="panel-group" hidden>
      <p class="panel-group__title">Runner Generator</p>
      <label class="range-row"><span>Seed</span><input id="runner-seed" type="range" min="1" max="999" step="1" /><strong id="runner-seed-readout">7</strong></label>
      <label class="range-row"><span>Difficulty</span><input id="runner-difficulty" type="range" min="0" max="1" step="0.01" /><strong id="runner-difficulty-readout">0.42</strong></label>
      <label class="range-row"><span>Gaps</span><input id="runner-gaps" type="range" min="0" max="1" step="0.01" /><strong id="runner-gaps-readout">0.34</strong></label>
      <label class="range-row"><span>Lanes</span><input id="runner-lanes" type="range" min="1" max="5" step="1" /><strong id="runner-lanes-readout">3</strong></label>
      <label class="range-row"><span>Speed</span><input id="runner-speed" type="range" min="0" max="520" step="10" /><strong id="runner-speed-readout">230</strong></label>
      <label class="toggle-row"><input id="runner-show-plan" type="checkbox" /> Plan view</label>
      <label class="toggle-row"><input id="runner-show-hitboxes" type="checkbox" /> Hitboxes</label>
    </div>
    <div id="baseline-controls" class="panel-group" hidden>
      <p class="panel-group__title">Baseline Level</p>
      <label class="select-row" for="baseline-level-select">
        <span>Level</span>
        <select id="baseline-level-select">
          ${DEBUG_LEVELS.map((level) => `<option value="${level.id}">${level.label}</option>`).join('')}
        </select>
      </label>
      <label class="toggle-row"><input id="baseline-show-hitboxes" type="checkbox" /> Hitboxes</label>
      <label class="toggle-row"><input id="baseline-show-spawn-goal" type="checkbox" /> Spawn / goal</label>
      <label class="toggle-row"><input id="baseline-show-camera-bands" type="checkbox" /> Camera bands</label>
    </div>
    <div id="element-editor-controls" class="panel-group" hidden>
      <p class="panel-group__title">Element Editor</p>
      <label class="select-row" for="element-level">
        <span>Level</span>
        <select id="element-level">
          ${DEBUG_LEVELS.map((level) => `<option value="${level.id}">${level.label}</option>`).join('')}
        </select>
      </label>
      <label class="select-row" for="element-kind">
        <span>Kind</span>
        <select id="element-kind">
          ${DEBUG_ELEMENT_KINDS.map((kind) => `<option value="${kind}">${formatElementKind(kind)}</option>`).join('')}
        </select>
      </label>
      <label class="toggle-row"><input id="element-show-grid" type="checkbox" /> Grid</label>
      <label class="toggle-row"><input id="element-show-labels" type="checkbox" /> Labels</label>
      <label class="toggle-row"><input id="element-show-collision" type="checkbox" /> Collision inset</label>
      <div class="panel-group__row">
        <button id="element-add" class="shell-button" type="button">Add</button>
        <button id="element-duplicate" class="shell-button" type="button">Duplicate</button>
        <button id="element-delete" class="shell-button" type="button">Delete</button>
      </div>
      <div class="panel-group__row">
        <button class="shell-button" type="button" data-element-nudge="0,-8">Up</button>
        <button class="shell-button" type="button" data-element-nudge="-8,0">Left</button>
        <button class="shell-button" type="button" data-element-nudge="8,0">Right</button>
        <button class="shell-button" type="button" data-element-nudge="0,8">Down</button>
      </div>
      <div class="panel-group__row">
        <button id="element-save" class="shell-button" data-variant="primary" type="button">Save</button>
        <button id="element-export" class="shell-button" type="button">Export</button>
      </div>
      <p id="element-editor-readout" class="panel-note">Loaded defaults</p>
    </div>
    <div id="gym-controls" class="panel-group" hidden>
      <div class="panel-group__header">
        <p class="panel-group__title">Gym</p>
        <button id="gym-exit" class="shell-button" type="button">Exit Gym</button>
      </div>
      <label class="select-row" for="gym-actor">
        <span>Actor</span>
        <select id="gym-actor">
          ${NINJA_ACTORS.map(
            (actor) => `<option value="${actor.id}">${actor.label}</option>`
          ).join('')}
        </select>
      </label>
      <label class="select-row" for="gym-direction">
        <span>Direction</span>
        <select id="gym-direction">
          ${FACING_DIRECTIONS.map(
            (direction) => `<option value="${direction}">${direction}</option>`
          ).join('')}
        </select>
      </label>
      <label class="select-row" for="gym-action">
        <span>Animation</span>
        <select id="gym-action"></select>
      </label>
      <label class="toggle-row"><input id="gym-show-visual" type="checkbox" /> Visual bounds</label>
      <label class="toggle-row"><input id="gym-show-collision" type="checkbox" /> Collision bounds</label>
      <label class="toggle-row"><input id="gym-show-attack" type="checkbox" /> Attack bounds</label>
      <label class="range-row">
        <span>Action speed</span>
        <input id="gym-playback-rate" type="range" min="${NINJA_PLAYBACK_RATE_LIMITS.min}" max="${NINJA_PLAYBACK_RATE_LIMITS.max}" step="${NINJA_PLAYBACK_RATE_LIMITS.step}" />
        <strong id="gym-playback-readout">1.00x</strong>
      </label>
      <div class="frame-control">
        <div class="frame-control__header">
          <span>Attack Frames</span>
          <strong id="gym-frame-readout">1/32</strong>
        </div>
        <p id="gym-attack-frame-readout" class="panel-note">Active: none</p>
        <div id="gym-attack-frame-strip" class="frame-strip" aria-label="Attack active frames"></div>
        <div class="panel-group__row">
          <button id="gym-toggle-current-hit-frame" class="shell-button" type="button">Enable current</button>
          <button id="gym-only-current-hit-frame" class="shell-button" type="button">Only current</button>
          <button id="gym-clear-hit-frames" class="shell-button" type="button">Clear</button>
          <button id="gym-reset-hit-frames" class="shell-button" type="button">Default</button>
        </div>
      </div>
      <label class="select-row" for="gym-bounds-kind">
        <span>Bounds</span>
        <select id="gym-bounds-kind">
          <option value="visual">Visual</option>
          <option value="collision">Collision</option>
          <option value="attack">Attack</option>
        </select>
      </label>
      <div class="editor-grid">
        <label class="number-row"><span>X</span><input id="gym-bounds-x" type="number" min="0" max="255" step="1" /></label>
        <label class="number-row"><span>Y</span><input id="gym-bounds-y" type="number" min="0" max="255" step="1" /></label>
        <label class="number-row"><span>W</span><input id="gym-bounds-width" type="number" min="1" max="256" step="1" /></label>
        <label class="number-row"><span>H</span><input id="gym-bounds-height" type="number" min="1" max="256" step="1" /></label>
      </div>
      <div class="panel-group__row">
        <button id="gym-save-bounds" class="shell-button" data-variant="primary" type="button">Save config</button>
        <button id="gym-reset-bounds" class="shell-button" type="button">Reset</button>
        <button id="gym-mirror-direction" class="shell-button" type="button">Mirror selected</button>
        <button id="gym-apply-kind-all" class="shell-button" type="button">Apply selected</button>
        <button id="gym-apply-all" class="shell-button" type="button">Apply all</button>
      </div>
      <div class="frame-control">
        <div class="frame-control__header">
          <span>Lane Anchor</span>
          <strong id="gym-lane-anchor-readout">X64 Y127</strong>
        </div>
        <div class="editor-grid">
          <label class="number-row"><span>X</span><input id="gym-lane-anchor-x" type="number" min="0" max="${NINJA_FRAME_SIZE - 1}" step="1" /></label>
          <label class="number-row"><span>Y</span><input id="gym-lane-anchor-y" type="number" min="0" max="${NINJA_FRAME_SIZE - 1}" step="1" /></label>
        </div>
        <div class="panel-group__row">
          <button id="gym-mirror-lane-anchor" class="shell-button" type="button">Mirror anchor</button>
          <button id="gym-apply-lane-anchor-all" class="shell-button" type="button">Apply all</button>
        </div>
      </div>
      <p id="gym-save-status" class="panel-note">Loaded defaults</p>
    </div>
    <div class="metrics">
      <div class="metrics__row"><span>Scene</span><strong id="scene-readout">Boot</strong></div>
      <div class="metrics__row"><span>FPS</span><strong id="fps-readout">0</strong></div>
      <div class="metrics__row"><span>Pointer</span><strong id="pointer-readout">0, 0</strong></div>
      <div class="metrics__row"><span>Input</span><strong id="input-readout">idle</strong></div>
      <div class="metrics__row"><span>Player</span><strong id="player-readout">none</strong></div>
      <div class="metrics__row"><span>Enemy</span><strong id="enemy-readout">none</strong></div>
      <div class="metrics__row"><span>Attack</span><strong id="attack-readout">inactive</strong></div>
      <div class="metrics__row"><span>Round</span><strong id="round-readout">ready</strong></div>
    </div>
  `;

  const pauseToggle = requireElement(debugControls, '#pause-toggle', HTMLButtonElement);
  const resetActorsButton = requireElement(debugControls, '#reset-actors', HTMLButtonElement);
  const showWorldToggle = requireElement(debugControls, '#show-world', HTMLInputElement);
  const showVisualBoundsToggle = requireElement(
    debugControls,
    '#show-visual-bounds',
    HTMLInputElement
  );
  const showHitBoxesToggle = requireElement(debugControls, '#show-hit-boxes', HTMLInputElement);
  const showAttackBoxesToggle = requireElement(
    debugControls,
    '#show-attack-boxes',
    HTMLInputElement
  );
  const showOriginsToggle = requireElement(debugControls, '#show-origins', HTMLInputElement);
  const showPointerProbeToggle = requireElement(
    debugControls,
    '#show-pointer-probe',
    HTMLInputElement
  );
  const showEnemyRangesToggle = requireElement(
    debugControls,
    '#show-enemy-ranges',
    HTMLInputElement
  );
  const laneEditorControls = requireElement(
    debugControls,
    '#lane-editor-controls',
    HTMLElement
  );
  const showLaneGuidesToggle = requireElement(
    debugControls,
    '#show-lane-guides',
    HTMLInputElement
  );
  const laneUpperYInput = requireElement(debugControls, '#lane-upper-y', HTMLInputElement);
  const laneMiddleYInput = requireElement(debugControls, '#lane-middle-y', HTMLInputElement);
  const laneLowerYInput = requireElement(debugControls, '#lane-lower-y', HTMLInputElement);
  const laneUpperYReadout = requireElement(
    debugControls,
    '#lane-upper-y-readout',
    HTMLElement
  );
  const laneMiddleYReadout = requireElement(
    debugControls,
    '#lane-middle-y-readout',
    HTMLElement
  );
  const laneLowerYReadout = requireElement(
    debugControls,
    '#lane-lower-y-readout',
    HTMLElement
  );
  const laneUpperYNumberInput = requireElement(
    debugControls,
    '#lane-upper-y-number',
    HTMLInputElement
  );
  const laneMiddleYNumberInput = requireElement(
    debugControls,
    '#lane-middle-y-number',
    HTMLInputElement
  );
  const laneLowerYNumberInput = requireElement(
    debugControls,
    '#lane-lower-y-number',
    HTMLInputElement
  );
  const laneSaveButton = requireElement(debugControls, '#lane-save', HTMLButtonElement);
  const laneResetButton = requireElement(debugControls, '#lane-reset', HTMLButtonElement);
  const laneSaveStatus = requireElement(debugControls, '#lane-save-status', HTMLElement);
  const enemyAiToggle = requireElement(debugControls, '#enemy-ai', HTMLInputElement);
  const backgroundFileSelect = requireElement(debugControls, '#background-file', HTMLSelectElement);
  const bgmTrackSelect = requireElement(debugControls, '#bgm-track', HTMLSelectElement);
  const tuningPlayerSpeedInput = requireElement(
    debugControls,
    '#tuning-player-speed',
    HTMLInputElement
  );
  const tuningPlayerSpeedReadout = requireElement(
    debugControls,
    '#tuning-player-speed-readout',
    HTMLElement
  );
  const tuningEnemySpeedInput = requireElement(
    debugControls,
    '#tuning-enemy-speed',
    HTMLInputElement
  );
  const tuningEnemySpeedReadout = requireElement(
    debugControls,
    '#tuning-enemy-speed-readout',
    HTMLElement
  );
  const tuningRecoveryInput = requireElement(
    debugControls,
    '#tuning-recovery',
    HTMLInputElement
  );
  const tuningRecoveryReadout = requireElement(
    debugControls,
    '#tuning-recovery-readout',
    HTMLElement
  );
  const tuningKnockbackInput = requireElement(
    debugControls,
    '#tuning-knockback',
    HTMLInputElement
  );
  const tuningKnockbackReadout = requireElement(
    debugControls,
    '#tuning-knockback-readout',
    HTMLElement
  );
  const tuningRoundBaseInput = requireElement(
    debugControls,
    '#tuning-round-base',
    HTMLInputElement
  );
  const tuningRoundBaseReadout = requireElement(
    debugControls,
    '#tuning-round-base-readout',
    HTMLElement
  );
  const tuningRoundStepInput = requireElement(
    debugControls,
    '#tuning-round-step',
    HTMLInputElement
  );
  const tuningRoundStepReadout = requireElement(
    debugControls,
    '#tuning-round-step-readout',
    HTMLElement
  );
  const tuningRoundMaxInput = requireElement(
    debugControls,
    '#tuning-round-max',
    HTMLInputElement
  );
  const tuningRoundMaxReadout = requireElement(
    debugControls,
    '#tuning-round-max-readout',
    HTMLElement
  );
  const tuningRoundWaitInput = requireElement(
    debugControls,
    '#tuning-round-wait',
    HTMLInputElement
  );
  const tuningRoundWaitReadout = requireElement(
    debugControls,
    '#tuning-round-wait-readout',
    HTMLElement
  );
  const tuningRoundGrowthSelect = requireElement(
    debugControls,
    '#tuning-round-growth',
    HTMLSelectElement
  );
  const tuningSaveButton = requireElement(debugControls, '#tuning-save', HTMLButtonElement);
  const tuningResetButton = requireElement(debugControls, '#tuning-reset', HTMLButtonElement);
  const tuningSaveStatus = requireElement(debugControls, '#tuning-save-status', HTMLElement);
  const levelProgressList = requireElement(debugControls, '#level-progress-list', HTMLElement);
  const levelProgressCompleteButton = requireElement(
    debugControls,
    '#level-progress-complete',
    HTMLButtonElement
  );
  const levelProgressResetButton = requireElement(
    debugControls,
    '#level-progress-reset',
    HTMLButtonElement
  );
  const backgroundLabControls = requireElement(
    debugControls,
    '#background-lab-controls',
    HTMLElement
  );
  const backgroundFitModeSelect = requireElement(
    debugControls,
    '#background-fit-mode',
    HTMLSelectElement
  );
  const backgroundShowGridToggle = requireElement(
    debugControls,
    '#background-show-grid',
    HTMLInputElement
  );
  const backgroundShowSafeToggle = requireElement(
    debugControls,
    '#background-show-safe',
    HTMLInputElement
  );
  const backgroundShowBaselineToggle = requireElement(
    debugControls,
    '#background-show-baseline',
    HTMLInputElement
  );
  const backgroundScrollSpeedInput = requireElement(
    debugControls,
    '#background-scroll-speed',
    HTMLInputElement
  );
  const backgroundScrollReadout = requireElement(
    debugControls,
    '#background-scroll-readout',
    HTMLElement
  );
  const runnerControls = requireElement(debugControls, '#runner-controls', HTMLElement);
  const runnerSeedInput = requireElement(debugControls, '#runner-seed', HTMLInputElement);
  const runnerSeedReadout = requireElement(debugControls, '#runner-seed-readout', HTMLElement);
  const runnerDifficultyInput = requireElement(
    debugControls,
    '#runner-difficulty',
    HTMLInputElement
  );
  const runnerDifficultyReadout = requireElement(
    debugControls,
    '#runner-difficulty-readout',
    HTMLElement
  );
  const runnerGapsInput = requireElement(debugControls, '#runner-gaps', HTMLInputElement);
  const runnerGapsReadout = requireElement(debugControls, '#runner-gaps-readout', HTMLElement);
  const runnerLanesInput = requireElement(debugControls, '#runner-lanes', HTMLInputElement);
  const runnerLanesReadout = requireElement(debugControls, '#runner-lanes-readout', HTMLElement);
  const runnerSpeedInput = requireElement(debugControls, '#runner-speed', HTMLInputElement);
  const runnerSpeedReadout = requireElement(debugControls, '#runner-speed-readout', HTMLElement);
  const runnerShowPlanToggle = requireElement(
    debugControls,
    '#runner-show-plan',
    HTMLInputElement
  );
  const runnerShowHitboxesToggle = requireElement(
    debugControls,
    '#runner-show-hitboxes',
    HTMLInputElement
  );
  const baselineControls = requireElement(debugControls, '#baseline-controls', HTMLElement);
  const baselineLevelSelect = requireElement(
    debugControls,
    '#baseline-level-select',
    HTMLSelectElement
  );
  const baselineShowHitboxesToggle = requireElement(
    debugControls,
    '#baseline-show-hitboxes',
    HTMLInputElement
  );
  const baselineShowSpawnGoalToggle = requireElement(
    debugControls,
    '#baseline-show-spawn-goal',
    HTMLInputElement
  );
  const baselineShowCameraBandsToggle = requireElement(
    debugControls,
    '#baseline-show-camera-bands',
    HTMLInputElement
  );
  const elementEditorControls = requireElement(
    debugControls,
    '#element-editor-controls',
    HTMLElement
  );
  const elementLevelSelect = requireElement(debugControls, '#element-level', HTMLSelectElement);
  const elementKindSelect = requireElement(debugControls, '#element-kind', HTMLSelectElement);
  const elementShowGridToggle = requireElement(
    debugControls,
    '#element-show-grid',
    HTMLInputElement
  );
  const elementShowLabelsToggle = requireElement(
    debugControls,
    '#element-show-labels',
    HTMLInputElement
  );
  const elementShowCollisionToggle = requireElement(
    debugControls,
    '#element-show-collision',
    HTMLInputElement
  );
  const elementAddButton = requireElement(debugControls, '#element-add', HTMLButtonElement);
  const elementDuplicateButton = requireElement(
    debugControls,
    '#element-duplicate',
    HTMLButtonElement
  );
  const elementDeleteButton = requireElement(debugControls, '#element-delete', HTMLButtonElement);
  const elementSaveButton = requireElement(debugControls, '#element-save', HTMLButtonElement);
  const elementExportButton = requireElement(debugControls, '#element-export', HTMLButtonElement);
  const elementEditorReadout = requireElement(
    debugControls,
    '#element-editor-readout',
    HTMLElement
  );
  const gymControls = requireElement(debugControls, '#gym-controls', HTMLElement);
  const gymExitButton = requireElement(debugControls, '#gym-exit', HTMLButtonElement);
  const gymActorSelect = requireElement(debugControls, '#gym-actor', HTMLSelectElement);
  const gymDirectionSelect = requireElement(debugControls, '#gym-direction', HTMLSelectElement);
  const gymActionSelect = requireElement(debugControls, '#gym-action', HTMLSelectElement);
  const gymShowVisualToggle = requireElement(debugControls, '#gym-show-visual', HTMLInputElement);
  const gymShowCollisionToggle = requireElement(
    debugControls,
    '#gym-show-collision',
    HTMLInputElement
  );
  const gymShowAttackToggle = requireElement(debugControls, '#gym-show-attack', HTMLInputElement);
  const gymPlaybackRateInput = requireElement(
    debugControls,
    '#gym-playback-rate',
    HTMLInputElement
  );
  const gymPlaybackReadout = requireElement(
    debugControls,
    '#gym-playback-readout',
    HTMLElement
  );
  const gymFrameReadout = requireElement(debugControls, '#gym-frame-readout', HTMLElement);
  const gymAttackFrameReadout = requireElement(
    debugControls,
    '#gym-attack-frame-readout',
    HTMLElement
  );
  const gymAttackFrameStrip = requireElement(
    debugControls,
    '#gym-attack-frame-strip',
    HTMLElement
  );
  const gymToggleCurrentHitFrameButton = requireElement(
    debugControls,
    '#gym-toggle-current-hit-frame',
    HTMLButtonElement
  );
  const gymOnlyCurrentHitFrameButton = requireElement(
    debugControls,
    '#gym-only-current-hit-frame',
    HTMLButtonElement
  );
  const gymClearHitFramesButton = requireElement(
    debugControls,
    '#gym-clear-hit-frames',
    HTMLButtonElement
  );
  const gymResetHitFramesButton = requireElement(
    debugControls,
    '#gym-reset-hit-frames',
    HTMLButtonElement
  );
  const gymBoundsKindSelect = requireElement(
    debugControls,
    '#gym-bounds-kind',
    HTMLSelectElement
  );
  const gymBoundsXInput = requireElement(debugControls, '#gym-bounds-x', HTMLInputElement);
  const gymBoundsYInput = requireElement(debugControls, '#gym-bounds-y', HTMLInputElement);
  const gymBoundsWidthInput = requireElement(
    debugControls,
    '#gym-bounds-width',
    HTMLInputElement
  );
  const gymBoundsHeightInput = requireElement(
    debugControls,
    '#gym-bounds-height',
    HTMLInputElement
  );
  const gymSaveBoundsButton = requireElement(
    debugControls,
    '#gym-save-bounds',
    HTMLButtonElement
  );
  const gymResetBoundsButton = requireElement(
    debugControls,
    '#gym-reset-bounds',
    HTMLButtonElement
  );
  const gymMirrorDirectionButton = requireElement(
    debugControls,
    '#gym-mirror-direction',
    HTMLButtonElement
  );
  const gymApplyKindAllButton = requireElement(
    debugControls,
    '#gym-apply-kind-all',
    HTMLButtonElement
  );
  const gymApplyAllButton = requireElement(
    debugControls,
    '#gym-apply-all',
    HTMLButtonElement
  );
  const gymLaneAnchorReadout = requireElement(
    debugControls,
    '#gym-lane-anchor-readout',
    HTMLElement
  );
  const gymLaneAnchorXInput = requireElement(
    debugControls,
    '#gym-lane-anchor-x',
    HTMLInputElement
  );
  const gymLaneAnchorYInput = requireElement(
    debugControls,
    '#gym-lane-anchor-y',
    HTMLInputElement
  );
  const gymMirrorLaneAnchorButton = requireElement(
    debugControls,
    '#gym-mirror-lane-anchor',
    HTMLButtonElement
  );
  const gymApplyLaneAnchorAllButton = requireElement(
    debugControls,
    '#gym-apply-lane-anchor-all',
    HTMLButtonElement
  );
  const gymSaveStatusElement = requireElement(debugControls, '#gym-save-status', HTMLElement);
  const sceneReadout = requireElement(debugControls, '#scene-readout', HTMLElement);
  const fpsReadout = requireElement(debugControls, '#fps-readout', HTMLElement);
  const pointerReadout = requireElement(debugControls, '#pointer-readout', HTMLElement);
  const inputReadout = requireElement(debugControls, '#input-readout', HTMLElement);
  const playerReadout = requireElement(debugControls, '#player-readout', HTMLElement);
  const enemyReadout = requireElement(debugControls, '#enemy-readout', HTMLElement);
  const attackReadout = requireElement(debugControls, '#attack-readout', HTMLElement);
  const roundReadout = requireElement(debugControls, '#round-readout', HTMLElement);

  const setControlGroupHidden = (group: HTMLElement, hidden: boolean): void => {
    group.hidden = hidden;
    group
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
        'input, select, button'
      )
      .forEach((control) => {
        control.disabled = hidden;
      });
  };

  const refreshScale = (): void => {
    requestAnimationFrameOnce(() => {
      const activeGame = game;
      const canvas = activeGame?.scale.canvas as HTMLCanvasElement | null | undefined;

      if (activeGame === null || canvas === null || canvas === undefined || !canvas.isConnected) {
        return;
      }

      activeGame.scale.refresh();
    });
  };

  const focusGame = (): void => {
    requestAnimationFrameOnce(() => {
      gameMount.focus({ preventScroll: true });
    });
  };

  const startGameScene = (sceneKey: string): void => {
    for (const knownSceneKey of Object.values(SceneKeys)) {
      if (knownSceneKey !== sceneKey) {
        game?.scene.stop(knownSceneKey);
      }
    }

    game?.scene.start(sceneKey);
    focusGame();
  };

  const getDebugPanelMaxWidth = (): number => {
    const workspaceWidth = workspace.getBoundingClientRect().width;
    const minimumGameWidth =
      profileId === 'portrait' ? DEBUG_PANEL_PORTRAIT_MIN_GAME_WIDTH : DEBUG_PANEL_MIN_GAME_WIDTH;
    const resizeTrackBudget = 28;

    return Math.max(
      DEBUG_PANEL_MIN_WIDTH,
      Math.floor(workspaceWidth - minimumGameWidth - resizeTrackBudget)
    );
  };

  const updateDebugResizeHandleState = (): void => {
    const enabled = !playMode && !window.matchMedia('(max-width: 960px)').matches;

    debugResizeHandle.tabIndex = enabled ? 0 : -1;
    debugResizeHandle.setAttribute('aria-hidden', String(!enabled));
  };

  const applyDebugPanelWidth = (width: number, persist = true): void => {
    const maxWidth = getDebugPanelMaxWidth();

    debugPanelWidth = clampInteger(width, DEBUG_PANEL_MIN_WIDTH, maxWidth);
    root.style.setProperty('--debug-panel-width', `${debugPanelWidth}px`);
    updateDebugResizeHandleState();
    debugResizeHandle.setAttribute('aria-valuemin', String(DEBUG_PANEL_MIN_WIDTH));
    debugResizeHandle.setAttribute('aria-valuemax', String(maxWidth));
    debugResizeHandle.setAttribute('aria-valuenow', String(debugPanelWidth));
    debugResizeHandle.title = `Debug console width: ${debugPanelWidth}px`;

    if (persist) {
      saveDebugPanelWidth(debugPanelWidth);
    }

    refreshScale();
  };

  const startDebugPanelResize = (event: PointerEvent): void => {
    if (window.matchMedia('(max-width: 960px)').matches) {
      return;
    }

    event.preventDefault();
    const pointerId = event.pointerId;
    const startX = event.clientX;
    const startWidth = debugPanelWidth;
    root.classList.add('is-debug-resizing');
    debugResizeHandle.setPointerCapture(pointerId);

    const resize = (resizeEvent: PointerEvent): void => {
      applyDebugPanelWidth(startWidth - (resizeEvent.clientX - startX));
    };

    const stopResize = (): void => {
      root.classList.remove('is-debug-resizing');
      window.removeEventListener('pointermove', resize);
      window.removeEventListener('pointerup', stopResize);
      window.removeEventListener('pointercancel', stopResize);

      if (debugResizeHandle.hasPointerCapture(pointerId)) {
        debugResizeHandle.releasePointerCapture(pointerId);
      }
    };

    window.addEventListener('pointermove', resize);
    window.addEventListener('pointerup', stopResize);
    window.addEventListener('pointercancel', stopResize);
  };

  const renderBackgroundFileOptions = (): void => {
    backgroundFileSelect.replaceChildren(
      ...BACKGROUND_FILE_NAMES.map((fileName) => {
        const option = document.createElement('option');
        option.value = fileName;
        option.textContent = formatBackgroundLabel(fileName);
        return option;
      })
    );
  };

  const getLaneControlMaxY = (): number =>
    Math.max(THREE_LANE_MIN_Y, getCurrentProfileHeight() - THREE_LANE_BOTTOM_INSET);

  const setLaneControlBounds = (): void => {
    const min = String(THREE_LANE_MIN_Y);
    const max = String(getLaneControlMaxY());

    [
      laneUpperYInput,
      laneMiddleYInput,
      laneLowerYInput,
      laneUpperYNumberInput,
      laneMiddleYNumberInput,
      laneLowerYNumberInput
    ].forEach((input) => {
      input.min = min;
      input.max = max;
    });
  };

  const patchLaneSettings = (patch: Partial<SandboxLaneSettings>): void => {
    const current = normalizeSandboxLaneSettings(
      debugStore.get().sandboxLaneSettings,
      getCurrentProfileHeight()
    );

    setSandboxLaneSettingsForCurrentProfile({
      ...current,
      ...patch
    });
  };

  const readGameplayTuningInputs = (): GameplayTuning =>
    normalizeGameplayTuning({
      playerSpeed: Number(tuningPlayerSpeedInput.value),
      enemySpeed: Number(tuningEnemySpeedInput.value),
      enemyRecoveryMs: Number(tuningRecoveryInput.value),
      playerKnockbackSpeed: Number(tuningKnockbackInput.value),
      roundEnemyBaseCount: Number(tuningRoundBaseInput.value),
      roundEnemyIncrease: Number(tuningRoundStepInput.value),
      roundEnemyMaxCount: Number(tuningRoundMaxInput.value),
      roundEnemyGrowthMode: tuningRoundGrowthSelect.value as RoundEnemyGrowthMode,
      roundIntermissionMs: Number(tuningRoundWaitInput.value)
    });

  const setGameplayTuningFromInputs = (): void => {
    debugStore.setGameplayTuning(readGameplayTuningInputs());
    gameplayTuningSaveStatus = 'Unsaved tuning changes';
  };

  const triggerElementCommand = (
    command: 'add' | 'delete' | 'duplicate' | 'nudge',
    nudgeX = 0,
    nudgeY = 0
  ): void => {
    const current = normalizeElementEditorSettings(debugStore.get().elementEditor);
    debugStore.setElementEditor({
      ...current,
      command,
      commandSerial: current.commandSerial + 1,
      nudgeX,
      nudgeY
    });
  };

  const renderLevelProgressControls = (): void => {
    const progress = normalizeLevelProgress(debugStore.get().levelProgress);
    const signature = JSON.stringify(progress);

    if (signature === levelProgressControlsSignature) {
      return;
    }

    levelProgressControlsSignature = signature;

    levelProgressList.replaceChildren(
      ...DEBUG_LEVELS.map((level) => {
        const row = document.createElement('label');
        const input = document.createElement('input');
        const completed = progress.completedLevelIds.includes(level.id);

        row.className = 'toggle-row';
        input.type = 'checkbox';
        input.checked = progress.unlockedLevelIds.includes(level.id);
        input.disabled = level.id === DEBUG_LEVELS[0].id;
        input.addEventListener('change', () => {
          const next = setLevelUnlocked(level.id, input.checked);
          debugStore.setLevelProgress(next);
        });
        row.append(input, `${level.label}${completed ? ' complete' : ''}`);

        return row;
      })
    );
  };

  const renderGameplayTuningControls = (): void => {
    const tuning = normalizeGameplayTuning(debugStore.get().gameplayTuning);

    tuningPlayerSpeedInput.value = String(tuning.playerSpeed);
    tuningEnemySpeedInput.value = String(tuning.enemySpeed);
    tuningRecoveryInput.value = String(tuning.enemyRecoveryMs);
    tuningKnockbackInput.value = String(tuning.playerKnockbackSpeed);
    tuningRoundBaseInput.value = String(tuning.roundEnemyBaseCount);
    tuningRoundStepInput.value = String(tuning.roundEnemyIncrease);
    tuningRoundMaxInput.value = String(tuning.roundEnemyMaxCount);
    tuningRoundWaitInput.value = String(tuning.roundIntermissionMs);
    tuningRoundGrowthSelect.value = tuning.roundEnemyGrowthMode;
    tuningPlayerSpeedReadout.textContent = String(tuning.playerSpeed);
    tuningEnemySpeedReadout.textContent = String(tuning.enemySpeed);
    tuningRecoveryReadout.textContent = String(tuning.enemyRecoveryMs);
    tuningKnockbackReadout.textContent = String(tuning.playerKnockbackSpeed);
    tuningRoundBaseReadout.textContent = String(tuning.roundEnemyBaseCount);
    tuningRoundStepReadout.textContent = String(tuning.roundEnemyIncrease);
    tuningRoundMaxReadout.textContent = String(tuning.roundEnemyMaxCount);
    tuningRoundWaitReadout.textContent = String(tuning.roundIntermissionMs);
    tuningSaveStatus.textContent = gameplayTuningSaveStatus;
  };

  const renderLaneEditorControls = (): void => {
    const settings = normalizeSandboxLaneSettings(
      debugStore.get().sandboxLaneSettings,
      getCurrentProfileHeight()
    );
    const activeElement = document.activeElement;

    setLaneControlBounds();
    showLaneGuidesToggle.checked = debugStore.get().showLaneGuides;
    laneUpperYInput.value = String(settings.upperY);
    laneMiddleYInput.value = String(settings.middleY);
    laneLowerYInput.value = String(settings.lowerY);
    if (activeElement !== laneUpperYNumberInput) {
      laneUpperYNumberInput.value = String(settings.upperY);
    }
    if (activeElement !== laneMiddleYNumberInput) {
      laneMiddleYNumberInput.value = String(settings.middleY);
    }
    if (activeElement !== laneLowerYNumberInput) {
      laneLowerYNumberInput.value = String(settings.lowerY);
    }
    laneUpperYReadout.textContent = String(settings.upperY);
    laneMiddleYReadout.textContent = String(settings.middleY);
    laneLowerYReadout.textContent = String(settings.lowerY);
    laneSaveStatus.textContent = laneEditorSaveStatus;
  };

  const renderBackgroundLabControls = (): void => {
    const state = normalizeBackgroundLabSettings(debugStore.get().backgroundLab);

    backgroundFitModeSelect.value = state.fitMode;
    backgroundShowGridToggle.checked = state.showGrid;
    backgroundShowSafeToggle.checked = state.showSafeFrame;
    backgroundShowBaselineToggle.checked = state.showBaseline;
    backgroundScrollSpeedInput.value = String(state.scrollSpeed);
    backgroundScrollReadout.textContent = String(state.scrollSpeed);
  };

  const renderRunnerControls = (): void => {
    const state = normalizeRunnerSettings(debugStore.get().runnerGeneration);

    runnerSeedInput.value = String(state.seed);
    runnerDifficultyInput.value = String(state.difficulty);
    runnerGapsInput.value = String(state.gapDensity);
    runnerLanesInput.value = String(state.laneCount);
    runnerSpeedInput.value = String(state.scrollSpeed);
    runnerShowPlanToggle.checked = state.showPlanView;
    runnerShowHitboxesToggle.checked = state.showHitboxes;
    runnerSeedReadout.textContent = String(state.seed);
    runnerDifficultyReadout.textContent = state.difficulty.toFixed(2);
    runnerGapsReadout.textContent = state.gapDensity.toFixed(2);
    runnerLanesReadout.textContent = String(state.laneCount);
    runnerSpeedReadout.textContent = String(state.scrollSpeed);
  };

  const renderBaselineControls = (): void => {
    const state = normalizeBaselineLabSettings(debugStore.get().baselineLab);

    baselineLevelSelect.value = state.selectedLevelId;
    baselineShowHitboxesToggle.checked = state.showHitboxes;
    baselineShowSpawnGoalToggle.checked = state.showSpawnGoal;
    baselineShowCameraBandsToggle.checked = state.showCameraBands;
  };

  const renderElementEditorControls = (): void => {
    const state = normalizeElementEditorSettings(debugStore.get().elementEditor);
    const level = getDebugLevel(state.selectedLevelId);
    const elements = getDebugLevelElements(debugElementsConfig, state.selectedLevelId);
    const selected = elements.find((element) => element.id === state.selectedElementId);

    elementLevelSelect.value = state.selectedLevelId;
    elementKindSelect.value = state.selectedKind;
    elementShowGridToggle.checked = state.showGrid;
    elementShowLabelsToggle.checked = state.showLabels;
    elementShowCollisionToggle.checked = state.showCollision;
    elementDeleteButton.disabled = Boolean(elementEditorControls.hidden) || selected === undefined;
    elementDuplicateButton.disabled = Boolean(elementEditorControls.hidden) || selected === undefined;
    elementEditorReadout.textContent =
      selected === undefined
        ? `${level.label} | ${elements.length} elements | ${elementEditorSaveStatus}`
        : `${level.label} | ${selected.id} ${selected.width}x${selected.height} | ${elementEditorSaveStatus}`;
  };

  const scheduleGymControlsRender = (): void => {
    if (gymControlsRenderFrame !== null) {
      return;
    }

    gymControlsRenderFrame = window.requestAnimationFrame(() => {
      gymControlsRenderFrame = null;
      renderGymControls();
    });
  };

  const updateGymBoundsFromScene = (
    actorId: NinjaActorId,
    direction: FacingDirection,
    actionId: string,
    boundsKind: NinjaBoundsKind,
    rect: NinjaRect
  ): void => {
    const currentBounds = getNinjaAnimationBounds(
      ninjaBoundsConfig,
      actorId,
      direction,
      actionId
    )[boundsKind];

    if (!areNinjaRectsEqual(currentBounds, rect)) {
      ninjaBoundsConfig = setNinjaAnimationBounds(
        ninjaBoundsConfig,
        actorId,
        direction,
        actionId,
        boundsKind,
        rect
      );
      gymSaveStatus = `Updated ${actorId} ${direction} ${actionId} ${boundsKind}`;
    }

    gymSelectedActorId = actorId;
    gymSelectedDirection = direction;
    gymSelectedActionId = actionId;
    gymSelectedBoundsKind = boundsKind;
    syncNinjaGymGlobal();
    scheduleGymControlsRender();
  };

  const updateGymLaneAnchorFromScene = (
    actorId: NinjaActorId,
    direction: FacingDirection,
    actionId: string,
    anchor: NinjaLaneAnchor
  ): void => {
    const currentAnchor = getNinjaLaneAnchor(
      ninjaBoundsConfig,
      actorId,
      direction,
      actionId
    );
    const nextAnchor = clampLaneAnchorToFrame(anchor);

    if (!areNinjaLaneAnchorsEqual(currentAnchor, nextAnchor)) {
      ninjaBoundsConfig = setNinjaLaneAnchor(
        ninjaBoundsConfig,
        actorId,
        direction,
        actionId,
        nextAnchor
      );
      gymSaveStatus = `Updated ${actorId} ${direction} ${actionId} lane anchor`;
    }

    gymSelectedActorId = actorId;
    gymSelectedDirection = direction;
    gymSelectedActionId = actionId;
    syncNinjaGymGlobal();
    scheduleGymControlsRender();
  };

  const syncNinjaGymGlobal = (): void => {
    const current = globalThis.__NINJA_SLASH_GYM__;
    const actorId = normalizeNinjaActorId(gymSelectedActorId);
    const direction = normalizeFacingDirection(gymSelectedDirection);
    const actionId = normalizeNinjaActionId(actorId, gymSelectedActionId);
    const playbackRate = getNinjaAnimationPlaybackRate(
      ninjaBoundsConfig,
      actorId,
      actionId
    );

    globalThis.__NINJA_SLASH_GYM__ = {
      active: debugStore.get().activeScene === SceneKeys.Gym,
      selectedActorId: actorId,
      selectedDirection: direction,
      selectedActionId: actionId,
      selectedBoundsKind: normalizeNinjaBoundsKind(gymSelectedBoundsKind),
      showVisualBounds: gymShowVisualBounds,
      showCollisionBounds: gymShowCollisionBounds,
      showAttackBounds: gymShowAttackBounds,
      playbackRate,
      boundsConfig: ninjaBoundsConfig,
      currentFrame: current?.currentFrame ?? 0,
      zoom: current?.zoom ?? 1.35,
      updateBounds: updateGymBoundsFromScene,
      updateLaneAnchor: updateGymLaneAnchorFromScene
    };
  };

  const getGymSelection = (): {
    actorId: NinjaActorId;
    direction: FacingDirection;
    actionId: string;
    boundsKind: NinjaBoundsKind;
  } => {
    const actorId = normalizeNinjaActorId(gymActorSelect.value || gymSelectedActorId);
    const direction = normalizeFacingDirection(gymDirectionSelect.value || gymSelectedDirection);

    return {
      actorId,
      direction,
      actionId: normalizeNinjaActionId(actorId, gymActionSelect.value || gymSelectedActionId),
      boundsKind: normalizeNinjaBoundsKind(
        gymBoundsKindSelect.value || gymSelectedBoundsKind
      )
    };
  };

  const patchGymState = (): void => {
    const selection = getGymSelection();
    gymSelectedActorId = selection.actorId;
    gymSelectedDirection = selection.direction;
    gymSelectedActionId = selection.actionId;
    gymSelectedBoundsKind = selection.boundsKind;
    gymShowVisualBounds = gymShowVisualToggle.checked;
    gymShowCollisionBounds = gymShowCollisionToggle.checked;
    gymShowAttackBounds = gymShowAttackToggle.checked;
    gymPlaybackRate = getNinjaAnimationPlaybackRate(
      ninjaBoundsConfig,
      selection.actorId,
      selection.actionId
    );
    syncNinjaGymGlobal();
    renderGymControls();
  };

  const updateSelectedGymPlaybackRate = (): void => {
    const selection = getGymSelection();
    const playbackRate = normalizeNinjaPlaybackRate(Number(gymPlaybackRateInput.value));

    ninjaBoundsConfig = setNinjaAnimationPlaybackRate(
      ninjaBoundsConfig,
      selection.actorId,
      selection.actionId,
      playbackRate
    );
    gymPlaybackRate = getNinjaAnimationPlaybackRate(
      ninjaBoundsConfig,
      selection.actorId,
      selection.actionId
    );
    gymSaveStatus = `Updated ${selection.actorId} ${selection.actionId} playback to ${gymPlaybackRate.toFixed(
      2
    )}x`;
    syncNinjaGymGlobal();
    renderGymControls();
  };

  const readGymBoundsInputs = (): NinjaRect =>
    clampRectToFrame({
      x: Number(gymBoundsXInput.value),
      y: Number(gymBoundsYInput.value),
      width: Number(gymBoundsWidthInput.value),
      height: Number(gymBoundsHeightInput.value)
    });

  const readGymLaneAnchorInputs = (): NinjaLaneAnchor =>
    clampLaneAnchorToFrame({
      x: Number(gymLaneAnchorXInput.value),
      y: Number(gymLaneAnchorYInput.value)
    });

  const updateSelectedGymBounds = (): void => {
    const selection = getGymSelection();
    ninjaBoundsConfig = setNinjaAnimationBounds(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      selection.boundsKind,
      readGymBoundsInputs()
    );
    gymSaveStatus = `Updated ${selection.actorId} ${selection.direction} ${selection.actionId} ${selection.boundsKind}`;
    patchGymState();
  };

  const updateSelectedGymLaneAnchor = (): void => {
    const selection = getGymSelection();
    ninjaBoundsConfig = setNinjaLaneAnchor(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      readGymLaneAnchorInputs()
    );
    gymSaveStatus = `Updated ${selection.actorId} ${selection.direction} ${selection.actionId} lane anchor`;
    patchGymState();
  };

  const getGymActiveHitFrames = (
    config: NinjaBoundsConfig,
    actorId: NinjaActorId,
    direction: FacingDirection,
    actionId: string
  ): readonly number[] => {
    const frameCount = getNinjaAction(actorId, actionId).frameCount;

    return Array.from({ length: frameCount }, (_, frameIndex) => frameIndex).filter(
      (frameIndex) => isNinjaHitFrameActive(config, actorId, direction, actionId, frameIndex)
    );
  };

  const setGymAttackFrames = (
    actorId: NinjaActorId,
    direction: FacingDirection,
    actionId: string,
    isActive: (frameIndex: number) => boolean
  ): void => {
    const frameCount = getNinjaAction(actorId, actionId).frameCount;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      ninjaBoundsConfig = setNinjaHitFrame(
        ninjaBoundsConfig,
        actorId,
        direction,
        actionId,
        frameIndex,
        isActive(frameIndex)
      );
    }
  };

  const renderGymAttackFrameStrip = (
    actorId: NinjaActorId,
    direction: FacingDirection,
    actionId: string,
    frameCount: number,
    currentFrame: number
  ): void => {
    const signature = `${actorId}:${direction}:${actionId}:${frameCount}`;

    if (signature !== gymFrameStripSignature) {
      gymFrameStripSignature = signature;
      gymAttackFrameStrip.innerHTML = formatFrameStripButtons(
        frameCount,
        (frameIndex) =>
          isNinjaHitFrameActive(
            ninjaBoundsConfig,
            actorId,
            direction,
            actionId,
            frameIndex
          ),
        currentFrame
      );
    }

    gymAttackFrameStrip
      .querySelectorAll<HTMLButtonElement>('button[data-frame-index]')
      .forEach((button) => {
        const frameIndex = Number(button.dataset.frameIndex);
        const active = isNinjaHitFrameActive(
          ninjaBoundsConfig,
          actorId,
          direction,
          actionId,
          frameIndex
        );
        const frameNumber = frameIndex + 1;
        const number = button.querySelector<HTMLElement>('.frame-toggle__number');
        const state = button.querySelector<HTMLElement>('.frame-toggle__state');

        button.classList.toggle('is-active', active);
        button.classList.toggle('is-current', frameIndex === currentFrame);
        button.setAttribute('aria-pressed', String(active));
        button.setAttribute(
          'aria-label',
          `Toggle attack frame ${frameNumber}, currently ${active ? 'active' : 'inactive'}`
        );
        button.title = `Attack frame ${frameNumber}: ${active ? 'active' : 'inactive'}`;

        if (number !== null) {
          number.textContent = `F${String(frameNumber).padStart(2, '0')}`;
        }
        if (state !== null) {
          state.textContent = active ? 'ON' : 'off';
        }
      });
  };

  const renderGymControls = (): void => {
    const active = debugStore.get().activeScene === SceneKeys.Gym;
    const actorId = normalizeNinjaActorId(gymSelectedActorId);
    const direction = normalizeFacingDirection(gymSelectedDirection);
    const actionId = normalizeNinjaActionId(actorId, gymSelectedActionId);
    const boundsKind = normalizeNinjaBoundsKind(gymSelectedBoundsKind);
    const actionDefinition = getNinjaAction(actorId, actionId);
    const playbackRate = getNinjaAnimationPlaybackRate(
      ninjaBoundsConfig,
      actorId,
      actionId
    );
    const actionOptionsSignature = `${actorId}:${getNinjaAnimationsForActor(actorId)
      .map((actionDefinitionItem) => actionDefinitionItem.id)
      .join('|')}`;
    const currentOptionsSignature = gymActionSelect.dataset.optionsSignature;
    const currentFrame = clampInteger(
      globalThis.__NINJA_SLASH_GYM__?.currentFrame ?? 0,
      0,
      actionDefinition.frameCount - 1
    );
    const activeBounds = getNinjaAnimationBounds(
      ninjaBoundsConfig,
      actorId,
      direction,
      actionId
    )[boundsKind];
    const activeLaneAnchor = getNinjaLaneAnchor(
      ninjaBoundsConfig,
      actorId,
      direction,
      actionId
    );
    const activeHitFrames = getGymActiveHitFrames(
      ninjaBoundsConfig,
      actorId,
      direction,
      actionId
    );
    const currentFrameActive = activeHitFrames.includes(currentFrame);

    gymControls.hidden = !active;
    gymActorSelect.value = actorId;
    gymDirectionSelect.value = direction;

    if (currentOptionsSignature !== actionOptionsSignature) {
      gymActionSelect.dataset.optionsSignature = actionOptionsSignature;
      gymActionSelect.replaceChildren(
        ...getNinjaAnimationsForActor(actorId).map((action) => {
          const option = document.createElement('option');
          option.value = action.id;
          option.textContent = action.label;
          return option;
        })
      );
    }

    gymActionSelect.value = actionId;
    gymBoundsKindSelect.value = boundsKind;
    gymShowVisualToggle.checked = gymShowVisualBounds;
    gymShowCollisionToggle.checked = gymShowCollisionBounds;
    gymShowAttackToggle.checked = gymShowAttackBounds;
    gymPlaybackRate = playbackRate;
    gymPlaybackRateInput.value = String(playbackRate);
    gymPlaybackReadout.textContent = `${playbackRate.toFixed(2)}x`;
    gymFrameReadout.textContent = `${currentFrame + 1}/${actionDefinition.frameCount}`;
    gymAttackFrameReadout.textContent = `Active: ${formatFrameList(activeHitFrames)}`;
    gymLaneAnchorReadout.textContent = `X${activeLaneAnchor.x} Y${activeLaneAnchor.y}`;
    gymToggleCurrentHitFrameButton.textContent = currentFrameActive
      ? 'Disable current'
      : 'Enable current';
    gymToggleCurrentHitFrameButton.title = `Frame ${currentFrame + 1}`;
    gymMirrorDirectionButton.textContent = `Mirror to ${getOppositeFacingDirection(direction)}`;
    gymMirrorDirectionButton.title = `Copy selected ${boundsKind} bounds to ${getOppositeFacingDirection(
      direction
    )} with horizontal flip`;
    renderGymAttackFrameStrip(
      actorId,
      direction,
      actionId,
      actionDefinition.frameCount,
      currentFrame
    );

    if (document.activeElement !== gymBoundsXInput) {
      gymBoundsXInput.value = String(activeBounds.x);
    }
    if (document.activeElement !== gymBoundsYInput) {
      gymBoundsYInput.value = String(activeBounds.y);
    }
    if (document.activeElement !== gymBoundsWidthInput) {
      gymBoundsWidthInput.value = String(activeBounds.width);
    }
    if (document.activeElement !== gymBoundsHeightInput) {
      gymBoundsHeightInput.value = String(activeBounds.height);
    }
    if (document.activeElement !== gymLaneAnchorXInput) {
      gymLaneAnchorXInput.value = String(activeLaneAnchor.x);
    }
    if (document.activeElement !== gymLaneAnchorYInput) {
      gymLaneAnchorYInput.value = String(activeLaneAnchor.y);
    }

    gymControls
      .querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLButtonElement>(
        'input, select, button'
      )
      .forEach((control) => {
        control.disabled = !active;
      });

    gymSaveStatusElement.textContent = gymSaveStatus;
    syncNinjaGymGlobal();
  };

  const mountGame = (): void => {
    game?.destroy(true);
    gameMount.replaceChildren();
    root.dataset.profile = profileId;
    profileToggle.textContent = formatProfileLabel(profileId);
    profileToggle.title = `${GAME_PROFILES[profileId].label}`;
    applySandboxLaneSettingsForCurrentProfile();
    if (!sandboxLaneSettingsDirty) {
      laneEditorSaveStatus = sandboxLaneSettingsLoadedFromFile
        ? 'Loaded public/assets/config/sandbox-lanes.json'
        : 'Loaded defaults';
    }
    debugStore.resetRuntime();
    game = createGame({ parent: gameMount, context });
    refreshScale();
    focusGame();
  };

  const showPlayToast = (): void => {
    playToast.classList.add('is-visible');

    if (playToastTimeout !== null) {
      window.clearTimeout(playToastTimeout);
    }

    playToastTimeout = window.setTimeout(() => {
      playToast.classList.remove('is-visible');
      playToastTimeout = null;
    }, 2200);
  };

  const setPlayMode = (nextPlayMode: boolean): void => {
    playMode = nextPlayMode;
    root.classList.toggle('is-play-mode', playMode);
    playButton.setAttribute('aria-pressed', String(playMode));
    playButton.textContent = playMode ? 'Playing' : 'Play';
    playToast.classList.toggle('is-visible', playMode);

    if (!playMode && playToastTimeout !== null) {
      window.clearTimeout(playToastTimeout);
      playToastTimeout = null;
    }

    updateDebugResizeHandleState();
    refreshScale();
    focusGame();
  };

  const exitPlayMode = async (): Promise<void> => {
    setPlayMode(false);

    if (document.fullscreenElement !== null) {
      await document.exitFullscreen();
    }
  };

  const enterPlayMode = async (): Promise<void> => {
    if (debugStore.get().activeScene !== SceneKeys.Sandbox) {
      startGameScene(SceneKeys.Sandbox);
    }

    setPlayMode(true);
    showPlayToast();

    if (document.fullscreenElement === null) {
      try {
        await root.requestFullscreen();
      } catch {
        refreshScale();
      }
    }
  };

  const renderDebug = (): void => {
    const state = debugStore.get();
    const pressedInputs = [
      state.input.up ? 'up' : '',
      state.input.down ? 'down' : '',
      state.input.left ? 'left' : '',
      state.input.right ? 'right' : ''
    ].filter(Boolean);
    const roundTime =
      state.round.status === 'cleared'
        ? `next ${Math.ceil(state.round.nextRoundInMs / 1000)}`
        : formatElapsedMs(state.round.elapsedMs);

    sceneBadge.textContent = state.activeScene;
    sceneReadout.textContent = state.activeScene;
    pauseToggle.textContent = state.paused ? 'Resume' : 'Pause';
    resetActorsButton.disabled = state.activeScene !== SceneKeys.Sandbox;
    resetActorsButton.title =
      state.activeScene === SceneKeys.Sandbox ? 'Reset player and enemy positions' : 'Available in Sandbox';
    showWorldToggle.checked = state.showWorldBounds;
    showVisualBoundsToggle.checked = state.showVisualBounds;
    showHitBoxesToggle.checked = state.showHitBoxes;
    showAttackBoxesToggle.checked = state.showAttackBoxes;
    showOriginsToggle.checked = state.showOrigins;
    showPointerProbeToggle.checked = state.showPointerProbe;
    showEnemyRangesToggle.checked = state.showEnemyRanges;
    showLaneGuidesToggle.checked = state.showLaneGuides;
    enemyAiToggle.checked = state.enemyAiEnabled;
    backgroundFileSelect.value = state.backgroundFileName;
    bgmTrackSelect.value = state.bgmTrackId;
    setControlGroupHidden(laneEditorControls, state.activeScene !== SceneKeys.LaneEditor);
    setControlGroupHidden(backgroundLabControls, state.activeScene !== SceneKeys.BackgroundLab);
    setControlGroupHidden(runnerControls, state.activeScene !== SceneKeys.RunnerLab);
    setControlGroupHidden(
      baselineControls,
      state.activeScene !== SceneKeys.BaselineLevel && state.activeScene !== SceneKeys.LevelProgress
    );
    setControlGroupHidden(elementEditorControls, state.activeScene !== SceneKeys.ElementEditor);
    renderLaneEditorControls();
    renderGameplayTuningControls();
    renderLevelProgressControls();
    renderBackgroundLabControls();
    renderRunnerControls();
    renderBaselineControls();
    renderElementEditorControls();
    fpsReadout.textContent = `${state.performance.fps.toFixed(1)} / ${state.performance.physicsBodies} bodies`;
    pointerReadout.textContent = `${state.pointer.x}, ${state.pointer.y} / ${state.pointer.worldX}, ${state.pointer.worldY} ${
      state.pointer.down ? 'down' : 'up'
    }`;
    inputReadout.textContent =
      pressedInputs.length > 0 ? `${pressedInputs.join(' + ')} ${state.input.lastKey}`.trim() : state.input.lastKey || 'idle';
    playerReadout.textContent = `${state.player.action} @ ${formatVector(
      state.player.x,
      state.player.y
    )} v ${formatVector(state.player.velocityX, state.player.velocityY)} f${state.player.frame}`;
    enemyReadout.textContent = `${state.enemy.action} @ ${formatVector(
      state.enemy.x,
      state.enemy.y
    )} v ${formatVector(state.enemy.velocityX, state.enemy.velocityY)} f${state.enemy.frame}`;
    attackReadout.textContent = state.attack.active
      ? `${state.attack.action} ${formatNumber(state.attack.width)}x${formatNumber(
          state.attack.height
        )} @ ${formatVector(
          state.attack.x,
          state.attack.y
        )} hits ${state.attack.hitCount}`
      : 'inactive';
    roundReadout.textContent =
      `ラウンド${state.round.round} ${state.round.defeated}/${state.round.enemies} 倒した敵 ${state.round.totalDefeated} ${roundTime}`;
    renderGymControls();
  };

  renderBackgroundFileOptions();
  debugStore.setLevelProgress(loadLevelProgress());
  void loadNinjaBoundsConfig().then((loadedConfig) => {
    if (loadedConfig === null) {
      return;
    }

    ninjaBoundsConfig = loadedConfig;
    gymSaveStatus = 'Loaded public/assets/config/ninja-bounds.json';
    syncNinjaGymGlobal();
    renderGymControls();
  });
  void loadGameplayTuningConfig().then((loadedConfig) => {
    if (loadedConfig === null) {
      return;
    }

    gameplayTuningSaveStatus = 'Loaded public/assets/config/gameplay-tuning.json';
    debugStore.setGameplayTuning(loadedConfig);
  });
  void loadSandboxLaneSettingsConfig().then((loadedConfig) => {
    if (loadedConfig === null) {
      return;
    }

    sandboxLaneSettingsLoadedFromFile = true;
    if (sandboxLaneSettingsDirty) {
      sandboxLaneSettingsConfig = setSandboxLaneSettingsForProfile(
        loadedConfig,
        profileId,
        debugStore.get().sandboxLaneSettings,
        getCurrentProfileHeight()
      );
      return;
    }

    sandboxLaneSettingsConfig = loadedConfig;
    laneEditorSaveStatus = 'Loaded public/assets/config/sandbox-lanes.json';
    applySandboxLaneSettingsForCurrentProfile();
    renderLaneEditorControls();
  });
  void loadDebugElementsConfig().then((loadedConfig) => {
    if (loadedConfig === null) {
      return;
    }

    debugElementsConfig = loadedConfig;
    elementEditorSaveStatus = 'Loaded public/assets/config/debug-elements.json';
    renderElementEditorControls();
  });

  const subscriptions: Unsubscribe[] = [
    debugStore.subscribe(renderDebug, { immediate: true })
  ];

  playButton.addEventListener('click', () => {
    if (playMode) {
      void exitPlayMode();
      return;
    }

    void enterPlayMode();
  });

  gameMount.addEventListener('pointerdown', () => {
    focusGame();
  });

  debugResizeHandle.addEventListener('pointerdown', startDebugPanelResize);
  debugResizeHandle.addEventListener('dblclick', () => {
    applyDebugPanelWidth(DEBUG_PANEL_DEFAULT_WIDTH);
  });
  debugResizeHandle.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      applyDebugPanelWidth(debugPanelWidth + DEBUG_PANEL_RESIZE_STEP);
      return;
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault();
      applyDebugPanelWidth(debugPanelWidth - DEBUG_PANEL_RESIZE_STEP);
      return;
    }

    if (event.key === 'Home') {
      event.preventDefault();
      applyDebugPanelWidth(DEBUG_PANEL_MIN_WIDTH);
      return;
    }

    if (event.key === 'End') {
      event.preventDefault();
      applyDebugPanelWidth(getDebugPanelMaxWidth());
    }
  });

  profileToggle.addEventListener('click', () => {
    if (playMode) {
      void exitPlayMode();
    }

    profileId = profileId === 'landscape' ? 'portrait' : 'landscape';
    mountGame();
  });

  pauseToggle.addEventListener('click', () => {
    debugStore.togglePaused();
  });

  resetActorsButton.addEventListener('click', () => {
    if (debugStore.get().activeScene !== SceneKeys.Sandbox) {
      return;
    }

    debugStore.requestActorReset();
  });

  showWorldToggle.addEventListener('change', () => {
    debugStore.setShowWorldBounds(showWorldToggle.checked);
  });

  showVisualBoundsToggle.addEventListener('change', () => {
    debugStore.setShowVisualBounds(showVisualBoundsToggle.checked);
  });

  showHitBoxesToggle.addEventListener('change', () => {
    debugStore.setShowHitBoxes(showHitBoxesToggle.checked);
  });

  showAttackBoxesToggle.addEventListener('change', () => {
    debugStore.setShowAttackBoxes(showAttackBoxesToggle.checked);
  });

  showOriginsToggle.addEventListener('change', () => {
    debugStore.setShowOrigins(showOriginsToggle.checked);
  });

  showPointerProbeToggle.addEventListener('change', () => {
    debugStore.setShowPointerProbe(showPointerProbeToggle.checked);
  });

  showEnemyRangesToggle.addEventListener('change', () => {
    debugStore.setShowEnemyRanges(showEnemyRangesToggle.checked);
  });

  showLaneGuidesToggle.addEventListener('change', () => {
    debugStore.setShowLaneGuides(showLaneGuidesToggle.checked);
  });

  enemyAiToggle.addEventListener('change', () => {
    debugStore.setEnemyAiEnabled(enemyAiToggle.checked);
  });

  backgroundFileSelect.addEventListener('change', () => {
    if (isDebugBackgroundFileName(backgroundFileSelect.value)) {
      debugStore.setBackgroundFileName(backgroundFileSelect.value);
    }
  });

  bgmTrackSelect.addEventListener('change', () => {
    if (isBgmTrackId(bgmTrackSelect.value)) {
      debugStore.setBgmTrackId(bgmTrackSelect.value);
    }
  });

  debugControls.addEventListener('click', (event) => {
    const sceneButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button[data-debug-scene]'
    );

    if (sceneButton === null) {
      return;
    }

    const sceneKey = sceneButton.dataset.debugScene;

    if (sceneKey !== undefined) {
      startGameScene(sceneKey);
    }
  });

  laneUpperYInput.addEventListener('input', () => {
    patchLaneSettings({ upperY: Number(laneUpperYInput.value) });
  });
  laneMiddleYInput.addEventListener('input', () => {
    patchLaneSettings({ middleY: Number(laneMiddleYInput.value) });
  });
  laneLowerYInput.addEventListener('input', () => {
    patchLaneSettings({ lowerY: Number(laneLowerYInput.value) });
  });
  laneUpperYNumberInput.addEventListener('change', () => {
    patchLaneSettings({ upperY: Number(laneUpperYNumberInput.value) });
  });
  laneMiddleYNumberInput.addEventListener('change', () => {
    patchLaneSettings({ middleY: Number(laneMiddleYNumberInput.value) });
  });
  laneLowerYNumberInput.addEventListener('change', () => {
    patchLaneSettings({ lowerY: Number(laneLowerYNumberInput.value) });
  });
  laneSaveButton.addEventListener('click', async () => {
    laneEditorSaveStatus = 'Saving lane config...';
    renderLaneEditorControls();

    sandboxLaneSettingsConfig = setSandboxLaneSettingsForProfile(
      sandboxLaneSettingsConfig,
      profileId,
      debugStore.get().sandboxLaneSettings,
      getCurrentProfileHeight()
    );

    const payload = buildSandboxLaneSettingsExport(sandboxLaneSettingsConfig);

    try {
      const response = await fetch(SANDBOX_LANE_SETTINGS_SAVE_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}`);
      }

      sandboxLaneSettingsConfig = payload;
      sandboxLaneSettingsLoadedFromFile = true;
      sandboxLaneSettingsDirty = false;
      laneEditorSaveStatus = 'Saved public/assets/config/sandbox-lanes.json';
    } catch {
      downloadJsonFile('sandbox-lanes.json', payload);
      laneEditorSaveStatus = 'Downloaded sandbox-lanes.json';
    }

    renderLaneEditorControls();
  });
  laneResetButton.addEventListener('click', () => {
    const worldHeight = getCurrentProfileHeight();

    setSandboxLaneSettingsForCurrentProfile(
      createDefaultSandboxLaneSettings(worldHeight),
      'Unsaved lane reset'
    );
  });

  tuningPlayerSpeedInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningEnemySpeedInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningRecoveryInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningKnockbackInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningRoundBaseInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningRoundStepInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningRoundMaxInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningRoundWaitInput.addEventListener('input', setGameplayTuningFromInputs);
  tuningRoundGrowthSelect.addEventListener('change', setGameplayTuningFromInputs);
  tuningSaveButton.addEventListener('click', async () => {
    gameplayTuningSaveStatus = 'Saving tuning...';
    renderGameplayTuningControls();

    const payload = normalizeGameplayTuning(debugStore.get().gameplayTuning);

    try {
      const response = await fetch(GAMEPLAY_TUNING_SAVE_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}`);
      }

      gameplayTuningSaveStatus = 'Saved public/assets/config/gameplay-tuning.json';
    } catch {
      downloadJsonFile('gameplay-tuning.json', payload);
      gameplayTuningSaveStatus = 'Downloaded gameplay-tuning.json';
    }

    renderGameplayTuningControls();
  });
  tuningResetButton.addEventListener('click', () => {
    gameplayTuningSaveStatus = 'Reset to defaults';
    debugStore.setGameplayTuning(DEFAULT_GAMEPLAY_TUNING);
  });

  levelProgressCompleteButton.addEventListener('click', () => {
    const selectedLevelId = normalizeBaselineLabSettings(debugStore.get().baselineLab).selectedLevelId;
    debugStore.setLevelProgress(markLevelCompleted(selectedLevelId));
  });
  levelProgressResetButton.addEventListener('click', () => {
    debugStore.setLevelProgress(resetLevelProgress());
  });

  backgroundFitModeSelect.addEventListener('change', () => {
    const fitMode = backgroundFitModeSelect.value as BackgroundFitMode;
    debugStore.setBackgroundLab({
      ...normalizeBackgroundLabSettings(debugStore.get().backgroundLab),
      fitMode
    });
  });
  backgroundShowGridToggle.addEventListener('change', () => {
    debugStore.setBackgroundLab({
      ...normalizeBackgroundLabSettings(debugStore.get().backgroundLab),
      showGrid: backgroundShowGridToggle.checked
    });
  });
  backgroundShowSafeToggle.addEventListener('change', () => {
    debugStore.setBackgroundLab({
      ...normalizeBackgroundLabSettings(debugStore.get().backgroundLab),
      showSafeFrame: backgroundShowSafeToggle.checked
    });
  });
  backgroundShowBaselineToggle.addEventListener('change', () => {
    debugStore.setBackgroundLab({
      ...normalizeBackgroundLabSettings(debugStore.get().backgroundLab),
      showBaseline: backgroundShowBaselineToggle.checked
    });
  });
  backgroundScrollSpeedInput.addEventListener('input', () => {
    debugStore.setBackgroundLab({
      ...normalizeBackgroundLabSettings(debugStore.get().backgroundLab),
      scrollSpeed: Number(backgroundScrollSpeedInput.value)
    });
  });

  const patchRunnerSettings = (): void => {
    debugStore.setRunnerGeneration(
      normalizeRunnerSettings({
        seed: Number(runnerSeedInput.value),
        difficulty: Number(runnerDifficultyInput.value),
        gapDensity: Number(runnerGapsInput.value),
        laneCount: Number(runnerLanesInput.value),
        scrollSpeed: Number(runnerSpeedInput.value),
        showPlanView: runnerShowPlanToggle.checked,
        showHitboxes: runnerShowHitboxesToggle.checked
      })
    );
  };
  runnerSeedInput.addEventListener('input', patchRunnerSettings);
  runnerDifficultyInput.addEventListener('input', patchRunnerSettings);
  runnerGapsInput.addEventListener('input', patchRunnerSettings);
  runnerLanesInput.addEventListener('input', patchRunnerSettings);
  runnerSpeedInput.addEventListener('input', patchRunnerSettings);
  runnerShowPlanToggle.addEventListener('change', patchRunnerSettings);
  runnerShowHitboxesToggle.addEventListener('change', patchRunnerSettings);

  const patchBaselineSettings = (): void => {
    debugStore.setBaselineLab(
      normalizeBaselineLabSettings({
        selectedLevelId: baselineLevelSelect.value,
        showHitboxes: baselineShowHitboxesToggle.checked,
        showSpawnGoal: baselineShowSpawnGoalToggle.checked,
        showCameraBands: baselineShowCameraBandsToggle.checked
      })
    );
  };
  baselineLevelSelect.addEventListener('change', patchBaselineSettings);
  baselineShowHitboxesToggle.addEventListener('change', patchBaselineSettings);
  baselineShowSpawnGoalToggle.addEventListener('change', patchBaselineSettings);
  baselineShowCameraBandsToggle.addEventListener('change', patchBaselineSettings);

  const patchElementEditorSettings = (): void => {
    const current = normalizeElementEditorSettings(debugStore.get().elementEditor);
    const selectedLevelId = elementLevelSelect.value;
    const selectedElementId =
      current.selectedLevelId === selectedLevelId ? current.selectedElementId : null;
    const selectedKind = elementKindSelect.value as DebugElementKind;
    debugStore.setElementEditor({
      ...current,
      selectedLevelId,
      selectedElementId,
      selectedKind,
      showGrid: elementShowGridToggle.checked,
      showLabels: elementShowLabelsToggle.checked,
      showCollision: elementShowCollisionToggle.checked
    });
  };
  elementLevelSelect.addEventListener('change', patchElementEditorSettings);
  elementKindSelect.addEventListener('change', patchElementEditorSettings);
  elementShowGridToggle.addEventListener('change', patchElementEditorSettings);
  elementShowLabelsToggle.addEventListener('change', patchElementEditorSettings);
  elementShowCollisionToggle.addEventListener('change', patchElementEditorSettings);
  elementAddButton.addEventListener('click', () => triggerElementCommand('add'));
  elementDuplicateButton.addEventListener('click', () => triggerElementCommand('duplicate'));
  elementDeleteButton.addEventListener('click', () => triggerElementCommand('delete'));
  debugControls.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button[data-element-nudge]'
    );

    if (button === null || button.dataset.elementNudge === undefined) {
      return;
    }

    const [nudgeX = 0, nudgeY = 0] = button.dataset.elementNudge
      .split(',')
      .map((value) => Number(value));
    triggerElementCommand('nudge', nudgeX, nudgeY);
  });
  elementSaveButton.addEventListener('click', async () => {
    elementEditorSaveStatus = 'Saving elements...';
    renderElementEditorControls();

    const payload = buildDebugElementsExport(debugElementsConfig);

    try {
      const response = await fetch(DEBUG_ELEMENTS_SAVE_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}`);
      }

      debugElementsConfig = payload;
      elementEditorSaveStatus = 'Saved public/assets/config/debug-elements.json';
    } catch {
      downloadJsonFile('debug-elements.json', payload);
      elementEditorSaveStatus = 'Downloaded debug-elements.json';
    }

    renderElementEditorControls();
  });
  elementExportButton.addEventListener('click', () => {
    downloadJsonFile('debug-elements.json', buildDebugElementsExport(debugElementsConfig));
  });

  gymExitButton.addEventListener('click', () => {
    startGameScene(SceneKeys.MainMenu);
  });
  gymActorSelect.addEventListener('change', () => {
    gymSelectedActorId = normalizeNinjaActorId(gymActorSelect.value);
    gymSelectedActionId = getDefaultNinjaActionId(gymSelectedActorId);
    gymActionSelect.value = '';
    patchGymState();
  });

  gymDirectionSelect.addEventListener('change', patchGymState);
  gymActionSelect.addEventListener('change', patchGymState);
  gymBoundsKindSelect.addEventListener('change', patchGymState);
  gymShowVisualToggle.addEventListener('change', patchGymState);
  gymShowCollisionToggle.addEventListener('change', patchGymState);
  gymShowAttackToggle.addEventListener('change', patchGymState);
  gymPlaybackRateInput.addEventListener('input', updateSelectedGymPlaybackRate);
  gymBoundsXInput.addEventListener('input', updateSelectedGymBounds);
  gymBoundsYInput.addEventListener('input', updateSelectedGymBounds);
  gymBoundsWidthInput.addEventListener('input', updateSelectedGymBounds);
  gymBoundsHeightInput.addEventListener('input', updateSelectedGymBounds);
  gymLaneAnchorXInput.addEventListener('input', updateSelectedGymLaneAnchor);
  gymLaneAnchorYInput.addEventListener('input', updateSelectedGymLaneAnchor);
  gymToggleCurrentHitFrameButton.addEventListener('click', () => {
    const selection = getGymSelection();
    const frameIndex = clampInteger(
      globalThis.__NINJA_SLASH_GYM__?.currentFrame ?? 0,
      0,
      getNinjaAction(selection.actorId, selection.actionId).frameCount - 1
    );
    const active = isNinjaHitFrameActive(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      frameIndex
    );

    ninjaBoundsConfig = setNinjaHitFrame(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      frameIndex,
      !active
    );
    gymSaveStatus = `${active ? 'Disabled' : 'Enabled'} frame ${frameIndex + 1} for ${selection.actorId} ${selection.direction} ${selection.actionId}`;
    patchGymState();
  });
  gymOnlyCurrentHitFrameButton.addEventListener('click', () => {
    const selection = getGymSelection();
    const frameIndex = clampInteger(
      globalThis.__NINJA_SLASH_GYM__?.currentFrame ?? 0,
      0,
      getNinjaAction(selection.actorId, selection.actionId).frameCount - 1
    );

    setGymAttackFrames(
      selection.actorId,
      selection.direction,
      selection.actionId,
      (candidateFrameIndex) => candidateFrameIndex === frameIndex
    );
    gymSaveStatus = `Set only frame ${frameIndex + 1} active for ${selection.actorId} ${selection.direction} ${selection.actionId}`;
    patchGymState();
  });
  gymClearHitFramesButton.addEventListener('click', () => {
    const selection = getGymSelection();

    setGymAttackFrames(
      selection.actorId,
      selection.direction,
      selection.actionId,
      () => false
    );
    gymSaveStatus = `Cleared attack frames for ${selection.actorId} ${selection.direction} ${selection.actionId}`;
    patchGymState();
  });
  gymResetHitFramesButton.addEventListener('click', () => {
    const selection = getGymSelection();

    setGymAttackFrames(
      selection.actorId,
      selection.direction,
      selection.actionId,
      (frameIndex) =>
        isNinjaHitFrameActive(
          DEFAULT_NINJA_BOUNDS_CONFIG,
          selection.actorId,
          selection.direction,
          selection.actionId,
          frameIndex
        )
    );
    gymSaveStatus = `Reset attack frames for ${selection.actorId} ${selection.direction} ${selection.actionId}`;
    patchGymState();
  });
  gymAttackFrameStrip.addEventListener('click', (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button[data-frame-index]'
    );

    if (button === null) {
      return;
    }

    const selection = getGymSelection();
    const frameIndex = Number(button.dataset.frameIndex);
    const active = isNinjaHitFrameActive(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      frameIndex
    );

    ninjaBoundsConfig = setNinjaHitFrame(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      frameIndex,
      !active
    );
    gymSaveStatus = `Updated ${selection.actorId} ${selection.direction} ${selection.actionId} attack frames`;
    patchGymState();
  });
  gymSaveBoundsButton.addEventListener('click', async () => {
    gymSaveStatus = 'Saving gym config...';
    renderGymControls();

    const payload = buildNinjaBoundsExport(ninjaBoundsConfig);

    try {
      const response = await fetch(NINJA_BOUNDS_SAVE_ENDPOINT, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Save failed with ${response.status}`);
      }

      gymSaveStatus = 'Saved public/assets/config/ninja-bounds.json';
    } catch {
      downloadJsonFile('ninja-bounds.json', payload);
      gymSaveStatus = 'Downloaded ninja-bounds.json';
    }

    renderGymControls();
  });
  gymResetBoundsButton.addEventListener('click', () => {
    const selection = getGymSelection();
    ninjaBoundsConfig = resetNinjaAnimationConfig(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId
    );
    gymSaveStatus = `Reset ${selection.actorId} ${selection.direction} ${selection.actionId}`;
    patchGymState();
  });
  gymMirrorDirectionButton.addEventListener('click', () => {
    const selection = getGymSelection();
    const targetDirection = getOppositeFacingDirection(selection.direction);
    const sourceBounds = readGymBoundsInputs();
    const mirroredBounds = mirrorNinjaRectHorizontally(sourceBounds);

    ninjaBoundsConfig = setNinjaAnimationBounds(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      selection.boundsKind,
      sourceBounds
    );
    ninjaBoundsConfig = setNinjaAnimationBounds(
      ninjaBoundsConfig,
      selection.actorId,
      targetDirection,
      selection.actionId,
      selection.boundsKind,
      mirroredBounds
    );
    gymSelectedActorId = selection.actorId;
    gymSelectedDirection = targetDirection;
    gymSelectedActionId = selection.actionId;
    gymSelectedBoundsKind = selection.boundsKind;
    gymSaveStatus = `Mirrored ${selection.boundsKind} from ${selection.direction} to ${targetDirection}`;
    syncNinjaGymGlobal();
    renderGymControls();
  });
  gymMirrorLaneAnchorButton.addEventListener('click', () => {
    const selection = getGymSelection();
    const targetDirection = getOppositeFacingDirection(selection.direction);
    const sourceAnchor = readGymLaneAnchorInputs();
    const mirroredAnchor = mirrorNinjaLaneAnchorHorizontally(sourceAnchor);

    ninjaBoundsConfig = setNinjaLaneAnchor(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.actionId,
      sourceAnchor
    );
    ninjaBoundsConfig = setNinjaLaneAnchor(
      ninjaBoundsConfig,
      selection.actorId,
      targetDirection,
      selection.actionId,
      mirroredAnchor
    );
    gymSelectedActorId = selection.actorId;
    gymSelectedDirection = targetDirection;
    gymSelectedActionId = selection.actionId;
    gymSaveStatus = `Mirrored lane anchor from ${selection.direction} to ${targetDirection}`;
    syncNinjaGymGlobal();
    renderGymControls();
  });
  gymApplyKindAllButton.addEventListener('click', () => {
    const selection = getGymSelection();
    ninjaBoundsConfig = applyNinjaBoundsKindToAllActions(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      selection.boundsKind,
      readGymBoundsInputs()
    );
    gymSaveStatus = `Applied ${selection.boundsKind} to all ${selection.actorId} ${selection.direction} animations`;
    patchGymState();
  });
  gymApplyLaneAnchorAllButton.addEventListener('click', () => {
    const selection = getGymSelection();
    ninjaBoundsConfig = applyNinjaLaneAnchorToAllActions(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      readGymLaneAnchorInputs()
    );
    gymSaveStatus = `Applied lane anchor to all ${selection.actorId} ${selection.direction} animations`;
    patchGymState();
  });
  gymApplyAllButton.addEventListener('click', () => {
    const selection = getGymSelection();
    const currentBounds = {
      ...getNinjaAnimationBounds(
        ninjaBoundsConfig,
        selection.actorId,
        selection.direction,
        selection.actionId
      ),
      [selection.boundsKind]: readGymBoundsInputs()
    };

    ninjaBoundsConfig = applyAllNinjaBoundsToAllActions(
      ninjaBoundsConfig,
      selection.actorId,
      selection.direction,
      currentBounds
    );
    gymSaveStatus = `Applied all bounds to all ${selection.actorId} ${selection.direction} animations`;
    patchGymState();
  });

  debugCollapse.addEventListener('click', () => {
    debugPanel.classList.toggle('is-collapsed');
    debugCollapse.textContent = debugPanel.classList.contains('is-collapsed') ? 'Expand' : 'Collapse';
  });

  window.addEventListener(
    'keydown',
    (event) => {
      if (event.key !== 'Escape' || !playMode) {
        return;
      }

      event.preventDefault();
      event.stopImmediatePropagation();
      void exitPlayMode();
    },
    { capture: true }
  );

  document.addEventListener('fullscreenchange', () => {
    if (document.fullscreenElement === null && playMode) {
      setPlayMode(false);
    }
  });

  window.addEventListener('resize', () => {
    updateDebugResizeHandleState();
    applyDebugPanelWidth(debugPanelWidth, false);
  });

  window.addEventListener('beforeunload', () => {
    if (gymControlsRenderFrame !== null) {
      window.cancelAnimationFrame(gymControlsRenderFrame);
      gymControlsRenderFrame = null;
    }

    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }

    game?.destroy(true);
  });

  applyDebugPanelWidth(debugPanelWidth, false);
  mountGame();
}
