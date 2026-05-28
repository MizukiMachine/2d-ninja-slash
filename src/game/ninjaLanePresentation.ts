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

export interface NinjaWorldPoint {
  readonly x: number;
  readonly y: number;
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
