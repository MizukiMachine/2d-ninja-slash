import { describe, expect, it } from 'vitest';
import {
  DEBUG_LEVELS,
  buildSandboxLaneSettingsExport,
  createDefaultDebugElementsConfig,
  createDefaultSandboxLaneSettingsConfig,
  createDefaultSandboxLaneSettings,
  getEnemyMovementSpeed,
  getDebugLevelElements,
  getEditableDebugLevel,
  getSandboxLaneSettingsForProfile,
  loadSandboxLaneSettings,
  normalizeDebugElementsConfig,
  normalizeSandboxLaneSettingsConfig,
  normalizeRunnerSettings,
  resetSandboxLaneSettings,
  saveSandboxLaneSettings,
  setSandboxLaneSettingsForProfile,
  setDebugLevelElements
} from '../src/game/debugFeatures';

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();

  get length(): number {
    return this.values.size;
  }

  clear(): void {
    this.values.clear();
  }

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  key(index: number): string | null {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe('debug feature config', () => {
  it('keeps legacy element exports compatible with per-level config', () => {
    const config = normalizeDebugElementsConfig({
      elements: [
        {
          id: 'legacy-goal',
          kind: 'goal',
          label: 'Legacy Goal',
          x: 120,
          y: 420,
          width: 74,
          height: 96
        }
      ]
    });

    expect(config.levels).toHaveLength(DEBUG_LEVELS.length);
    expect(getDebugLevelElements(config, DEBUG_LEVELS[0].id)[0]).toMatchObject({
      id: 'legacy-goal',
      kind: 'goal'
    });
    expect(getDebugLevelElements(config, DEBUG_LEVELS[1].id)[0].id).toBe(
      DEBUG_LEVELS[1].elements[0].id
    );
  });

  it('updates only the selected editable level', () => {
    const config = createDefaultDebugElementsConfig();
    const editedElement = {
      ...DEBUG_LEVELS[1].elements[0],
      id: 'edited-roof-platform',
      x: 320
    };
    const nextConfig = setDebugLevelElements(config, DEBUG_LEVELS[1].id, [editedElement]);

    expect(getEditableDebugLevel(DEBUG_LEVELS[1].id, nextConfig).elements).toEqual([
      editedElement
    ]);
    expect(getEditableDebugLevel(DEBUG_LEVELS[0].id, nextConfig).elements).toHaveLength(
      DEBUG_LEVELS[0].elements.length
    );
  });

  it('normalizes runner seed and lane count as integers', () => {
    expect(
      normalizeRunnerSettings({
        seed: 7.8,
        laneCount: 2.2
      })
    ).toMatchObject({
      seed: 8,
      laneCount: 2
    });
  });

  it('keeps effective enemy movement slower than the player', () => {
    expect(
      getEnemyMovementSpeed({
        playerSpeed: 260,
        enemySpeed: 260,
        enemyRecoveryMs: 900,
        playerKnockbackSpeed: 360,
        roundEnemyBaseCount: 1,
        roundEnemyIncrease: 1,
        roundEnemyMaxCount: 9,
        roundEnemyGrowthMode: 'fibonacci',
        roundIntermissionMs: 1200
      })
    ).toBe(208);
  });

  it('persists sandbox lane y settings per profile', () => {
    const storage = new MemoryStorage();
    const saved = saveSandboxLaneSettings(
      'landscape',
      {
        upperY: 320,
        middleY: 455,
        lowerY: 610
      },
      720,
      storage
    );

    expect(saved).toEqual({
      upperY: 320,
      middleY: 455,
      lowerY: 610
    });
    expect(loadSandboxLaneSettings('landscape', 720, storage)).toEqual(saved);
    expect(loadSandboxLaneSettings('portrait', 1280, storage)).toEqual(
      createDefaultSandboxLaneSettings(1280)
    );

    expect(resetSandboxLaneSettings('landscape', 720, storage)).toEqual(
      createDefaultSandboxLaneSettings(720)
    );
  });

  it('normalizes sandbox lane settings config per profile', () => {
    const config = normalizeSandboxLaneSettingsConfig({
      savedAt: '2026-05-29T00:00:00.000Z',
      profiles: {
        landscape: {
          upperY: 320,
          middleY: 455,
          lowerY: 610
        },
        portrait: {
          upperY: 620,
          middleY: 760,
          lowerY: 920
        }
      }
    });

    expect(config).toEqual({
      version: 1,
      savedAt: '2026-05-29T00:00:00.000Z',
      profiles: {
        landscape: {
          upperY: 320,
          middleY: 455,
          lowerY: 610
        },
        portrait: {
          upperY: 620,
          middleY: 760,
          lowerY: 920
        }
      }
    });
  });

  it('patches and exports sandbox lane settings config', () => {
    const config = setSandboxLaneSettingsForProfile(
      createDefaultSandboxLaneSettingsConfig(),
      'landscape',
      {
        upperY: 330,
        middleY: 470,
        lowerY: 620
      },
      720
    );
    const exported = buildSandboxLaneSettingsExport(config);

    expect(getSandboxLaneSettingsForProfile(config, 'landscape', 720)).toEqual({
      upperY: 330,
      middleY: 470,
      lowerY: 620
    });
    expect(getSandboxLaneSettingsForProfile(config, 'portrait', 1280)).toEqual(
      createDefaultSandboxLaneSettings(1280)
    );
    expect(exported.version).toBe(1);
    expect(Date.parse(exported.savedAt ?? '')).not.toBeNaN();
  });
});
