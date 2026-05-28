import { describe, expect, it } from 'vitest';
import {
  getEnemyApproachDirection,
  getEnemyChaseMovementSpeed,
  getEnemyPatrolMovementSpeed,
  resolveEnemyPatrolState
} from '../src/game/enemyBehavior';

describe('enemy behavior', () => {
  it('approaches a player on the same lane in front of the enemy', () => {
    expect(
      getEnemyApproachDirection({
        enemyLaneId: 'middle',
        playerLaneId: 'middle',
        playerIsTransitioning: false,
        enemyLaneX: 300,
        playerLaneX: 560,
        enemyFacingDirection: 'right',
        detectionDistance: 320
      })
    ).toBe(1);

    expect(
      getEnemyApproachDirection({
        enemyLaneId: 'upper',
        playerLaneId: 'upper',
        playerIsTransitioning: false,
        enemyLaneX: 520,
        playerLaneX: 260,
        enemyFacingDirection: 'left',
        detectionDistance: 320
      })
    ).toBe(-1);
  });

  it('ignores players outside the lane, behind the enemy, transitioning, or out of range', () => {
    const baseInput = {
      enemyLaneId: 'middle' as const,
      playerLaneId: 'middle' as const,
      playerIsTransitioning: false,
      enemyLaneX: 300,
      playerLaneX: 560,
      enemyFacingDirection: 'right' as const,
      detectionDistance: 320
    };

    expect(getEnemyApproachDirection({ ...baseInput, playerLaneId: 'upper' })).toBeNull();
    expect(getEnemyApproachDirection({ ...baseInput, playerLaneX: 120 })).toBeNull();
    expect(getEnemyApproachDirection({ ...baseInput, playerIsTransitioning: true })).toBeNull();
    expect(getEnemyApproachDirection({ ...baseInput, playerLaneX: 621 })).toBeNull();
  });

  it('turns patrol back at world limits', () => {
    const nextDecision = (time: number): number => time + 1000;

    expect(
      resolveEnemyPatrolState({
        enemyLaneX: 80,
        patrolDirection: -1,
        time: 500,
        nextDecisionAt: 2000,
        leftLimit: 90,
        rightLimit: 1190,
        choosePatrolDirection: () => 1,
        chooseNextDecisionAt: nextDecision
      })
    ).toEqual({ patrolDirection: 1, nextDecisionAt: 1500 });

    expect(
      resolveEnemyPatrolState({
        enemyLaneX: 1200,
        patrolDirection: 1,
        time: 500,
        nextDecisionAt: 2000,
        leftLimit: 90,
        rightLimit: 1190,
        choosePatrolDirection: () => -1,
        chooseNextDecisionAt: nextDecision
      })
    ).toEqual({ patrolDirection: -1, nextDecisionAt: 1500 });
  });

  it('keeps patrolling until the next random decision time', () => {
    expect(
      resolveEnemyPatrolState({
        enemyLaneX: 400,
        patrolDirection: 1,
        time: 500,
        nextDecisionAt: 2000,
        leftLimit: 90,
        rightLimit: 1190,
        choosePatrolDirection: () => -1,
        chooseNextDecisionAt: (time) => time + 1000
      })
    ).toEqual({ patrolDirection: 1, nextDecisionAt: 2000 });
  });

  it('chooses a new patrol direction after the decision time', () => {
    expect(
      resolveEnemyPatrolState({
        enemyLaneX: 400,
        patrolDirection: 1,
        time: 2100,
        nextDecisionAt: 2000,
        leftLimit: 90,
        rightLimit: 1190,
        choosePatrolDirection: () => -1,
        chooseNextDecisionAt: (time) => time + 1000
      })
    ).toEqual({ patrolDirection: -1, nextDecisionAt: 3100 });
  });

  it('keeps wandering much slower than chase movement', () => {
    expect(getEnemyPatrolMovementSpeed(200)).toBe(70);
    expect(getEnemyChaseMovementSpeed(200)).toBe(180);
  });
});
