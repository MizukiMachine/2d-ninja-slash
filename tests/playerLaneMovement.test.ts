import { describe, expect, it } from 'vitest';
import {
  PlayerLaneMovementController,
  createDefaultThreeLaneYSettings,
  createThreeLaneLayout,
  createThreeLaneLayoutFromYSettings,
  getThreeLaneSpawnPoint,
  getThreeLaneSpawnPlacement,
  normalizeThreeLaneYSettings
} from '../src/game/playerLaneMovement';

const layout = createThreeLaneLayout({ middleY: 200, spacing: 50 });

function createController(): PlayerLaneMovementController {
  return new PlayerLaneMovementController({
    layout,
    initialLaneId: 'middle',
    doubleTapSeconds: 0.3,
    transitionSeconds: 0.2,
    jumpArcHeight: 16
  });
}

function updateController(
  controller: PlayerLaneMovementController,
  deltaSeconds = 1 / 60,
  input: { readonly left?: boolean; readonly right?: boolean } = {}
) {
  return controller.update({
    left: input.left ?? false,
    right: input.right ?? false,
    speed: 240,
    deltaSeconds
  });
}

function finishTransition(controller: PlayerLaneMovementController) {
  return updateController(controller, 0.2);
}

describe('player lane movement', () => {
  it('moves horizontally on the current lane', () => {
    const controller = createController();

    const frame = updateController(controller, 1 / 60, { right: true });

    expect(frame.velocityX).toBe(240);
    expect(frame.velocityY).toBe(0);
    expect(frame.y).toBe(200);
    expect(frame.depthY).toBe(200);
    expect(frame.action).toBe('run');
    expect(controller.currentLaneId).toBe('middle');
  });

  it('does not change lanes for a single vertical tap', () => {
    const controller = createController();

    expect(controller.tapLane('up', 1)).toBe(false);
    const frame = updateController(controller);

    expect(frame.isTransitioning).toBe(false);
    expect(frame.y).toBe(200);
    expect(controller.currentLaneId).toBe('middle');
  });

  it('moves one lane up for a vertical double tap', () => {
    const controller = createController();

    expect(controller.tapLane('up', 1)).toBe(false);
    expect(controller.tapLane('up', 1.2)).toBe(true);

    const jumpingFrame = updateController(controller, 0.1);
    expect(jumpingFrame.action).toBe('jump');
    expect(jumpingFrame.isTransitioning).toBe(true);
    expect(jumpingFrame.y).toBe(159);
    expect(jumpingFrame.depthY).toBe(175);
    expect(controller.targetLaneId).toBe('upper');

    const landedFrame = finishTransition(controller);
    expect(landedFrame.completedTransition).toBe(true);
    expect(landedFrame.y).toBe(150);
    expect(controller.currentLaneId).toBe('upper');
  });

  it('moves one lane down for a vertical double tap', () => {
    const controller = createController();

    expect(controller.tapLane('down', 2)).toBe(false);
    expect(controller.tapLane('down', 2.22)).toBe(true);

    const landedFrame = finishTransition(controller);

    expect(landedFrame.completedTransition).toBe(true);
    expect(landedFrame.y).toBe(250);
    expect(controller.currentLaneId).toBe('lower');
  });

  it('does not move above the upper lane', () => {
    const controller = createController();

    controller.tapLane('up', 1);
    controller.tapLane('up', 1.1);
    finishTransition(controller);

    expect(controller.currentLaneId).toBe('upper');
    expect(controller.tapLane('up', 2)).toBe(false);
    expect(controller.tapLane('up', 2.1)).toBe(false);

    const frame = updateController(controller);
    expect(frame.y).toBe(150);
    expect(controller.currentLaneId).toBe('upper');
  });

  it('does not move below the lower lane', () => {
    const controller = createController();

    controller.tapLane('down', 1);
    controller.tapLane('down', 1.1);
    finishTransition(controller);

    expect(controller.currentLaneId).toBe('lower');
    expect(controller.tapLane('down', 2)).toBe(false);
    expect(controller.tapLane('down', 2.1)).toBe(false);

    const frame = updateController(controller);
    expect(frame.y).toBe(250);
    expect(controller.currentLaneId).toBe('lower');
  });

  it('ignores additional lane taps while a lane jump is active', () => {
    const controller = createController();

    controller.tapLane('up', 1);
    expect(controller.tapLane('up', 1.1)).toBe(true);

    const jumpingFrame = updateController(controller, 0.05, { left: true });
    expect(jumpingFrame.action).toBe('jump');
    expect(jumpingFrame.velocityX).toBe(0);
    expect(controller.tapLane('down', 1.15)).toBe(false);
    expect(controller.tapLane('down', 1.2)).toBe(false);

    finishTransition(controller);
    expect(controller.currentLaneId).toBe('upper');
    expect(controller.targetLaneId).toBe('upper');
  });

  it('can jump one lane toward a target lane without double tap input', () => {
    const controller = createController();

    expect(controller.requestLaneStepToward('upper')).toBe(true);
    expect(controller.targetLaneId).toBe('upper');

    const jumpingFrame = updateController(controller, 0.1);
    expect(jumpingFrame.action).toBe('jump');
    expect(jumpingFrame.isTransitioning).toBe(true);

    const landedFrame = finishTransition(controller);
    expect(landedFrame.completedTransition).toBe(true);
    expect(controller.currentLaneId).toBe('upper');
  });

  it('moves toward non-adjacent target lanes one lane at a time', () => {
    const controller = new PlayerLaneMovementController({
      layout,
      initialLaneId: 'lower',
      doubleTapSeconds: 0.3,
      transitionSeconds: 0.2,
      jumpArcHeight: 16
    });

    expect(controller.requestLaneStepToward('upper')).toBe(true);
    expect(controller.targetLaneId).toBe('middle');
    finishTransition(controller);
    expect(controller.currentLaneId).toBe('middle');

    expect(controller.requestLaneStepToward('upper')).toBe(true);
    finishTransition(controller);
    expect(controller.currentLaneId).toBe('upper');
  });

  it('does not start a target lane jump while already on target or transitioning', () => {
    const controller = createController();

    expect(controller.requestLaneStepToward('middle')).toBe(false);
    expect(controller.requestLaneStepToward('lower')).toBe(true);
    expect(controller.requestLaneStepToward('upper')).toBe(false);
  });
});

describe('three lane spawning', () => {
  it('fills the left/right edge of each lane for the first six spawns', () => {
    const spawns = Array.from({ length: 6 }, (_, index) =>
      getThreeLaneSpawnPoint({
        index,
        worldWidth: 1280,
        edgeInset: 150
      })
    );

    expect(spawns.map((spawn) => spawn.laneId)).toEqual([
      'middle',
      'upper',
      'lower',
      'middle',
      'upper',
      'lower'
    ]);
    // Alternating right edge (1130) / left edge (150) — one slot per lane side.
    expect(spawns.map((spawn) => spawn.x)).toEqual([
      1130,
      150,
      1130,
      150,
      1130,
      150
    ]);
  });

  it('scatters overflow spawns across the interior once the edges are full', () => {
    const overflow = Array.from({ length: 4 }, (_, offset) =>
      getThreeLaneSpawnPoint({
        index: 6 + offset,
        worldWidth: 1280,
        edgeInset: 150
      })
    );

    expect(overflow.map((spawn) => spawn.laneId)).toEqual([
      'middle',
      'upper',
      'lower',
      'middle'
    ]);
    // Centre-out bisection: centre (640), then quarter points (395, 885), then
    // an eighth (272.5) — each overflow spawn lands in the largest gap.
    expect(overflow.map((spawn) => spawn.x)).toEqual([640, 395, 885, 272.5]);
  });
});

describe('three lane y settings', () => {
  it('generates the default three lane y positions', () => {
    expect(createDefaultThreeLaneYSettings({ worldHeight: 720 })).toEqual({
      upperY: 372,
      middleY: 468,
      lowerY: 564
    });
  });

  it('builds the fixed three lane layout from debug y settings', () => {
    const settings = normalizeThreeLaneYSettings(
      {
        upperY: 320,
        middleY: 455,
        lowerY: 610
      },
      { worldHeight: 720 }
    );
    const adjustedLayout = createThreeLaneLayoutFromYSettings(settings);

    expect(adjustedLayout.lanes).toEqual([
      { id: 'upper', y: 320 },
      { id: 'middle', y: 455 },
      { id: 'lower', y: 610 }
    ]);
  });

  it('normalizes invalid lane y settings inside the stage with fixed ordering', () => {
    expect(
      normalizeThreeLaneYSettings(
        {
          upperY: Number.NaN,
          middleY: 999,
          lowerY: -50
        },
        { worldHeight: 720 }
      )
    ).toEqual({
      upperY: 372,
      middleY: 624,
      lowerY: 648
    });
  });

  it('uses adjusted lane y settings for enemy spawn placement', () => {
    const adjustedLayout = createThreeLaneLayoutFromYSettings({
      upperY: 310,
      middleY: 455,
      lowerY: 620
    });

    expect(
      getThreeLaneSpawnPlacement({
        index: 0,
        worldWidth: 1280,
        edgeInset: 150,
        layout: adjustedLayout
      })
    ).toEqual({
      laneId: 'middle',
      x: 1130,
      y: 455
    });
    expect(
      getThreeLaneSpawnPlacement({
        index: 1,
        worldWidth: 1280,
        edgeInset: 150,
        layout: adjustedLayout
      })
    ).toEqual({
      laneId: 'upper',
      x: 150,
      y: 310
    });
  });

  it('updates current player and enemy lane y values when the layout changes', () => {
    const controller = createController();

    controller.setLayout(
      createThreeLaneLayoutFromYSettings({
        upperY: 330,
        middleY: 470,
        lowerY: 615
      })
    );

    expect(controller.currentY).toBe(470);
    expect(controller.requestLaneStepToward('lower')).toBe(true);
    expect(finishTransition(controller).y).toBe(615);

    controller.setLayout(
      createThreeLaneLayoutFromYSettings({
        upperY: 300,
        middleY: 430,
        lowerY: 590
      })
    );

    expect(controller.currentY).toBe(590);
  });

  it('keeps an active lane transition continuous when adjusted lane y settings change', () => {
    const controller = createController();

    expect(controller.requestLaneStepToward('lower')).toBe(true);
    const beforeLayoutChange = updateController(controller, 0.1).y;

    controller.setLayout(
      createThreeLaneLayoutFromYSettings({
        upperY: 330,
        middleY: 470,
        lowerY: 615
      })
    );

    expect(controller.currentY).toBeCloseTo(beforeLayoutChange, 5);
    expect(finishTransition(controller).y).toBe(615);
    expect(controller.currentLaneId).toBe('lower');
  });
});
