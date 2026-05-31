import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { SFX_CUES } from '../src/game/assets/audioAssetCatalog';
import {
  SFX_TRIGGERS,
  SFX_VOLUME_LIMITS,
  clampSfxVolume,
  createDefaultSfxBindingsConfig,
  isSfxTriggerId,
  normalizeSfxBindingsConfig
} from '../src/game/audio/sfxBindings';

describe('sfx bindings config', () => {
  it('defaults to an identity binding for every trigger and catalog volumes', () => {
    const config = createDefaultSfxBindingsConfig();

    for (const trigger of SFX_TRIGGERS) {
      expect(config.bindings[trigger.id]).toBe(trigger.defaultCueId);
    }

    for (const cue of SFX_CUES) {
      expect(config.volumes[cue.id]).toBe(clampSfxVolume(cue.volume));
    }
  });

  it('clamps volumes to the configured limits', () => {
    expect(clampSfxVolume(-1)).toBe(SFX_VOLUME_LIMITS.min);
    expect(clampSfxVolume(99)).toBe(SFX_VOLUME_LIMITS.max);
    expect(clampSfxVolume(Number.NaN)).toBe(SFX_VOLUME_LIMITS.min);
    expect(clampSfxVolume(0.23)).toBe(0.23);
  });

  it('falls back to defaults for non-object input', () => {
    expect(normalizeSfxBindingsConfig(null)).toEqual(createDefaultSfxBindingsConfig());
    expect(normalizeSfxBindingsConfig('nope')).toEqual(createDefaultSfxBindingsConfig());
    expect(normalizeSfxBindingsConfig(42)).toEqual(createDefaultSfxBindingsConfig());
  });

  it('fills missing trigger and cue keys from defaults', () => {
    const config = normalizeSfxBindingsConfig({ bindings: {}, volumes: {} });
    const defaults = createDefaultSfxBindingsConfig();

    expect(config).toEqual(defaults);
    // Every trigger / cue key is present so runtime lookups never hit undefined.
    expect(Object.keys(config.bindings).sort()).toEqual(
      SFX_TRIGGERS.map((trigger) => trigger.id).sort()
    );
    expect(Object.keys(config.volumes).sort()).toEqual(
      SFX_CUES.map((cue) => cue.id).sort()
    );
  });

  it('drops unknown keys and invalid cue references', () => {
    const config = normalizeSfxBindingsConfig({
      bindings: {
        'enemy-defeat': 'player-defeat', // valid re-bind
        'jump': 'not-a-real-cue', // invalid -> default
        'totally-unknown-trigger': 'enemy-defeat' // unknown trigger -> dropped
      },
      volumes: {
        'enemy-slash': 5, // out of range -> clamped to max
        'unknown-cue': 0.5 // unknown cue -> dropped
      }
    });

    expect(config.bindings['enemy-defeat']).toBe('player-defeat');
    expect(config.bindings.jump).toBe('jump');
    expect(config.bindings).not.toHaveProperty('totally-unknown-trigger');
    expect(config.volumes['enemy-slash']).toBe(SFX_VOLUME_LIMITS.max);
    expect(config.volumes).not.toHaveProperty('unknown-cue');
  });

  it('clamps NaN / out-of-range stored volumes', () => {
    const config = normalizeSfxBindingsConfig({
      volumes: { 'enemy-defeat': Number.NaN, 'lane-dash': -3 }
    });

    expect(config.volumes['enemy-defeat']).toBe(SFX_VOLUME_LIMITS.min);
    expect(config.volumes['lane-dash']).toBe(SFX_VOLUME_LIMITS.min);
  });

  it('recognizes valid trigger ids', () => {
    expect(isSfxTriggerId('hit')).toBe(true);
    expect(isSfxTriggerId('enemy-defeat')).toBe(true);
    expect(isSfxTriggerId('player-defeat')).toBe(false); // a cue, not a trigger
    expect(isSfxTriggerId('nope')).toBe(false);
  });

  it('keeps public multiplayer hit and defeat cues at safe levels', () => {
    const rawConfig = JSON.parse(
      readFileSync(
        new URL('../public/assets/config/sfx-bindings.json', import.meta.url),
        'utf8'
      )
    ) as unknown;
    const config = normalizeSfxBindingsConfig(rawConfig);

    expect(config.bindings.hit).toBe('hit');
    expect(config.bindings['enemy-defeat']).toBe('hit');
    expect(config.volumes.hit).toBeLessThanOrEqual(0.1);
    expect(config.volumes['enemy-defeat']).toBeLessThanOrEqual(0.25);

    for (const volume of Object.values(config.volumes)) {
      expect(volume).toBeLessThanOrEqual(SFX_VOLUME_LIMITS.max);
    }
  });
});
