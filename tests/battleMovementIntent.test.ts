import { describe, expect, it } from 'vitest';
import {
  createIdleMovementIntent,
  createMovementIntent,
  getBufferedMovementDirection,
  MOVEMENT_INPUT_GRACE_MS
} from '../server/rooms/BattleRoom';

describe('battle movement intent', () => {
  it('uses the current non-zero movement direction immediately', () => {
    const intent = createMovementIntent({ right: true }, createIdleMovementIntent(), 1000);

    expect(getBufferedMovementDirection(intent, 1000)).toBe(1);
    expect(intent.activeUntilMs).toBe(1000 + MOVEMENT_INPUT_GRACE_MS);
  });

  it('keeps the last movement direction through a short neutral input drop', () => {
    const running = createMovementIntent({ right: true }, createIdleMovementIntent(), 1000);
    const dropped = createMovementIntent({ left: false, right: false }, running, 1040);

    expect(getBufferedMovementDirection(dropped, 1040)).toBe(1);
    expect(getBufferedMovementDirection(dropped, 1000 + MOVEMENT_INPUT_GRACE_MS + 1)).toBe(0);
  });

  it('treats explicit opposing inputs as neutral instead of buffered movement', () => {
    const running = createMovementIntent({ left: true }, createIdleMovementIntent(), 1000);
    const opposing = createMovementIntent({ left: true, right: true }, running, 1040);

    expect(getBufferedMovementDirection(opposing, 1040)).toBe(0);
  });
});
