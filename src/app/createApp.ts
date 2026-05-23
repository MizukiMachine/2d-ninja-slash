import { createGame } from '../game/createGame';
import {
  DEFAULT_PROFILE_ID,
  GAME_PROFILES,
  getProfileById,
  type ProfileId
} from '../game/profiles';
import { SceneKeys } from '../game/sceneKeys';
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
      <label class="toggle-row"><input id="show-world" type="checkbox" /> World bounds</label>
    </div>
    <div class="metrics">
      <div class="metrics__row"><span>Scene</span><strong id="scene-readout">Boot</strong></div>
      <div class="metrics__row"><span>Pointer</span><strong id="pointer-readout">0, 0</strong></div>
      <div class="metrics__row"><span>Input</span><strong id="input-readout">idle</strong></div>
    </div>
  `;

  const pauseToggle = requireElement(debugControls, '#pause-toggle', HTMLButtonElement);
  const showWorldToggle = requireElement(debugControls, '#show-world', HTMLInputElement);
  const sceneReadout = requireElement(debugControls, '#scene-readout', HTMLElement);
  const pointerReadout = requireElement(debugControls, '#pointer-readout', HTMLElement);
  const inputReadout = requireElement(debugControls, '#input-readout', HTMLElement);

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
    showWorldToggle.checked = state.showWorldBounds;
    pointerReadout.textContent = `${state.pointer.x}, ${state.pointer.y} / ${state.pointer.worldX}, ${state.pointer.worldY} ${
      state.pointer.down ? 'down' : 'up'
    }`;
    inputReadout.textContent =
      pressedInputs.length > 0 ? `${pressedInputs.join(' + ')} ${state.input.lastKey}`.trim() : state.input.lastKey || 'idle';
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

  showWorldToggle.addEventListener('change', () => {
    debugStore.setShowWorldBounds(showWorldToggle.checked);
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
