import {
  NINJA_FRAME_SIZE,
  getNinjaLaneAnchor,
  type NinjaActorId,
  type NinjaBoundsConfig
} from './ninjaBounds';

export interface NinjaLanePresentationInput {
  readonly boundsConfig: NinjaBoundsConfig;
  readonly actorId: NinjaActorId;
  readonly direction: string;
  readonly actionId: string;
  readonly scale: number;
}

export interface NinjaSpriteYForLaneInput extends NinjaLanePresentationInput {
  readonly laneY: number;
}

export interface NinjaLaneYFromSpriteInput extends NinjaLanePresentationInput {
  readonly spriteY: number;
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

export function getNinjaSpriteYForLane({
  laneY,
  ...input
}: NinjaSpriteYForLaneInput): number {
  return laneY + getNinjaLaneAnchorOffset(input);
}

export function getNinjaLaneYFromSprite({
  spriteY,
  ...input
}: NinjaLaneYFromSpriteInput): number {
  return spriteY - getNinjaLaneAnchorOffset(input);
}
