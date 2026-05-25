import { createGame } from '../game/createGame';
import {
  DEFAULT_PROFILE_ID,
  GAME_PROFILES,
  getProfileById,
  type ProfileId
} from '../game/profiles';
import { SceneKeys } from '../game/sceneKeys';
import {
  BACKGROUND_FILE_NAMES_BY_SPRITE_SET,
  DEBUG_SPRITE_SHEET_SET_OPTIONS,
  isDebugBackgroundFileName,
  isDebugSpriteSheetSet,
  type DebugSpriteSheetSet
} from '../game/assets/ninjaAssetCatalog';
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

function createSpriteSheetSetOptionsHtml(): string {
  return DEBUG_SPRITE_SHEET_SET_OPTIONS.map(
    (option) => `<option value="${option.id}">${option.label}</option>`
  ).join('');
}

function formatBackgroundLabel(fileName: string): string {
  return fileName.replace(/\.png$/u, '').replaceAll('-', ' ');
}

export function createApp(root: HTMLDivElement | null): void {
  if (root === null) {
    throw new Error('Missing #app root.');
  }

  let profileId: ProfileId = DEFAULT_PROFILE_ID;
  let game: ReturnType<typeof createGame> | null = null;
  let playMode = false;
  let playToastTimeout: number | null = null;

  const debugStore = createDebugStore();
  const settingsStore = createSettingsStore();
  const context: AppContext = {
    debugStore,
    settingsStore,
    getProfile: () => getProfileById(profileId)
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
  const gameMount = requireElement(root, '#game-root', HTMLDivElement);
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
      <label class="select-row" for="sprite-sheet-set">
        <span>Sprite set</span>
        <select id="sprite-sheet-set">
          ${createSpriteSheetSetOptionsHtml()}
        </select>
      </label>
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
  const spriteSheetSetSelect = requireElement(debugControls, '#sprite-sheet-set', HTMLSelectElement);
  const backgroundFileSelect = requireElement(debugControls, '#background-file', HTMLSelectElement);
  const sceneReadout = requireElement(debugControls, '#scene-readout', HTMLElement);
  const fpsReadout = requireElement(debugControls, '#fps-readout', HTMLElement);
  const pointerReadout = requireElement(debugControls, '#pointer-readout', HTMLElement);
  const inputReadout = requireElement(debugControls, '#input-readout', HTMLElement);
  const playerReadout = requireElement(debugControls, '#player-readout', HTMLElement);
  const enemyReadout = requireElement(debugControls, '#enemy-readout', HTMLElement);
  const attackReadout = requireElement(debugControls, '#attack-readout', HTMLElement);

  const refreshScale = (): void => {
    requestAnimationFrameOnce(() => {
      game?.scale.refresh();
    });
  };

  const focusGame = (): void => {
    requestAnimationFrameOnce(() => {
      gameMount.focus({ preventScroll: true });
    });
  };

  const renderBackgroundFileOptions = (spriteSheetSet: DebugSpriteSheetSet): void => {
    backgroundFileSelect.replaceChildren(
      ...BACKGROUND_FILE_NAMES_BY_SPRITE_SET[spriteSheetSet].map((fileName) => {
        const option = document.createElement('option');
        option.value = fileName;
        option.textContent = formatBackgroundLabel(fileName);
        return option;
      })
    );
    backgroundFileSelect.dataset.spriteSheetSet = spriteSheetSet;
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
    spriteSheetSetSelect.value = state.spriteSheetSet;
    if (backgroundFileSelect.dataset.spriteSheetSet !== state.spriteSheetSet) {
      renderBackgroundFileOptions(state.spriteSheetSet);
    }
    backgroundFileSelect.value = state.backgroundFileNames[state.spriteSheetSet];
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
  };

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

  spriteSheetSetSelect.addEventListener('change', () => {
    if (isDebugSpriteSheetSet(spriteSheetSetSelect.value)) {
      debugStore.setSpriteSheetSet(spriteSheetSetSelect.value);
    }
  });

  backgroundFileSelect.addEventListener('change', () => {
    const spriteSheetSet = debugStore.get().spriteSheetSet;

    if (isDebugBackgroundFileName(spriteSheetSet, backgroundFileSelect.value)) {
      debugStore.setBackgroundFileName(spriteSheetSet, backgroundFileSelect.value);
    }
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

  window.addEventListener('beforeunload', () => {
    for (const unsubscribe of subscriptions) {
      unsubscribe();
    }

    game?.destroy(true);
  });

  mountGame();
}
