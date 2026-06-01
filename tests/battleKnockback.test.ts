import { describe, expect, it } from 'vitest';
import {
  BATTLE_DAMAGE_KNOCKBACK_DISTANCE,
  resolveBattleDamageKnockbackX
} from '../server/rooms/BattleRoom';
import { PLAYER_DAMAGE_KNOCKBACK_DISTANCE } from '../src/game/playerDamageFeedback';

describe('battle knockback', () => {
  it('uses the same damage knockback distance as single player feedback', () => {
    expect(BATTLE_DAMAGE_KNOCKBACK_DISTANCE).toBe(PLAYER_DAMAGE_KNOCKBACK_DISTANCE);
  });

  it('pushes the target away from the attacker on the X axis', () => {
    expect(
      resolveBattleDamageKnockbackX({
        attackerX: 300,
        targetX: 420,
        attackerFacing: 'right'
      })
    ).toBe(420 + BATTLE_DAMAGE_KNOCKBACK_DISTANCE);
    expect(
      resolveBattleDamageKnockbackX({
        attackerX: 700,
        targetX: 520,
        attackerFacing: 'left'
      })
    ).toBe(520 - BATTLE_DAMAGE_KNOCKBACK_DISTANCE);
  });

  it('falls back to attacker facing when both actors overlap', () => {
    expect(
      resolveBattleDamageKnockbackX({
        attackerX: 500,
        targetX: 500,
        attackerFacing: 'right'
      })
    ).toBe(500 + BATTLE_DAMAGE_KNOCKBACK_DISTANCE);
    expect(
      resolveBattleDamageKnockbackX({
        attackerX: 500,
        targetX: 500,
        attackerFacing: 'left'
      })
    ).toBe(500 - BATTLE_DAMAGE_KNOCKBACK_DISTANCE);
  });

  it('clamps knockback inside the arena bounds', () => {
    expect(
      resolveBattleDamageKnockbackX({
        attackerX: 20,
        targetX: 90,
        attackerFacing: 'right',
        minX: 58,
        maxX: 200
      })
    ).toBe(200);
    expect(
      resolveBattleDamageKnockbackX({
        attackerX: 220,
        targetX: 90,
        attackerFacing: 'left',
        minX: 58,
        maxX: 200
      })
    ).toBe(58);
  });
});
