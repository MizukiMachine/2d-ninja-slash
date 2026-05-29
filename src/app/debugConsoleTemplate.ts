import { BGM_TRACKS } from '../game/assets/audioAssetCatalog';
import {
  GAMEPLAY_TUNING_LIMITS,
  ROUND_ENEMY_GROWTH_MODES
} from '../game/debugFeatures';
import {
  FACING_DIRECTIONS,
  NINJA_ACTORS,
  NINJA_FRAME_SIZE,
  NINJA_PLAYBACK_RATE_LIMITS
} from '../game/ninjaBounds';
import { SceneKeys } from '../game/sceneKeys';

export function createDebugControlsHtml(): string {
  return `
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
}
