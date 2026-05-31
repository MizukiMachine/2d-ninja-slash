import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  FACING_DIRECTIONS,
  NINJA_ANIMATION_ASSETS,
  NINJA_ACTORS,
  applyNinjaLaneAnchorToAllActions,
  buildNinjaBoundsExport,
  getDefaultNinjaActionId,
  getNinjaAction,
  getNinjaAnimationBounds,
  getNinjaAnimationPlaybackRate,
  getNinjaLaneAnchor,
  getOppositeFacingDirection,
  isNinjaHitFrameActive,
  mirrorNinjaLaneAnchorHorizontally,
  mirrorNinjaRectHorizontally,
  normalizeNinjaBoundsConfig,
  resetNinjaAnimationConfig,
  setNinjaAnimationBounds,
  setNinjaLaneAnchor,
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
          const anchor = getNinjaLaneAnchor(config, actor.id, direction, action.id);

          expect(bounds.collision.width).toBeGreaterThan(0);
          expect(bounds.collision.height).toBeGreaterThan(0);
          expect(anchor.x).toBeGreaterThanOrEqual(0);
          expect(anchor.y).toBeGreaterThanOrEqual(0);
          expect(getNinjaAnimationPlaybackRate(config, actor.id, action.id)).toBe(1);
        }
      }
    }
  });

  it('falls back to runtime-safe default animation selections', () => {
    expect(getDefaultNinjaActionId('mainNinja')).toBe('idle');
    expect(getDefaultNinjaActionId('mainNinja2p')).toBe('idle');
    expect(getDefaultNinjaActionId('enemyNinja')).toBe('idle');
    expect(getNinjaAction('mainNinja', 'missing').id).toBe('idle');
    expect(getNinjaAction('mainNinja2p', 'missing').id).toBe('idle');
  });

  it('does not expose crouching as a main ninja variant action', () => {
    const mainNinjaVariants = NINJA_ACTORS.filter((actor) =>
      actor.id === 'mainNinja' || actor.id === 'mainNinja2p'
    );

    expect(mainNinjaVariants).toHaveLength(2);

    for (const actor of mainNinjaVariants) {
      expect(actor.actions.map((action) => action.id)).not.toContain('crouching');
    }
  });

  it('uses main ninja defaults for the 2P color variant', () => {
    for (const direction of FACING_DIRECTIONS) {
      for (const action of getNinjaActionIds('mainNinja')) {
        expect(
          getNinjaAnimationBounds(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja2p', direction, action)
        ).toEqual(
          getNinjaAnimationBounds(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja', direction, action)
        );
        expect(
          getNinjaLaneAnchor(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja2p', direction, action)
        ).toEqual(
          getNinjaLaneAnchor(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja', direction, action)
        );
        expect(getNinjaAnimationPlaybackRate(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja2p', action))
          .toBe(getNinjaAnimationPlaybackRate(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja', action));
      }
    }

    expect(isNinjaHitFrameActive(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja2p', 'right', 'slash', 13))
      .toBe(true);
    expect(isNinjaHitFrameActive(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja2p', 'right', 'attack', 13))
      .toBe(true);
  });

  it('registers main ninja 2P animation assets from the 2P color folder', () => {
    const asset = NINJA_ANIMATION_ASSETS.find((candidate) =>
      candidate.actorId === 'mainNinja2p' &&
      candidate.direction === 'right' &&
      candidate.actionId === 'idle'
    );

    expect(asset).toMatchObject({
      textureKey: 'character.mainNinja2p.right.idle.spritesheet',
      animationKey: 'anim.mainNinja2p.right.idle',
      url: '/assets/actors/main-ninja-2p/idle-right.png'
    });
  });

  it('inherits saved main ninja config for the 2P color variant when absent', () => {
    const slashHitFrames = Array.from({ length: 32 }, (_value, index) => index === 9);
    const config = normalizeNinjaBoundsConfig({
      boundsByActor: {
        mainNinja: {
          right: {
            idle: {
              visual: { x: 49, y: 37, width: 34, height: 48 },
              collision: { x: 47, y: 47, width: 38, height: 45 },
              attack: { x: 80, y: 59, width: 35, height: 12 }
            }
          }
        }
      },
      hitFramesByActor: {
        mainNinja: {
          right: {
            slash: { attack: slashHitFrames }
          }
        }
      },
      playbackRatesByActor: {
        mainNinja: {
          run: 1.5
        }
      },
      laneAnchorsByActor: {
        mainNinja: {
          right: {
            idle: { x: 63, y: 91 }
          }
        }
      }
    });

    expect(getNinjaAnimationBounds(config, 'mainNinja2p', 'right', 'idle')).toEqual(
      getNinjaAnimationBounds(config, 'mainNinja', 'right', 'idle')
    );
    expect(getNinjaLaneAnchor(config, 'mainNinja2p', 'right', 'idle')).toEqual({
      x: 63,
      y: 91
    });
    expect(getNinjaAnimationPlaybackRate(config, 'mainNinja2p', 'run')).toBe(1.5);
    expect(isNinjaHitFrameActive(config, 'mainNinja2p', 'right', 'slash', 9))
      .toBe(true);
  });

  it('clamps edited bounds to the 128px source frame', () => {
    const config = setNinjaAnimationBounds(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'mainNinja',
      'right',
      'slash',
      'attack',
      { x: 250, y: -20, width: 99, height: 999 }
    );
    const bounds = getNinjaAnimationBounds(config, 'mainNinja', 'right', 'slash');

    expect(bounds.attack).toEqual({ x: 127, y: 0, width: 1, height: 128 });
  });

  it('mirrors bounds horizontally for the opposite facing direction', () => {
    expect(getOppositeFacingDirection('right')).toBe('left');
    expect(getOppositeFacingDirection('left')).toBe('right');
    expect(mirrorNinjaRectHorizontally({ x: 24, y: 40, width: 50, height: 70 })).toEqual({
      x: 54,
      y: 40,
      width: 50,
      height: 70
    });
  });

  it('stores lane anchors separately from bounds', () => {
    const config = setNinjaLaneAnchor(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'mainNinja',
      'right',
      'idle',
      { x: 74, y: 118 }
    );

    expect(getNinjaLaneAnchor(config, 'mainNinja', 'right', 'idle')).toEqual({
      x: 74,
      y: 118
    });
    expect(getNinjaLaneAnchor(config, 'mainNinja', 'left', 'idle')).not.toEqual({
      x: 74,
      y: 118
    });
    expect(getNinjaAnimationBounds(config, 'mainNinja', 'right', 'idle')).toEqual(
      getNinjaAnimationBounds(DEFAULT_NINJA_BOUNDS_CONFIG, 'mainNinja', 'right', 'idle')
    );
  });

  it('clamps and mirrors lane anchors within the source frame', () => {
    const config = setNinjaLaneAnchor(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'enemyNinja',
      'left',
      'run',
      { x: -20, y: 999 }
    );

    expect(getNinjaLaneAnchor(config, 'enemyNinja', 'left', 'run')).toEqual({
      x: 0,
      y: 127
    });
    expect(mirrorNinjaLaneAnchorHorizontally({ x: 24, y: 110 })).toEqual({
      x: 103,
      y: 110
    });
  });

  it('applies a lane anchor to every animation for the selected actor direction', () => {
    const config = applyNinjaLaneAnchorToAllActions(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'mainNinja',
      'right',
      { x: 70, y: 116 }
    );

    for (const action of NINJA_ACTORS.find((actor) => actor.id === 'mainNinja')?.actions ?? []) {
      expect(getNinjaLaneAnchor(config, 'mainNinja', 'right', action.id)).toEqual({
        x: 70,
        y: 116
      });
    }
    expect(getNinjaLaneAnchor(config, 'mainNinja', 'left', 'idle')).not.toEqual({
      x: 70,
      y: 116
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
      version: 3,
      boundsByActor: expect.any(Object),
      hitFramesByActor: expect.any(Object),
      playbackRatesByActor: expect.any(Object),
      laneAnchorsByActor: expect.any(Object)
    });
  });
});

function getNinjaActionIds(actorId: string): readonly string[] {
  return (
    NINJA_ACTORS.find((actor) => actor.id === actorId)?.actions.map((action) => action.id) ??
    []
  );
}
