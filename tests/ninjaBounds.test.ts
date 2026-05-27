import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  FACING_DIRECTIONS,
  NINJA_ACTORS,
  buildNinjaBoundsExport,
  getDefaultNinjaActionId,
  getNinjaAction,
  getNinjaAnimationBounds,
  getNinjaAnimationPlaybackRate,
  getOppositeFacingDirection,
  isNinjaHitFrameActive,
  mirrorNinjaRectHorizontally,
  normalizeNinjaBoundsConfig,
  resetNinjaAnimationConfig,
  setNinjaAnimationBounds,
  setNinjaAnimationPlaybackRate,
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
          expect(getNinjaAnimationPlaybackRate(config, actor.id, action.id)).toBe(1);
        }
      }
    }
  });

  it('falls back to runtime-safe default animation selections', () => {
    expect(getDefaultNinjaActionId('mainNinja')).toBe('idle');
    expect(getDefaultNinjaActionId('enemyNinja')).toBe('idle');
    expect(getNinjaAction('mainNinja', 'missing').id).toBe('idle');
  });

  it('does not expose crouching as a main ninja action', () => {
    const mainNinja = NINJA_ACTORS.find((actor) => actor.id === 'mainNinja');

    expect(mainNinja?.actions.map((action) => action.id)).not.toContain('crouching');
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

  it('stores playback rates per actor action', () => {
    const config = setNinjaAnimationPlaybackRate(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'mainNinja',
      'run',
      1.45
    );

    expect(getNinjaAnimationPlaybackRate(config, 'mainNinja', 'run')).toBe(1.45);
    expect(getNinjaAnimationPlaybackRate(config, 'mainNinja', 'idle')).toBe(1);
    expect(getNinjaAnimationPlaybackRate(config, 'enemyNinja', 'run')).toBe(1);
  });

  it('normalizes playback rates from saved configs', () => {
    const config = normalizeNinjaBoundsConfig({
      playbackRatesByActor: {
        mainNinja: {
          idle: 9,
          run: 0.1,
          slash: 1.333
        }
      }
    });

    expect(getNinjaAnimationPlaybackRate(config, 'mainNinja', 'idle')).toBe(2);
    expect(getNinjaAnimationPlaybackRate(config, 'mainNinja', 'run')).toBe(0.25);
    expect(getNinjaAnimationPlaybackRate(config, 'mainNinja', 'slash')).toBe(1.33);
  });

  it('resets playback rate with the selected animation config', () => {
    const config = resetNinjaAnimationConfig(
      setNinjaAnimationPlaybackRate(
        DEFAULT_NINJA_BOUNDS_CONFIG,
        'mainNinja',
        'slash',
        1.75
      ),
      'mainNinja',
      'right',
      'slash'
    );

    expect(getNinjaAnimationPlaybackRate(config, 'mainNinja', 'slash')).toBe(1);
  });

  it('exports a versioned payload', () => {
    expect(buildNinjaBoundsExport(DEFAULT_NINJA_BOUNDS_CONFIG)).toMatchObject({
      version: 2,
      boundsByActor: expect.any(Object),
      hitFramesByActor: expect.any(Object),
      playbackRatesByActor: expect.any(Object)
    });
  });
});
