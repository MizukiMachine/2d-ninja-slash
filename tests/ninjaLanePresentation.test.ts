import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  setNinjaLaneAnchor
} from '../src/game/ninjaBounds';
import {
  getNinjaLaneAnchorOffset,
  getNinjaLaneYFromSprite,
  getNinjaSpriteYForLane,
  getNinjaVisualBaselineOffset
} from '../src/game/ninjaLanePresentation';

describe('ninja lane presentation', () => {
  it('converts lane baseline y to sprite anchor y using the lane anchor', () => {
    const config = setNinjaLaneAnchor(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'mainNinja',
      'right',
      'idle',
      { x: 73, y: 110 }
    );

    expect(
      getNinjaLaneAnchorOffset({
        boundsConfig: config,
        actorId: 'mainNinja',
        direction: 'right',
        actionId: 'idle',
        scale: 2
      })
    ).toBe(36);
    expect(
      getNinjaVisualBaselineOffset({
        boundsConfig: config,
        actorId: 'mainNinja',
        direction: 'right',
        actionId: 'idle',
        scale: 2
      })
    ).toBe(36);
    expect(
      getNinjaSpriteYForLane({
        boundsConfig: config,
        actorId: 'mainNinja',
        direction: 'right',
        actionId: 'idle',
        scale: 2,
        laneY: 450
      })
    ).toBe(486);
  });

  it('recovers lane baseline y from sprite anchor y', () => {
    const config = setNinjaLaneAnchor(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'enemyNinja',
      'left',
      'idle',
      { x: 56, y: 118 }
    );

    const spriteY = getNinjaSpriteYForLane({
      boundsConfig: config,
      actorId: 'enemyNinja',
      direction: 'left',
      actionId: 'idle',
      scale: 1.5,
      laneY: 530
    });

    expect(spriteY).toBe(545);
    expect(
      getNinjaLaneYFromSprite({
        boundsConfig: config,
        actorId: 'enemyNinja',
        direction: 'left',
        actionId: 'idle',
        scale: 1.5,
        spriteY
      })
    ).toBe(530);
  });
});
