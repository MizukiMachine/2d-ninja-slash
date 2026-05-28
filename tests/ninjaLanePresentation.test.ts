import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  setNinjaLaneAnchor
} from '../src/game/ninjaBounds';
import {
  getNinjaLaneAnchorOffsetX,
  getNinjaLaneAnchorOffset,
  getNinjaLanePerspectiveScaleForLane,
  getNinjaLanePerspectiveScaleForY,
  getNinjaLanePointFromSprite,
  getNinjaLaneXFromSprite,
  getNinjaLaneYFromSprite,
  getNinjaSpritePositionForLane,
  getNinjaSpriteXForLane,
  getNinjaSpriteYForLane,
  getNinjaVisualBaselineOffset
} from '../src/game/ninjaLanePresentation';
import { createThreeLaneLayout } from '../src/game/playerLaneMovement';

describe('ninja lane presentation', () => {
  it('scales actors by lane depth', () => {
    expect(
      getNinjaLanePerspectiveScaleForLane({
        laneId: 'upper',
        baseScale: 2.1
      })
    ).toBeCloseTo(1.785, 5);
    expect(
      getNinjaLanePerspectiveScaleForLane({
        laneId: 'middle',
        baseScale: 2.1
      })
    ).toBe(2.1);
    expect(
      getNinjaLanePerspectiveScaleForLane({
        laneId: 'lower',
        baseScale: 2.1
      })
    ).toBeCloseTo(2.415, 5);
  });

  it('interpolates actor scale while moving between lanes', () => {
    const layout = createThreeLaneLayout({ middleY: 200, spacing: 50 });

    expect(
      getNinjaLanePerspectiveScaleForY({
        layout,
        laneY: 175,
        baseScale: 2
      })
    ).toBeCloseTo(1.85, 5);
    expect(
      getNinjaLanePerspectiveScaleForY({
        layout,
        laneY: 225,
        baseScale: 2
      })
    ).toBeCloseTo(2.15, 5);
  });

  it('converts lane anchor point to sprite position using the lane anchor', () => {
    const config = setNinjaLaneAnchor(
      DEFAULT_NINJA_BOUNDS_CONFIG,
      'mainNinja',
      'right',
      'idle',
      { x: 73, y: 110 }
    );

    expect(
      getNinjaLaneAnchorOffsetX({
        boundsConfig: config,
        actorId: 'mainNinja',
        direction: 'right',
        actionId: 'idle',
        scale: 2
      })
    ).toBe(-18);
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
    expect(
      getNinjaSpriteXForLane({
        boundsConfig: config,
        actorId: 'mainNinja',
        direction: 'right',
        actionId: 'idle',
        scale: 2,
        laneX: 320
      })
    ).toBe(302);
    expect(
      getNinjaSpritePositionForLane({
        boundsConfig: config,
        actorId: 'mainNinja',
        direction: 'right',
        actionId: 'idle',
        scale: 2,
        laneX: 320,
        laneY: 450
      })
    ).toEqual({ x: 302, y: 486 });
  });

  it('recovers lane anchor point from sprite position', () => {
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
      getNinjaLaneXFromSprite({
        boundsConfig: config,
        actorId: 'enemyNinja',
        direction: 'left',
        actionId: 'idle',
        scale: 1.5,
        spriteX: 512
      })
    ).toBe(500);
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
    expect(
      getNinjaLanePointFromSprite({
        boundsConfig: config,
        actorId: 'enemyNinja',
        direction: 'left',
        actionId: 'idle',
        scale: 1.5,
        spriteX: 512,
        spriteY
      })
    ).toEqual({ x: 500, y: 530 });
  });
});
