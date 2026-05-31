import {
  SFX_CUES,
  isSfxCueId,
  type SfxCueId
} from '../assets/audioAssetCatalog';

/**
 * A game event that triggers a sound effect. Trigger ids are the strings passed
 * to {@link BaseScene.playSfx} at the call sites; by default each trigger maps to
 * the cue of the same name, but the debug "SFX Assign" panel lets any trigger be
 * re-bound to any cue. The label is shown in that panel.
 */
export interface SfxTrigger {
  readonly id: string;
  readonly label: string;
  readonly defaultCueId: SfxCueId;
}

export const SFX_TRIGGERS = [
  { id: 'ui-select', label: 'メニュー選択', defaultCueId: 'ui-select' },
  { id: 'player-slash', label: '自機の斬撃', defaultCueId: 'player-slash' },
  { id: 'enemy-slash', label: '敵の斬撃', defaultCueId: 'enemy-slash' },
  { id: 'jump', label: 'ジャンプ', defaultCueId: 'jump' },
  { id: 'lane-dash', label: 'レーン移動(回避)', defaultCueId: 'lane-dash' },
  { id: 'hit', label: '命中', defaultCueId: 'hit' },
  { id: 'player-hurt', label: '自機被弾', defaultCueId: 'player-hurt' },
  { id: 'enemy-defeat', label: '敵を倒した', defaultCueId: 'enemy-defeat' },
  { id: 'main-ninja-death', label: '自機死亡', defaultCueId: 'main-ninja-death' },
  { id: 'round-start', label: 'ラウンド開始', defaultCueId: 'round-start' }
] as const satisfies readonly SfxTrigger[];

export type SfxTriggerId = (typeof SFX_TRIGGERS)[number]['id'];

export interface SfxBindingsConfig {
  /** Which cue each game event plays. */
  readonly bindings: Readonly<Record<SfxTriggerId, SfxCueId>>;
  /** Per-cue playback volume (multiplied by the master volume at play time). */
  readonly volumes: Readonly<Record<SfxCueId, number>>;
}

export const SFX_BINDINGS_CONFIG_URL = '/assets/config/sfx-bindings.json';
/** Keep this string in sync with the endpoint registered in vite.config.ts. */
export const SFX_BINDINGS_SAVE_ENDPOINT = '/__debug/sfx-bindings';

export const SFX_VOLUME_LIMITS = {
  min: 0,
  max: 0.75,
  step: 0.01
} as const;

export function clampSfxVolume(value: number): number {
  if (!Number.isFinite(value)) {
    return SFX_VOLUME_LIMITS.min;
  }

  return Math.min(SFX_VOLUME_LIMITS.max, Math.max(SFX_VOLUME_LIMITS.min, value));
}

function createDefaultBindings(): Record<SfxTriggerId, SfxCueId> {
  const bindings = {} as Record<SfxTriggerId, SfxCueId>;

  for (const trigger of SFX_TRIGGERS) {
    bindings[trigger.id] = trigger.defaultCueId;
  }

  return bindings;
}

function createDefaultVolumes(): Record<SfxCueId, number> {
  const volumes = {} as Record<SfxCueId, number>;

  for (const cue of SFX_CUES) {
    volumes[cue.id] = clampSfxVolume(cue.volume);
  }

  return volumes;
}

export function createDefaultSfxBindingsConfig(): SfxBindingsConfig {
  return {
    bindings: createDefaultBindings(),
    volumes: createDefaultVolumes()
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Coerces arbitrary JSON into a complete {@link SfxBindingsConfig}. The result is
 * guaranteed to contain every trigger and every cue key, so runtime lookups never
 * hit `undefined`/`NaN`:
 * - missing keys are filled from the catalog defaults,
 * - unknown keys are dropped,
 * - invalid cue references fall back to the trigger's default cue,
 * - volumes are clamped to {@link SFX_VOLUME_LIMITS}.
 */
export function normalizeSfxBindingsConfig(value: unknown): SfxBindingsConfig {
  const defaults = createDefaultSfxBindingsConfig();

  if (!isRecord(value)) {
    return defaults;
  }

  const rawBindings = isRecord(value.bindings) ? value.bindings : {};
  const rawVolumes = isRecord(value.volumes) ? value.volumes : {};

  const bindings = {} as Record<SfxTriggerId, SfxCueId>;
  for (const trigger of SFX_TRIGGERS) {
    const candidate = rawBindings[trigger.id];
    bindings[trigger.id] =
      typeof candidate === 'string' && isSfxCueId(candidate)
        ? candidate
        : trigger.defaultCueId;
  }

  const volumes = {} as Record<SfxCueId, number>;
  for (const cue of SFX_CUES) {
    const candidate = rawVolumes[cue.id];
    volumes[cue.id] =
      typeof candidate === 'number'
        ? clampSfxVolume(candidate)
        : defaults.volumes[cue.id];
  }

  return { bindings, volumes };
}

export function isSfxTriggerId(value: string): value is SfxTriggerId {
  return SFX_TRIGGERS.some((trigger) => trigger.id === value);
}

export function getSfxTriggerLabel(triggerId: SfxTriggerId): string {
  return SFX_TRIGGERS.find((trigger) => trigger.id === triggerId)?.label ?? triggerId;
}
