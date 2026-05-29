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
  isBgmTrackId,
  isSfxCueId,
  type SfxCueId
} from '../game/assets/audioAssetCatalog';
import { createGameAudio } from '../game/audio/gameAudio';
import {
  DEFAULT_GAMEPLAY_TUNING,
  GAMEPLAY_TUNING_CONFIG_URL,
  GAMEPLAY_TUNING_SAVE_ENDPOINT,
  SANDBOX_LANE_SETTINGS_CONFIG_URL,
  createDefaultSandboxLaneSettingsConfig,
  createDefaultSandboxLaneSettings,
  getSandboxLaneSettingsForProfile,
  normalizeGameplayTuning,
  normalizeSandboxLaneSettingsConfig,
  normalizeSandboxLaneSettings,
  setSandboxLaneSettingsForProfile,
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
  NINJA_BOUNDS_CONFIG_URL,
  NINJA_BOUNDS_SAVE_ENDPOINT,
  NINJA_FRAME_SIZE,
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
import { loadJsonConfig, saveJsonConfig } from './debugConfigIO';
import { writeSandboxLaneSettings } from './sandboxLaneSettingsIO';
import { getDebugConsoleRefs } from './debugConsoleRefs';
import { createDebugControlsHtml } from './debugConsoleTemplate';
import {
  downloadJsonFile,
  requireElement,
  setControlGroupHidden
} from './dom';
import type { AppContext } from './context';
import type { Unsubscribe } from '../stores/store';

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

const loadNinjaBoundsConfig = (): Promise<NinjaBoundsConfig | null> =>
  loadJsonConfig(NINJA_BOUNDS_CONFIG_URL, normalizeNinjaBoundsConfig);

const loadGameplayTuningConfig = (): Promise<GameplayTuning | null> =>
  loadJsonConfig(GAMEPLAY_TUNING_CONFIG_URL, normalizeGameplayTuning);

const loadSandboxLaneSettingsConfig =
  (): Promise<SandboxLaneSettingsConfig | null> =>
    loadJsonConfig(
      SANDBOX_LANE_SETTINGS_CONFIG_URL,
      normalizeSandboxLaneSettingsConfig
    );

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
  let sandboxLaneSettingsConfig = createDefaultSandboxLaneSettingsConfig();
  let sandboxLaneSettingsLoadedFromFile = false;
  let sandboxLaneSettingsDirty = false;
  let gymSaveStatus = 'Loaded defaults';
  let gameplayTuningSaveStatus = 'Loaded defaults';
  let laneEditorSaveStatus = 'Loaded defaults';
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
  let laneSaveInFlight = false;
  let laneSavePendingAfterFlight = false;
  const saveLaneSettingsToFile = async (
    allowDownloadFallback: boolean
  ): Promise<void> => {
    if (laneSaveInFlight) {
      // Coalesce rapid drag-release saves into a single trailing write.
      laneSavePendingAfterFlight = true;
      return;
    }

    laneSaveInFlight = true;
    laneEditorSaveStatus = 'Saving lane config...';
    renderLaneEditorControls();

    const { ok, payload } = await writeSandboxLaneSettings(
      sandboxLaneSettingsConfig,
      profileId,
      debugStore.get().sandboxLaneSettings,
      getCurrentProfileHeight()
    );

    if (ok) {
      sandboxLaneSettingsConfig = payload;
      sandboxLaneSettingsLoadedFromFile = true;
      sandboxLaneSettingsDirty = false;
      laneEditorSaveStatus = 'Saved public/assets/config/sandbox-lanes.json';
    } else if (allowDownloadFallback) {
      downloadJsonFile('sandbox-lanes.json', payload);
      laneEditorSaveStatus = 'Downloaded sandbox-lanes.json';
    } else {
      laneEditorSaveStatus = 'Lane auto-save failed (run npm run dev)';
    }

    renderLaneEditorControls();
    laneSaveInFlight = false;

    if (laneSavePendingAfterFlight) {
      laneSavePendingAfterFlight = false;
      void saveLaneSettingsToFile(allowDownloadFallback);
    }
  };
  const context: AppContext = {
    debugStore,
    settingsStore,
    audio,
    getProfile: () => getProfileById(profileId),
    getNinjaBoundsConfig: () => ninjaBoundsConfig,
    setSandboxLaneSettings: (settings) => {
      setSandboxLaneSettingsForCurrentProfile(settings);
    },
    persistSandboxLaneSettings: () => {
      void saveLaneSettingsToFile(false);
    }
  };

  root.className = 'app-shell';
  root.dataset.profile = profileId;
  root.innerHTML = `
    <header class="app-shell__header">
      <div class="app-shell__brand">
        <p class="eyebrow">PHASER 4 DEBUG LAB</p>
        <h1>2D Ninja Slash</h1>
        <p class="subtitle">Sandbox, lane, gym, and tuning workspace</p>
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

  debugControls.innerHTML = createDebugControlsHtml();

  const {
    pauseToggle,
    resetActorsButton,
    showWorldToggle,
    showVisualBoundsToggle,
    showHitBoxesToggle,
    showAttackBoxesToggle,
    showOriginsToggle,
    showPointerProbeToggle,
    showEnemyRangesToggle,
    laneEditorControls,
    showLaneGuidesToggle,
    laneUpperYInput,
    laneMiddleYInput,
    laneLowerYInput,
    laneUpperYReadout,
    laneMiddleYReadout,
    laneLowerYReadout,
    laneUpperYNumberInput,
    laneMiddleYNumberInput,
    laneLowerYNumberInput,
    laneSaveButton,
    laneResetButton,
    laneSaveStatus,
    enemyAiToggle,
    backgroundFileSelect,
    bgmTrackSelect,
    tuningPlayerSpeedInput,
    tuningPlayerSpeedReadout,
    tuningEnemySpeedInput,
    tuningEnemySpeedReadout,
    tuningRecoveryInput,
    tuningRecoveryReadout,
    tuningKnockbackInput,
    tuningKnockbackReadout,
    tuningRoundBaseInput,
    tuningRoundBaseReadout,
    tuningRoundStepInput,
    tuningRoundStepReadout,
    tuningRoundMaxInput,
    tuningRoundMaxReadout,
    tuningRoundWaitInput,
    tuningRoundWaitReadout,
    tuningRoundGrowthSelect,
    tuningSaveButton,
    tuningResetButton,
    tuningSaveStatus,
    gymControls,
    gymExitButton,
    gymActorSelect,
    gymDirectionSelect,
    gymActionSelect,
    gymShowVisualToggle,
    gymShowCollisionToggle,
    gymShowAttackToggle,
    gymPlaybackRateInput,
    gymPlaybackReadout,
    gymFrameReadout,
    gymAttackFrameReadout,
    gymAttackFrameStrip,
    gymToggleCurrentHitFrameButton,
    gymOnlyCurrentHitFrameButton,
    gymClearHitFramesButton,
    gymResetHitFramesButton,
    gymBoundsKindSelect,
    gymBoundsXInput,
    gymBoundsYInput,
    gymBoundsWidthInput,
    gymBoundsHeightInput,
    gymSaveBoundsButton,
    gymResetBoundsButton,
    gymMirrorDirectionButton,
    gymApplyKindAllButton,
    gymApplyAllButton,
    gymLaneAnchorReadout,
    gymLaneAnchorXInput,
    gymLaneAnchorYInput,
    gymMirrorLaneAnchorButton,
    gymApplyLaneAnchorAllButton,
    gymSaveStatusElement,
    sceneReadout,
    fpsReadout,
    pointerReadout,
    inputReadout,
    playerReadout,
    enemyReadout,
    attackReadout,
    roundReadout
  } = getDebugConsoleRefs(debugControls);

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

  const playPreviewSfx = (cueId: SfxCueId): void => {
    const activeScene = game?.scene.getScene(debugStore.get().activeScene);

    if (activeScene === null || activeScene === undefined) {
      return;
    }

    if (activeScene.sound.locked) {
      activeScene.sound.once('unlocked', () => {
        audio.playSfx(activeScene, cueId);
      });
      focusGame();
      return;
    }

    audio.playSfx(activeScene, cueId);
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
    renderLaneEditorControls();
    renderGameplayTuningControls();
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
    const sfxButton = (event.target as HTMLElement).closest<HTMLButtonElement>(
      'button[data-sfx-preview]'
    );

    if (sfxButton !== null) {
      const cueId = sfxButton.dataset.sfxPreview;

      if (cueId !== undefined && isSfxCueId(cueId)) {
        playPreviewSfx(cueId);
      }

      return;
    }

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

  // Range sliders update live on 'input' but auto-save on 'change' (fires on
  // release), matching the canvas Lane Editor's drag-release auto-save so panel
  // edits also survive a reload without pressing Save.
  laneUpperYInput.addEventListener('input', () => {
    patchLaneSettings({ upperY: Number(laneUpperYInput.value) });
  });
  laneMiddleYInput.addEventListener('input', () => {
    patchLaneSettings({ middleY: Number(laneMiddleYInput.value) });
  });
  laneLowerYInput.addEventListener('input', () => {
    patchLaneSettings({ lowerY: Number(laneLowerYInput.value) });
  });
  laneUpperYInput.addEventListener('change', () => {
    void saveLaneSettingsToFile(false);
  });
  laneMiddleYInput.addEventListener('change', () => {
    void saveLaneSettingsToFile(false);
  });
  laneLowerYInput.addEventListener('change', () => {
    void saveLaneSettingsToFile(false);
  });
  laneUpperYNumberInput.addEventListener('change', () => {
    patchLaneSettings({ upperY: Number(laneUpperYNumberInput.value) });
    void saveLaneSettingsToFile(false);
  });
  laneMiddleYNumberInput.addEventListener('change', () => {
    patchLaneSettings({ middleY: Number(laneMiddleYNumberInput.value) });
    void saveLaneSettingsToFile(false);
  });
  laneLowerYNumberInput.addEventListener('change', () => {
    patchLaneSettings({ lowerY: Number(laneLowerYNumberInput.value) });
    void saveLaneSettingsToFile(false);
  });
  laneSaveButton.addEventListener('click', () => {
    void saveLaneSettingsToFile(true);
  });
  laneResetButton.addEventListener('click', () => {
    const worldHeight = getCurrentProfileHeight();

    setSandboxLaneSettingsForCurrentProfile(
      createDefaultSandboxLaneSettings(worldHeight),
      'Unsaved lane reset'
    );
    void saveLaneSettingsToFile(false);
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
      await saveJsonConfig(GAMEPLAY_TUNING_SAVE_ENDPOINT, payload);
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
      await saveJsonConfig(NINJA_BOUNDS_SAVE_ENDPOINT, payload);
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
