export interface AnimationFallbackDelayInput {
  readonly durationMs: number;
  readonly localTimeScale?: number;
  readonly globalTimeScale?: number;
  readonly bufferMs?: number;
}

const MIN_EFFECTIVE_TIME_SCALE = 0.01;

export const getAnimationFallbackDelayMs = ({
  durationMs,
  localTimeScale = 1,
  globalTimeScale = 1,
  bufferMs = 0
}: AnimationFallbackDelayInput): number => {
  const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 0;
  const safeBufferMs = Number.isFinite(bufferMs) && bufferMs > 0 ? bufferMs : 0;
  const rawTimeScale = localTimeScale * globalTimeScale;
  const safeTimeScale =
    Number.isFinite(rawTimeScale) && rawTimeScale > 0
      ? Math.max(rawTimeScale, MIN_EFFECTIVE_TIME_SCALE)
      : MIN_EFFECTIVE_TIME_SCALE;

  return Math.ceil(safeDurationMs / safeTimeScale + safeBufferMs);
};
