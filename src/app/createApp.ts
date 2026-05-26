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
  DEFAULT_NINJA_BOUNDS_CONFIG,
  FACING_DIRECTIONS,
  NINJA_ACTORS,
  NINJA_BOUNDS_CONFIG_URL,
  NINJA_BOUNDS_SAVE_ENDPOINT,
  areNinjaRectsEqual,
  applyAllNinjaBoundsToAllActions,
  applyNinjaBoundsKindToAllActions,
  buildNinjaBoundsExport,
  cloneNinjaBoundsConfig,
  getDefaultNinjaActionId,
  getNinjaAction,
  getNinjaAnimationBounds,
  getNinjaAnimationsForActor,
  getOppositeFacingDirection,
  isNinjaHitFrameActive,
  mirrorNinjaRectHorizontally,
  normalizeFacingDirection,
  normalizeNinjaActionId,
  normalizeNinjaActorId,
  normalizeNinjaBoundsConfig,
  normalizeNinjaBoundsKind,
  resetNinjaAnimationConfig,
  setNinjaAnimationBounds,
  setNinjaHitFrame,
  type FacingDirection,
  type NinjaActorId,
  type NinjaBoundsConfig,
  type NinjaBoundsKind,
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

function formatVector(x: number, y: number): string {
  return `${formatNumber(x)}, ${formatNumber(y)}`;
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
    const activeClass = isActive(frameIndex) ? ' is-active' : '';
    const currentClass = frameIndex === currentFrame ? ' is-current' : '';

    return `<button class="frame-toggle${activeClass}${currentClass}" type="button" data-frame-index="${frameIndex}" aria-pressed="${
      isActive(frameIndex) ? 'true' : 'false'
    }" title="Attack frame ${frameIndex + 1}">${frameIndex + 1}</button>`;
  }).join('');
}

function normalizePlaybackRate(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(2, Math.max(0.25, Math.round(value * 100) / 100));
}

function clampRectToFrame(rect: NinjaRect): NinjaRect {
  const x = clampInteger(rect.x, 0, 255);
  const y = clampInteger(rect.y, 0, 255);
  const width = clampInteger(rect.width, 1, 256 - x);
  const height = clampInteger(rect.height, 1, 256 - y);

  return { x, y, width, height };
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
  let gymSaveStatus = 'Loaded defaults';
  let gymSelectedActorId: NinjaActorId = 'mainNinja';
  let gymSelectedDirection: FacingDirection = 'right';
  let gymSelectedActionId = getDefaultNinjaActionId(gymSelectedActorId);
  let gymSelectedBoundsKind: NinjaBoundsKind = 'collision';
  let gymShowVisualBounds = true;
  let gymShowCollisionBounds = true;
  let gymShowAttackBounds = true;
  let gymPlaybackRate = 1;
  let gymControlsRenderFrame: number | null = null;
  let debugPanelWidth = loadDebugPanelWidth();

  const debugStore = createDebugStore();
  const settingsStore = createSettingsStore();
  const context: AppContext = {
    debugStore,
    settingsStore,
    getProfile: () => getProfileById(profileId),
    getNinjaBoundsConfig: () => ninjaBoundsConfig
  };

  root.className = 'app-shell';
  root.dataset.profile = profileId;
  root.innerHTML = `
    <header class="app-shell__header">
      <div class="app-shell__brand">
        <p class="eyebrow">PHASER-4-STARTER</p>
        <h1>Phaser 4 Starter</h1>
        <p class="subtitle">Reusable 2D browser game scaffold</p>
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
      <label class="toggle-row"><input id="enemy-chase" type="checkbox" /> Enemy chase</label>
      <label class="select-row" for="background-file">
        <span>Background</span>
        <select id="background-file"></select>
      </label>
    </div>
    <div class="panel-group">
      <p class="panel-group__title">Overlays</p>
      <label class="toggle-row"><input id="show-visual-bounds" type="checkbox" /> Visual bounds</label>
      <label class="toggle-row"><input id="show-hit-boxes" type="checkbox" /> Hit boxes</label>
      <label class="toggle-row"><input id="show-attack-boxes" type="checkbox" /> Attack boxes</label>
      <label class="toggle-row"><input id="show-origins" type="checkbox" /> Origins</label>
      <label class="toggle-row"><input id="show-pointer-probe" type="checkbox" /> Pointer probe</label>
      <label class="toggle-row"><input id="show-enemy-ranges" type="checkbox" /> Enemy ranges</label>
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
        <span>Playback</span>
        <input id="gym-playback-rate" type="range" min="0.25" max="2" step="0.05" />
        <strong id="gym-playback-readout">1.00x</strong>
      </label>
      <div class="frame-control">
        <div class="frame-control__header">
          <span>Frame</span>
          <strong id="gym-frame-readout">1/32</strong>
        </div>
        <p class="panel-note">Attack active frames</p>
        <div id="gym-attack-frame-strip" class="frame-strip" aria-label="Attack active frames"></div>
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
        <button id="gym-save-bounds" class="shell-button" data-variant="primary" type="button">Save</button>
        <button id="gym-reset-bounds" class="shell-button" type="button">Reset</button>
        <button id="gym-mirror-direction" class="shell-button" type="button">Mirror selected</button>
        <button id="gym-apply-kind-all" class="shell-button" type="button">Apply selected</button>
        <button id="gym-apply-all" class="shell-button" type="button">Apply all</button>
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
  const enemyChaseToggle = requireElement(debugControls, '#enemy-chase', HTMLInputElement);
  const backgroundFileSelect = requireElement(debugControls, '#background-file', HTMLSelectElement);
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
  const gymAttackFrameStrip = requireElement(
    debugControls,
    '#gym-attack-frame-strip',
    HTMLElement
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
  const gymSaveStatusElement = requireElement(debugControls, '#gym-save-status', HTMLElement);
  const sceneReadout = requireElement(debugControls, '#scene-readout', HTMLElement);
  const fpsReadout = requireElement(debugControls, '#fps-readout', HTMLElement);
  const pointerReadout = requireElement(debugControls, '#pointer-readout', HTMLElement);
  const inputReadout = requireElement(debugControls, '#input-readout', HTMLElement);
  const playerReadout = requireElement(debugControls, '#player-readout', HTMLElement);
  const enemyReadout = requireElement(debugControls, '#enemy-readout', HTMLElement);
  const attackReadout = requireElement(debugControls, '#attack-readout', HTMLElement);

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

  const syncNinjaGymGlobal = (): void => {
    const current = globalThis.__NINJA_SLASH_GYM__;
    const actorId = normalizeNinjaActorId(gymSelectedActorId);
    const direction = normalizeFacingDirection(gymSelectedDirection);
    const actionId = normalizeNinjaActionId(actorId, gymSelectedActionId);

    globalThis.__NINJA_SLASH_GYM__ = {
      active: debugStore.get().activeScene === SceneKeys.Gym,
      selectedActorId: actorId,
      selectedDirection: direction,
      selectedActionId: actionId,
      selectedBoundsKind: normalizeNinjaBoundsKind(gymSelectedBoundsKind),
      showVisualBounds: gymShowVisualBounds,
      showCollisionBounds: gymShowCollisionBounds,
      showAttackBounds: gymShowAttackBounds,
      playbackRate: gymPlaybackRate,
      boundsConfig: ninjaBoundsConfig,
      currentFrame: current?.currentFrame ?? 0,
      zoom: current?.zoom ?? 1.35,
      updateBounds: updateGymBoundsFromScene
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
    gymPlaybackRate = normalizePlaybackRate(Number(gymPlaybackRateInput.value));
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

  const renderGymControls = (): void => {
    const active = debugStore.get().activeScene === SceneKeys.Gym;
    const actorId = normalizeNinjaActorId(gymSelectedActorId);
    const direction = normalizeFacingDirection(gymSelectedDirection);
    const actionId = normalizeNinjaActionId(actorId, gymSelectedActionId);
    const boundsKind = normalizeNinjaBoundsKind(gymSelectedBoundsKind);
    const actionDefinition = getNinjaAction(actorId, actionId);
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
    gymPlaybackRateInput.value = String(gymPlaybackRate);
    gymPlaybackReadout.textContent = `${gymPlaybackRate.toFixed(2)}x`;
    gymFrameReadout.textContent = `${currentFrame + 1}/${actionDefinition.frameCount}`;
    gymMirrorDirectionButton.textContent = `Mirror to ${getOppositeFacingDirection(direction)}`;
    gymMirrorDirectionButton.title = `Copy selected ${boundsKind} bounds to ${getOppositeFacingDirection(
      direction
    )} with horizontal flip`;
    gymAttackFrameStrip.innerHTML = formatFrameStripButtons(
      actionDefinition.frameCount,
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
      game?.scene.start(SceneKeys.Sandbox);
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
    enemyChaseToggle.checked = state.enemyChaseEnabled;
    backgroundFileSelect.value = state.backgroundFileName;
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

  enemyChaseToggle.addEventListener('change', () => {
    debugStore.setEnemyChaseEnabled(enemyChaseToggle.checked);
  });

  backgroundFileSelect.addEventListener('change', () => {
    if (isDebugBackgroundFileName(backgroundFileSelect.value)) {
      debugStore.setBackgroundFileName(backgroundFileSelect.value);
    }
  });

  gymExitButton.addEventListener('click', () => {
    game?.scene.start(SceneKeys.MainMenu);
    focusGame();
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
  gymPlaybackRateInput.addEventListener('input', patchGymState);
  gymBoundsXInput.addEventListener('input', updateSelectedGymBounds);
  gymBoundsYInput.addEventListener('input', updateSelectedGymBounds);
  gymBoundsWidthInput.addEventListener('input', updateSelectedGymBounds);
  gymBoundsHeightInput.addEventListener('input', updateSelectedGymBounds);
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
    gymSaveStatus = 'Saving bounds...';
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
