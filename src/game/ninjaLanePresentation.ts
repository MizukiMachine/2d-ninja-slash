import {
  NINJA_FRAME_SIZE,
  getNinjaLaneAnchor,
  type NinjaActorId,
  type NinjaBoundsConfig
} from './ninjaBounds';
import type { PlayerLaneId, ThreeLaneLayout } from './playerLaneMovement';

export type NinjaLaneScaleMultipliers = Readonly<Record<PlayerLaneId, number>>;

export const DEFAULT_NINJA_LANE_SCALE_MULTIPLIERS: NinjaLaneScaleMultipliers = {
  upper: 1.0,
  middle: 1.2,
  lower: 1.4
};

export type NinjaLaneSpeedMultipliers = Readonly<Record<PlayerLaneId, number>>;

// Perspective-based movement speed: the near (lower) lane reads as moving
// faster and the far (upper) lane slower, mirroring the depth illusion the
// lane scale multipliers create. Centered on the middle lane (x1.0) so the
// configured player/enemy speeds are preserved on the middle lane.
export const DEFAULT_NINJA_LANE_SPEED_MULTIPLIERS: NinjaLaneSpeedMultipliers = {
  upper: 0.7,
  middle: 1.0,
  lower: 1.3
};

export interface NinjaLanePresentationInput {
  readonly boundsConfig: NinjaBoundsConfig;
  readonly actorId: NinjaActorId;
  readonly direction: string;
  readonly actionId: string;
  readonly scale: number;
}

export interface NinjaLanePerspectiveScaleForLaneInput {
  readonly laneId: PlayerLaneId;
  readonly baseScale: number;
  readonly scaleMultipliers?: NinjaLaneScaleMultipliers;
}

export interface NinjaLanePerspectiveSpeedForLaneInput {
  readonly laneId: PlayerLaneId;
  readonly baseSpeed: number;
  readonly speedMultipliers?: NinjaLaneSpeedMultipliers;
}

export interface NinjaLanePerspectiveScaleForYInput {
  readonly layout: ThreeLaneLayout;
  readonly laneY: number;
  readonly baseScale: number;
  readonly scaleMultipliers?: NinjaLaneScaleMultipliers;
}

export interface NinjaSpriteYForLaneInput extends NinjaLanePresentationInput {
  readonly laneY: number;
}

export interface NinjaSpriteXForLaneInput extends NinjaLanePresentationInput {
  readonly laneX: number;
}

export interface NinjaSpritePositionForLaneInput extends NinjaLanePresentationInput {
  readonly laneX: number;
  readonly laneY: number;
}

export interface NinjaLaneYFromSpriteInput extends NinjaLanePresentationInput {
  readonly spriteY: number;
}

export interface NinjaLaneXFromSpriteInput extends NinjaLanePresentationInput {
  readonly spriteX: number;
}

export interface NinjaLanePointFromSpriteInput extends NinjaLanePresentationInput {
  readonly spriteX: number;
  readonly spriteY: number;
}

export interface InterpolatedNinjaLanePresentationFrameInput
  extends Omit<NinjaLanePresentationInput, 'scale'> {
  readonly layout: ThreeLaneLayout;
  readonly baseScale: number;
  readonly currentLaneX: number;
  readonly currentLaneY: number;
  readonly targetLaneX: number;
  readonly targetLaneY: number;
  readonly alpha: number;
  readonly scaleMultipliers?: NinjaLaneScaleMultipliers;
}

export interface NinjaWorldPoint {
  readonly x: number;
  readonly y: number;
}

export interface NinjaLanePresentationFrame {
  readonly laneX: number;
  readonly laneY: number;
  readonly scale: number;
  readonly spriteX: number;
  readonly spriteY: number;
}

export function getNinjaLaneAnchorOffsetX({
  boundsConfig,
  actorId,
  direction,
  actionId,
  scale
}: NinjaLanePresentationInput): number {
  const laneAnchor = getNinjaLaneAnchor(
    boundsConfig,
    actorId,
    direction,
    actionId
  );

  return (NINJA_FRAME_SIZE / 2 - laneAnchor.x) * Math.abs(scale);
}

export function getNinjaLaneAnchorOffset({
  boundsConfig,
  actorId,
  direction,
  actionId,
  scale
}: NinjaLanePresentationInput): number {
  const laneAnchor = getNinjaLaneAnchor(
    boundsConfig,
    actorId,
    direction,
    actionId
  );

  return Math.max(0, NINJA_FRAME_SIZE - laneAnchor.y) * Math.abs(scale);
}

export function getNinjaVisualBaselineOffset(
  input: NinjaLanePresentationInput
): number {
  return getNinjaLaneAnchorOffset(input);
}

export function getNinjaLanePerspectiveScaleForLane({
  laneId,
  baseScale,
  scaleMultipliers = DEFAULT_NINJA_LANE_SCALE_MULTIPLIERS
}: NinjaLanePerspectiveScaleForLaneInput): number {
  return getSafeBaseScale(baseScale) * scaleMultipliers[laneId];
}

export function getNinjaLanePerspectiveSpeedForLane({
  laneId,
  baseSpeed,
  speedMultipliers = DEFAULT_NINJA_LANE_SPEED_MULTIPLIERS
}: NinjaLanePerspectiveSpeedForLaneInput): number {
  return getSafeBaseScale(baseSpeed) * speedMultipliers[laneId];
}

export function getNinjaLanePerspectiveScaleForY({
  layout,
  laneY,
  baseScale,
  scaleMultipliers = DEFAULT_NINJA_LANE_SCALE_MULTIPLIERS
}: NinjaLanePerspectiveScaleForYInput): number {
  const safeBaseScale = getSafeBaseScale(baseScale);
  const [upperLane, middleLane, lowerLane] = layout.lanes;
  const y = Number.isFinite(laneY) ? laneY : middleLane.y;

  if (y <= upperLane.y) {
    return safeBaseScale * scaleMultipliers.upper;
  }

  if (y >= lowerLane.y) {
    return safeBaseScale * scaleMultipliers.lower;
  }

  if (y <= middleLane.y) {
    return safeBaseScale * interpolateNumber(
      scaleMultipliers.upper,
      scaleMultipliers.middle,
      getSegmentProgress(upperLane.y, middleLane.y, y)
    );
  }

  return safeBaseScale * interpolateNumber(
    scaleMultipliers.middle,
    scaleMultipliers.lower,
    getSegmentProgress(middleLane.y, lowerLane.y, y)
  );
}

export function getNinjaSpriteYForLane({
  laneY,
  ...input
}: NinjaSpriteYForLaneInput): number {
  return laneY + getNinjaLaneAnchorOffset(input);
}

export function getNinjaSpriteXForLane({
  laneX,
  ...input
}: NinjaSpriteXForLaneInput): number {
  return laneX + getNinjaLaneAnchorOffsetX(input);
}

export function getNinjaSpritePositionForLane({
  laneX,
  laneY,
  ...input
}: NinjaSpritePositionForLaneInput): NinjaWorldPoint {
  return {
    x: getNinjaSpriteXForLane({ ...input, laneX }),
    y: getNinjaSpriteYForLane({ ...input, laneY })
  };
}

export function getNinjaLaneYFromSprite({
  spriteY,
  ...input
}: NinjaLaneYFromSpriteInput): number {
  return spriteY - getNinjaLaneAnchorOffset(input);
}

export function getNinjaLaneXFromSprite({
  spriteX,
  ...input
}: NinjaLaneXFromSpriteInput): number {
  return spriteX - getNinjaLaneAnchorOffsetX(input);
}

export function getNinjaLanePointFromSprite({
  spriteX,
  spriteY,
  ...input
}: NinjaLanePointFromSpriteInput): NinjaWorldPoint {
  return {
    x: getNinjaLaneXFromSprite({ ...input, spriteX }),
    y: getNinjaLaneYFromSprite({ ...input, spriteY })
  };
}

export function getInterpolatedNinjaLanePresentationFrame({
  layout,
  baseScale,
  currentLaneX,
  currentLaneY,
  targetLaneX,
  targetLaneY,
  alpha,
  scaleMultipliers,
  ...input
}: InterpolatedNinjaLanePresentationFrameInput): NinjaLanePresentationFrame {
  const progress = clampUnit(alpha);
  const laneX = interpolateNumber(currentLaneX, targetLaneX, progress);
  const laneY = interpolateNumber(currentLaneY, targetLaneY, progress);
  const scale = getNinjaLanePerspectiveScaleForY({
    layout,
    laneY,
    baseScale,
    scaleMultipliers
  });
  const spritePosition = getNinjaSpritePositionForLane({
    ...input,
    scale,
    laneX,
    laneY
  });

  return {
    laneX,
    laneY,
    scale,
    spriteX: spritePosition.x,
    spriteY: spritePosition.y
  };
}

function getSafeBaseScale(baseScale: number): number {
  return Number.isFinite(baseScale) ? baseScale : 1;
}

function clampUnit(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(1, Math.max(0, value));
}

function getSegmentProgress(start: number, end: number, value: number): number {
  const span = end - start;

  if (span <= 0) {
    return 0;
  }

  return Math.min(1, Math.max(0, (value - start) / span));
}

function interpolateNumber(start: number, end: number, progress: number): number {
  return start + (end - start) * progress;
}
