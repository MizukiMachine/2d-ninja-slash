import { describe, expect, it } from 'vitest';
import { getAnimationFallbackDelayMs } from '../src/game/animationTiming';

describe('animation timing', () => {
  it('includes a buffer after the animation duration', () => {
    expect(getAnimationFallbackDelayMs({ durationMs: 1000, bufferMs: 250 })).toBe(1250);
  });

  it('accounts for local and global animation time scales', () => {
    expect(
      getAnimationFallbackDelayMs({
        durationMs: 1000,
        localTimeScale: 0.5,
        globalTimeScale: 1,
        bufferMs: 250
      })
    ).toBe(2250);
    expect(
      getAnimationFallbackDelayMs({
        durationMs: 1000,
        localTimeScale: 2,
        globalTimeScale: 0.5,
        bufferMs: 250
      })
    ).toBe(1250);
  });

  it('does not schedule early for paused or invalid animation scales', () => {
    expect(
      getAnimationFallbackDelayMs({
        durationMs: 1000,
        localTimeScale: 0,
        bufferMs: 250
      })
    ).toBe(100250);
  });
});
