import type { PlayerLaneId } from './playerLaneMovement';

export type EnemyFacingDirection = 'left' | 'right';
export type EnemyPatrolDirection = -1 | 1;

export const ENEMY_PATROL_SPEED_RATIO = 0.35;
export const ENEMY_CHASE_SPEED_RATIO = 0.9;

export interface EnemyApproachDirectionInput {
  readonly enemyLaneId: PlayerLaneId;
  readonly playerLaneId: PlayerLaneId | null;
  readonly playerIsTransitioning: boolean;
  readonly enemyLaneX: number;
  readonly playerLaneX: number;
  readonly enemyFacingDirection: EnemyFacingDirection;
  readonly detectionDistance: number;
}

export interface ResolveEnemyPatrolStateInput {
  readonly enemyLaneX: number;
  readonly patrolDirection: EnemyPatrolDirection;
  readonly time: number;
  readonly nextDecisionAt: number;
  readonly leftLimit: number;
  readonly rightLimit: number;
  readonly choosePatrolDirection: () => EnemyPatrolDirection;
  readonly chooseNextDecisionAt: (time: number) => number;
}

export interface EnemyPatrolState {
  readonly patrolDirection: EnemyPatrolDirection;
  readonly nextDecisionAt: number;
}

export function getEnemyApproachDirection({
  enemyLaneId,
  playerLaneId,
  playerIsTransitioning,
  enemyLaneX,
  playerLaneX,
  enemyFacingDirection,
  detectionDistance
}: EnemyApproachDirectionInput): EnemyPatrolDirection | null {
  if (playerLaneId === null || playerIsTransitioning || enemyLaneId !== playerLaneId) {
    return null;
  }

  const toPlayerX = playerLaneX - enemyLaneX;
  const distanceToPlayerX = Math.abs(toPlayerX);

  if (distanceToPlayerX <= 0 || distanceToPlayerX > detectionDistance) {
    return null;
  }

  const approachDirection = toPlayerX < 0 ? -1 : 1;

  return approachDirection === getEnemyPatrolDirectionFromFacing(enemyFacingDirection)
    ? approachDirection
    : null;
}

export function resolveEnemyPatrolState({
  enemyLaneX,
  patrolDirection,
  time,
  nextDecisionAt,
  leftLimit,
  rightLimit,
  choosePatrolDirection,
  chooseNextDecisionAt
}: ResolveEnemyPatrolStateInput): EnemyPatrolState {
  if (enemyLaneX <= leftLimit && patrolDirection < 0) {
    return {
      patrolDirection: 1,
      nextDecisionAt: chooseNextDecisionAt(time)
    };
  }

  if (enemyLaneX >= rightLimit && patrolDirection > 0) {
    return {
      patrolDirection: -1,
      nextDecisionAt: chooseNextDecisionAt(time)
    };
  }

  if (time >= nextDecisionAt) {
    return {
      patrolDirection: choosePatrolDirection(),
      nextDecisionAt: chooseNextDecisionAt(time)
    };
  }

  return { patrolDirection, nextDecisionAt };
}

export function getEnemyFacingDirectionFromPatrol(
  direction: EnemyPatrolDirection
): EnemyFacingDirection {
  return direction < 0 ? 'left' : 'right';
}

export function getEnemyPatrolDirectionFromFacing(
  direction: EnemyFacingDirection
): EnemyPatrolDirection {
  return direction === 'left' ? -1 : 1;
}

export function getEnemyPatrolMovementSpeed(baseSpeed: number): number {
  return getScaledEnemyMovementSpeed(baseSpeed, ENEMY_PATROL_SPEED_RATIO);
}

export function getEnemyChaseMovementSpeed(baseSpeed: number): number {
  return getScaledEnemyMovementSpeed(baseSpeed, ENEMY_CHASE_SPEED_RATIO);
}

function getScaledEnemyMovementSpeed(baseSpeed: number, ratio: number): number {
  return Math.max(0, baseSpeed) * ratio;
}
