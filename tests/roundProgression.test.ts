import { describe, expect, it } from 'vitest';
import {
  DEFAULT_GAMEPLAY_TUNING,
  getRoundEnemyCount,
  normalizeGameplayTuning
} from '../src/game/debugFeatures';

describe('round progression tuning', () => {
  it('uses fibonacci growth for the default playable ramp', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((round) => getRoundEnemyCount(DEFAULT_GAMEPLAY_TUNING, round))).toEqual([
      1,
      2,
      2,
      3,
      4,
      6,
      9,
      9
    ]);
  });

  it('increases enemy count linearly and respects the configured cap', () => {
    const tuning = normalizeGameplayTuning({
      ...DEFAULT_GAMEPLAY_TUNING,
      roundEnemyBaseCount: 2,
      roundEnemyIncrease: 2,
      roundEnemyMaxCount: 7,
      roundEnemyGrowthMode: 'linear'
    });

    expect([1, 2, 3, 4, 5].map((round) => getRoundEnemyCount(tuning, round))).toEqual([
      2,
      4,
      6,
      7,
      7
    ]);
  });

  it('can use fibonacci growth for a softer early ramp', () => {
    const tuning = normalizeGameplayTuning({
      ...DEFAULT_GAMEPLAY_TUNING,
      roundEnemyBaseCount: 2,
      roundEnemyIncrease: 1,
      roundEnemyMaxCount: 12,
      roundEnemyGrowthMode: 'fibonacci'
    });

    expect([1, 2, 3, 4, 5, 6, 7].map((round) => getRoundEnemyCount(tuning, round))).toEqual([
      2,
      3,
      3,
      4,
      5,
      7,
      10
    ]);
  });
});
