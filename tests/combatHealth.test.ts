import { describe, expect, it } from 'vitest';
import {
  applyAttackDamage,
  ATTACK_DAMAGE,
  canPlayerReceiveEnemyAttack,
  ENEMY_MAX_HEALTH,
  getHealthBand,
  getHealthRatio,
  PLAYER_MAX_HEALTH
} from '../src/game/combatHealth';

describe('combat health', () => {
  it('uses the requested health and damage values', () => {
    expect(PLAYER_MAX_HEALTH).toBe(5);
    expect(ENEMY_MAX_HEALTH).toBe(1);
    expect(ATTACK_DAMAGE).toBe(1);
  });

  it('applies exactly one attack damage and never drops below zero', () => {
    expect(applyAttackDamage(PLAYER_MAX_HEALTH)).toBe(4);
    expect(applyAttackDamage(ENEMY_MAX_HEALTH)).toBe(0);
    expect(applyAttackDamage(0)).toBe(0);
  });

  it('prevents enemy attacks from hitting while the player is jumping', () => {
    expect(canPlayerReceiveEnemyAttack('idle')).toBe(true);
    expect(canPlayerReceiveEnemyAttack('run')).toBe(true);
    expect(canPlayerReceiveEnemyAttack('slash')).toBe(true);
    expect(canPlayerReceiveEnemyAttack('hurt')).toBe(true);
    expect(canPlayerReceiveEnemyAttack('jump')).toBe(false);
    expect(canPlayerReceiveEnemyAttack('dead')).toBe(false);
  });

  it('classifies player health into green, yellow, and critical bands', () => {
    expect(getHealthBand(5, PLAYER_MAX_HEALTH)).toBe('healthy');
    expect(getHealthBand(3, PLAYER_MAX_HEALTH)).toBe('healthy');
    expect(getHealthBand(2, PLAYER_MAX_HEALTH)).toBe('warning');
    expect(getHealthBand(1, PLAYER_MAX_HEALTH)).toBe('critical');
    expect(getHealthBand(0, PLAYER_MAX_HEALTH)).toBe('critical');
  });

  it('clamps health ratios for bar rendering', () => {
    expect(getHealthRatio(8, PLAYER_MAX_HEALTH)).toBe(1);
    expect(getHealthRatio(-2, PLAYER_MAX_HEALTH)).toBe(0);
    expect(getHealthRatio(1, 0)).toBe(0);
  });
});
