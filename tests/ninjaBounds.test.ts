import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  FACING_DIRECTIONS,
  NINJA_ACTORS,
  buildNinjaBoundsExport,
  getDefaultNinjaActionId,
  getNinjaAction,
  getNinjaAnimationBounds,
  getOppositeFacingDirection,
  isNinjaHitFrameActive,
  mirrorNinjaRectHorizontally,
  normalizeNinjaBoundsConfig,
  setNinjaAnimationBounds,
  setNinjaHitFrame
} from '../src/game/ninjaBounds';

describe('ninja bounds config', () => {
  it('normalizes sparse configs to every actor, direction, and animation', () => {
    const config = normalizeNinjaBoundsConfig({});

    for (const actor of NINJA_ACTORS) {
      for (const direction of FACING_DIRECTIONS) {
        for (const action of actor.actions) {
          const bounds = getNinjaAnimationBounds(config, actor.id, direction, action.id);

          expect(bounds.collision.width).toBeGreaterThan(0);
          expect(bounds.collision.height).toBeGreaterThan(0);
        }
      }
    }
  });

  it('falls back to runtime-safe default animation selections', () => {
    expect(getDefaultNinjaActionId('mainNinja')).toBe('idle');
    expect(getDefaultNinjaActionId('enemyNinja')).toBe('idle');
    expect(getNinjaAction('mainNinja', 'missing').id).toBe('idle');
  });

  it('clamps edited bounds to the 256px source frame', () => {
    const config = setNinjaAnimationBounds(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'mainNinja',
      'right',
      'slash',
      'attack',
      { x: 250, y: -20, width: 99, height: 999 }
    );
    const bounds = getNinjaAnimationBounds(config, 'mainNinja', 'right', 'slash');

    expect(bounds.attack).toEqual({ x: 250, y: 0, width: 6, height: 256 });
  });

  it('mirrors bounds horizontally for the opposite facing direction', () => {
    expect(getOppositeFacingDirection('right')).toBe('left');
    expect(getOppositeFacingDirection('left')).toBe('right');
    expect(mirrorNinjaRectHorizontally({ x: 24, y: 40, width: 50, height: 70 })).toEqual({
      x: 182,
      y: 40,
      width: 50,
      height: 70
    });
  });

  it('stores attack hit frames per actor animation', () => {
    const config = setNinjaHitFrame(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'enemyNinja',
      'left',
      'slash',
      5,
      true
    );

    expect(isNinjaHitFrameActive(config, 'enemyNinja', 'left', 'slash', 5)).toBe(true);
    expect(isNinjaHitFrameActive(config, 'enemyNinja', 'right', 'slash', 5)).toBe(false);
  });

  it('exports a versioned payload', () => {
    expect(buildNinjaBoundsExport(DEFAULT_NINJA_BOUNDS_CONFIG)).toMatchObject({
      version: 1,
      boundsByActor: expect.any(Object),
      hitFramesByActor: expect.any(Object)
    });
  });
});
