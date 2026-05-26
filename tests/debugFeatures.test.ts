import { describe, expect, it } from 'vitest';
import {
  DEBUG_LEVELS,
  createDefaultDebugElementsConfig,
  getDebugLevelElements,
  getEditableDebugLevel,
  normalizeDebugElementsConfig,
  normalizeRunnerSettings,
  setDebugLevelElements
} from '../src/game/debugFeatures';

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
});
