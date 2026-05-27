import type Phaser from 'phaser';

export const NINJA_FRAME_SIZE = 256;
export const NINJA_FRAME_COUNT = 32;
export const NINJA_CENTER = {
  x: NINJA_FRAME_SIZE / 2,
  y: NINJA_FRAME_SIZE / 2
} as const;

export const DEFAULT_NINJA_COLLISION_RECT = {
  x: 95,
  y: 163,
  width: 67,
  height: 74
} as const satisfies NinjaRect;

export const NINJA_BOUNDS_CONFIG_URL = '/assets/config/ninja-bounds.json';
export const NINJA_BOUNDS_SAVE_ENDPOINT = '/__debug/ninja-bounds';

export type FacingDirection = 'left' | 'right';
export type NinjaActorId = 'mainNinja' | 'enemyNinja';
export type NinjaBoundsKind = 'visual' | 'collision' | 'attack';
export type NinjaHitFrameKind = 'attack';

export interface NinjaRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export function areNinjaRectsEqual(left: NinjaRect, right: NinjaRect): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

export function getOppositeFacingDirection(direction: string | undefined): FacingDirection {
  return normalizeFacingDirection(direction) === 'right' ? 'left' : 'right';
}

export function mirrorNinjaRectHorizontally(rect: NinjaRect): NinjaRect {
  const width = clampInteger(rect.width, 1, NINJA_FRAME_SIZE, 1);
  const height = clampInteger(rect.height, 1, NINJA_FRAME_SIZE, 1);
  const x = clampInteger(rect.x, 0, NINJA_FRAME_SIZE - width, 0);
  const y = clampInteger(rect.y, 0, NINJA_FRAME_SIZE - height, 0);

  return {
    x: NINJA_FRAME_SIZE - x - width,
    y,
    width,
    height
  };
}

export interface NinjaAnimationBounds {
  readonly visual: NinjaRect;
  readonly collision: NinjaRect;
  readonly attack: NinjaRect;
}

export interface NinjaAnimationHitFrames {
  readonly attack: readonly boolean[];
}

export type NinjaActorBoundsMap = Record<
  FacingDirection,
  Record<string, NinjaAnimationBounds>
>;
export type NinjaActorHitFramesMap = Record<
  FacingDirection,
  Record<string, NinjaAnimationHitFrames>
>;
export type NinjaBoundsByActor = Record<NinjaActorId, NinjaActorBoundsMap>;
export type NinjaHitFramesByActor = Record<NinjaActorId, NinjaActorHitFramesMap>;

export interface NinjaBoundsConfig {
  readonly boundsByActor: NinjaBoundsByActor;
  readonly hitFramesByActor: NinjaHitFramesByActor;
}

export interface NinjaBoundsExport extends NinjaBoundsConfig {
  readonly version: number;
  readonly savedAt: string;
}

export interface NinjaActorDefinition {
  readonly id: NinjaActorId;
  readonly label: string;
  readonly folder: string;
  readonly defaultActionId: string;
  readonly actions: readonly NinjaActionDefinition[];
}

export interface NinjaActionDefinition {
  readonly id: string;
  readonly label: string;
  readonly frameCount: number;
  readonly frameRate: number;
  readonly repeat: number;
}

export interface NinjaAnimationAsset {
  readonly actorId: NinjaActorId;
  readonly actorLabel: string;
  readonly actionId: string;
  readonly label: string;
  readonly direction: FacingDirection;
  readonly textureKey: string;
  readonly animationKey: string;
  readonly url: string;
  readonly frameCount: number;
  readonly frameRate: number;
  readonly repeat: number;
}

export interface NinjaGymBridge {
  readonly active: boolean;
  readonly selectedActorId: NinjaActorId;
  readonly selectedDirection: FacingDirection;
  readonly selectedActionId: string;
  readonly selectedBoundsKind: NinjaBoundsKind;
  readonly showVisualBounds: boolean;
  readonly showCollisionBounds: boolean;
  readonly showAttackBounds: boolean;
  readonly playbackRate: number;
  readonly boundsConfig: NinjaBoundsConfig;
  readonly currentFrame: number;
  readonly zoom: number;
  readonly updateBounds?: (
    actorId: NinjaActorId,
    direction: FacingDirection,
    actionId: string,
    boundsKind: NinjaBoundsKind,
    rect: NinjaRect
  ) => void;
}

declare global {
  var __NINJA_SLASH_GYM__: NinjaGymBridge | undefined;
}

const PLAYBACK_RATE_MULTIPLIER = 3;

const MAIN_NINJA_ACTIONS: readonly NinjaActionDefinition[] = [
  action('attack', 'Attack (preview only)', 12 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('crouching', 'Crouching', 8 * PLAYBACK_RATE_MULTIPLIER, -1),
  action('death', 'Death', 10 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('idle', 'Idle', 8 * PLAYBACK_RATE_MULTIPLIER, -1),
  action('impact', 'Impact', 16 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('jump', 'Jump', 14 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('run', 'Run', 12 * PLAYBACK_RATE_MULTIPLIER, -1),
  action('slash', 'Slash 1', 12 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('walk', 'Walk', 10 * PLAYBACK_RATE_MULTIPLIER, -1)
];

const ENEMY_NINJA_ACTIONS: readonly NinjaActionDefinition[] = [
  action('crouching', 'Crouching', 8 * PLAYBACK_RATE_MULTIPLIER, -1),
  action('death', 'Death', 10 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('idle', 'Idle', 8 * PLAYBACK_RATE_MULTIPLIER, -1),
  action('jump', 'Jump', 14 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('run', 'Run', 12 * PLAYBACK_RATE_MULTIPLIER, -1),
  action('slash', 'Slash', 12 * PLAYBACK_RATE_MULTIPLIER, 0),
  action('walk', 'Walk', 10 * PLAYBACK_RATE_MULTIPLIER, -1)
];

export const NINJA_ACTORS: readonly NinjaActorDefinition[] = [
  {
    id: 'mainNinja',
    label: 'Main Ninja',
    folder: 'main-ninja',
    defaultActionId: 'idle',
    actions: MAIN_NINJA_ACTIONS
  },
  {
    id: 'enemyNinja',
    label: 'Enemy Ninja',
    folder: 'enemy-ninja',
    defaultActionId: 'idle',
    actions: ENEMY_NINJA_ACTIONS
  }
] as const;

export const FACING_DIRECTIONS = ['left', 'right'] as const satisfies readonly FacingDirection[];

export const NINJA_ANIMATION_ASSETS: readonly NinjaAnimationAsset[] =
  NINJA_ACTORS.flatMap((actorDefinition) =>
    FACING_DIRECTIONS.flatMap((direction) =>
      actorDefinition.actions.map((actionDefinition) => ({
        actorId: actorDefinition.id,
        actorLabel: actorDefinition.label,
        actionId: actionDefinition.id,
        label: `${actorDefinition.label} ${direction} ${actionDefinition.label}`,
        direction,
        textureKey: getNinjaTextureKey(
          actorDefinition.id,
          direction,
          actionDefinition.id
        ),
        animationKey: getNinjaAnimationKey(
          actorDefinition.id,
          direction,
          actionDefinition.id
        ),
        url: getNinjaSpriteSheetUrl(actorDefinition.id, direction, actionDefinition.id),
        frameCount: actionDefinition.frameCount,
        frameRate: actionDefinition.frameRate,
        repeat: actionDefinition.repeat
      }))
    )
  );

export const DEFAULT_NINJA_BOUNDS_CONFIG = createDefaultNinjaBoundsConfig();

function action(
  id: string,
  label: string,
  frameRate: number,
  repeat: number
): NinjaActionDefinition {
  return {
    id,
    label,
    frameCount: NINJA_FRAME_COUNT,
    frameRate,
    repeat
  };
}

export function getNinjaActor(actorId: string | undefined): NinjaActorDefinition {
  return NINJA_ACTORS.find((actorDefinition) => actorDefinition.id === actorId) ?? NINJA_ACTORS[0];
}

export function normalizeNinjaActorId(actorId: string | undefined): NinjaActorId {
  return getNinjaActor(actorId).id;
}

export function normalizeFacingDirection(direction: string | undefined): FacingDirection {
  return direction === 'left' || direction === 'right' ? direction : 'right';
}

export function getNinjaAnimationsForActor(actorId: string | undefined): readonly NinjaActionDefinition[] {
  return getNinjaActor(actorId).actions;
}

export function getDefaultNinjaActionId(actorId: string | undefined): string {
  const actor = getNinjaActor(actorId);

  return actor.actions.some((actionDefinition) => actionDefinition.id === actor.defaultActionId)
    ? actor.defaultActionId
    : actor.actions[0].id;
}

export function getNinjaAction(
  actorId: string | undefined,
  actionId: string | undefined
): NinjaActionDefinition {
  const actor = getNinjaActor(actorId);
  const actions = actor.actions;

  return (
    actions.find((actionDefinition) => actionDefinition.id === actionId) ??
    actions.find((actionDefinition) => actionDefinition.id === actor.defaultActionId) ??
    actions[0]
  );
}

export function normalizeNinjaActionId(
  actorId: string | undefined,
  actionId: string | undefined
): string {
  return getNinjaAction(actorId, actionId).id;
}

export function normalizeNinjaBoundsKind(value: string | undefined): NinjaBoundsKind {
  return value === 'visual' || value === 'collision' || value === 'attack'
    ? value
    : 'collision';
}

export function getNinjaTextureKey(
  actorId: NinjaActorId,
  direction: FacingDirection,
  actionId: string
): string {
  return `character.${actorId}.${direction}.${actionId}.spritesheet`;
}

export function getNinjaAnimationKey(
  actorId: NinjaActorId,
  direction: FacingDirection,
  actionId: string
): string {
  return `anim.${actorId}.${direction}.${actionId}`;
}

export function getNinjaSpriteSheetUrl(
  actorId: NinjaActorId,
  direction: FacingDirection,
  actionId: string
): string {
  const actor = getNinjaActor(actorId);

  return `/assets/actors/${actor.folder}/${actionId}-${direction}.png`;
}

export function preloadNinjaAnimationAssets(
  scene: Phaser.Scene,
  assets: readonly NinjaAnimationAsset[] = NINJA_ANIMATION_ASSETS
): void {
  for (const asset of assets) {
    if (scene.textures.exists(asset.textureKey)) {
      continue;
    }

    scene.load.spritesheet(asset.textureKey, asset.url, {
      frameWidth: NINJA_FRAME_SIZE,
      frameHeight: NINJA_FRAME_SIZE,
      margin: 0,
      spacing: 0,
      startFrame: 0,
      endFrame: asset.frameCount - 1
    });
  }
}

export function registerNinjaAnimations(
  scene: Phaser.Scene,
  assets: readonly NinjaAnimationAsset[] = NINJA_ANIMATION_ASSETS
): void {
  for (const asset of assets) {
    if (scene.anims.exists(asset.animationKey)) {
      continue;
    }

    scene.anims.create({
      key: asset.animationKey,
      frames: scene.anims.generateFrameNumbers(asset.textureKey, {
        start: 0,
        end: asset.frameCount - 1
      }),
      frameRate: asset.frameRate,
      repeat: asset.repeat
    });
  }
}

export function normalizeNinjaBoundsConfig(config: unknown): NinjaBoundsConfig {
  const defaults = createDefaultNinjaBoundsConfig();

  if (!config || typeof config !== 'object') {
    return defaults;
  }

  const candidate = config as Partial<NinjaBoundsConfig>;

  return {
    boundsByActor: normalizeBoundsByActor(candidate.boundsByActor, defaults.boundsByActor),
    hitFramesByActor: normalizeHitFramesByActor(
      candidate.hitFramesByActor,
      defaults.hitFramesByActor
    )
  };
}

export function cloneNinjaBoundsConfig(config: NinjaBoundsConfig): NinjaBoundsConfig {
  return normalizeNinjaBoundsConfig(config);
}

export function buildNinjaBoundsExport(config: NinjaBoundsConfig): NinjaBoundsExport {
  const normalized = normalizeNinjaBoundsConfig(config);

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    boundsByActor: normalized.boundsByActor,
    hitFramesByActor: normalized.hitFramesByActor
  };
}

export function getNinjaAnimationBounds(
  config: NinjaBoundsConfig,
  actorId: string,
  direction: string,
  actionId: string
): NinjaAnimationBounds {
  const normalizedActorId = normalizeNinjaActorId(actorId);
  const normalizedDirection = normalizeFacingDirection(direction);
  const normalizedActionId = normalizeNinjaActionId(normalizedActorId, actionId);

  return (
    config.boundsByActor[normalizedActorId]?.[normalizedDirection]?.[
      normalizedActionId
    ] ??
    DEFAULT_NINJA_BOUNDS_CONFIG.boundsByActor[normalizedActorId][normalizedDirection][
      normalizedActionId
    ]
  );
}

export function isNinjaHitFrameActive(
  config: NinjaBoundsConfig,
  actorId: string,
  direction: string,
  actionId: string,
  frameIndex: number
): boolean {
  const normalizedActorId = normalizeNinjaActorId(actorId);
  const normalizedDirection = normalizeFacingDirection(direction);
  const normalizedActionId = normalizeNinjaActionId(normalizedActorId, actionId);
  const hitFrames =
    config.hitFramesByActor[normalizedActorId]?.[normalizedDirection]?.[
      normalizedActionId
    ]?.attack ??
    DEFAULT_NINJA_BOUNDS_CONFIG.hitFramesByActor[normalizedActorId][
      normalizedDirection
    ][normalizedActionId].attack;

  return hitFrames[frameIndex] === true;
}

export function setNinjaAnimationBounds(
  config: NinjaBoundsConfig,
  actorId: string,
  direction: string,
  actionId: string,
  boundsKind: string,
  rect: NinjaRect
): NinjaBoundsConfig {
  const next = cloneNinjaBoundsConfig(config);
  const normalizedActorId = normalizeNinjaActorId(actorId);
  const normalizedDirection = normalizeFacingDirection(direction);
  const normalizedActionId = normalizeNinjaActionId(normalizedActorId, actionId);
  const normalizedBoundsKind = normalizeNinjaBoundsKind(boundsKind);
  const fallback =
    DEFAULT_NINJA_BOUNDS_CONFIG.boundsByActor[normalizedActorId][normalizedDirection][
      normalizedActionId
    ][normalizedBoundsKind];

  next.boundsByActor[normalizedActorId][normalizedDirection][normalizedActionId] = {
    ...next.boundsByActor[normalizedActorId][normalizedDirection][normalizedActionId],
    [normalizedBoundsKind]: normalizeRect(rect, fallback)
  };

  return next;
}

export function setNinjaHitFrame(
  config: NinjaBoundsConfig,
  actorId: string,
  direction: string,
  actionId: string,
  frameIndex: number,
  active: boolean
): NinjaBoundsConfig {
  const next = cloneNinjaBoundsConfig(config);
  const normalizedActorId = normalizeNinjaActorId(actorId);
  const normalizedDirection = normalizeFacingDirection(direction);
  const normalizedActionId = normalizeNinjaActionId(normalizedActorId, actionId);
  const frames = [
    ...next.hitFramesByActor[normalizedActorId][normalizedDirection][
      normalizedActionId
    ].attack
  ];

  if (frameIndex >= 0 && frameIndex < frames.length) {
    frames[frameIndex] = active;
  }

  next.hitFramesByActor[normalizedActorId][normalizedDirection][normalizedActionId] = {
    attack: frames
  };

  return next;
}

export function resetNinjaAnimationConfig(
  config: NinjaBoundsConfig,
  actorId: string,
  direction: string,
  actionId: string
): NinjaBoundsConfig {
  const next = cloneNinjaBoundsConfig(config);
  const normalizedActorId = normalizeNinjaActorId(actorId);
  const normalizedDirection = normalizeFacingDirection(direction);
  const normalizedActionId = normalizeNinjaActionId(normalizedActorId, actionId);

  next.boundsByActor[normalizedActorId][normalizedDirection][normalizedActionId] =
    cloneAnimationBounds(
      DEFAULT_NINJA_BOUNDS_CONFIG.boundsByActor[normalizedActorId][
        normalizedDirection
      ][normalizedActionId]
    );
  next.hitFramesByActor[normalizedActorId][normalizedDirection][normalizedActionId] = {
    attack: [
      ...DEFAULT_NINJA_BOUNDS_CONFIG.hitFramesByActor[normalizedActorId][
        normalizedDirection
      ][normalizedActionId].attack
    ]
  };

  return next;
}

export function applyNinjaBoundsKindToAllActions(
  config: NinjaBoundsConfig,
  actorId: string,
  direction: string,
  boundsKind: string,
  rect: NinjaRect
): NinjaBoundsConfig {
  const normalizedActorId = normalizeNinjaActorId(actorId);
  const normalizedDirection = normalizeFacingDirection(direction);
  const normalizedBoundsKind = normalizeNinjaBoundsKind(boundsKind);
  let next = cloneNinjaBoundsConfig(config);

  for (const actionDefinition of getNinjaAnimationsForActor(normalizedActorId)) {
    next = setNinjaAnimationBounds(
      next,
      normalizedActorId,
      normalizedDirection,
      actionDefinition.id,
      normalizedBoundsKind,
      rect
    );
  }

  return next;
}

export function applyAllNinjaBoundsToAllActions(
  config: NinjaBoundsConfig,
  actorId: string,
  direction: string,
  bounds: NinjaAnimationBounds
): NinjaBoundsConfig {
  const normalizedActorId = normalizeNinjaActorId(actorId);
  const normalizedDirection = normalizeFacingDirection(direction);
  let next = cloneNinjaBoundsConfig(config);

  for (const actionDefinition of getNinjaAnimationsForActor(normalizedActorId)) {
    for (const boundsKind of ['visual', 'collision', 'attack'] as const) {
      next = setNinjaAnimationBounds(
        next,
        normalizedActorId,
        normalizedDirection,
        actionDefinition.id,
        boundsKind,
        bounds[boundsKind]
      );
    }
  }

  return next;
}

function createDefaultNinjaBoundsConfig(): NinjaBoundsConfig {
  return {
    boundsByActor: Object.fromEntries(
      NINJA_ACTORS.map((actorDefinition) => [
        actorDefinition.id,
        Object.fromEntries(
          FACING_DIRECTIONS.map((direction) => [
            direction,
            Object.fromEntries(
              actorDefinition.actions.map((actionDefinition) => [
                actionDefinition.id,
                createDefaultBounds(actorDefinition.id, direction, actionDefinition.id)
              ])
            )
          ])
        )
      ])
    ) as NinjaBoundsByActor,
    hitFramesByActor: Object.fromEntries(
      NINJA_ACTORS.map((actorDefinition) => [
        actorDefinition.id,
        Object.fromEntries(
          FACING_DIRECTIONS.map((direction) => [
            direction,
            Object.fromEntries(
              actorDefinition.actions.map((actionDefinition) => [
                actionDefinition.id,
                {
                  attack: createDefaultAttackFrames(
                    actorDefinition.id,
                    actionDefinition.id,
                    actionDefinition.frameCount
                  )
                }
              ])
            )
          ])
        )
      ])
    ) as unknown as NinjaHitFramesByActor
  };
}

function createDefaultBounds(
  actorId: NinjaActorId,
  direction: FacingDirection,
  actionId: string
): NinjaAnimationBounds {
  return {
    visual: createDefaultVisualRect(actorId, actionId),
    collision: { ...DEFAULT_NINJA_COLLISION_RECT },
    attack: createDefaultAttackRect(actorId, direction, actionId)
  };
}

function createDefaultVisualRect(actorId: NinjaActorId, actionId: string): NinjaRect {
  if (actorId === 'enemyNinja') {
    return actionId === 'death'
      ? { x: 38, y: 42, width: 180, height: 194 }
      : { x: 54, y: 34, width: 150, height: 204 };
  }

  if (actionId === 'attack') {
    return { x: 26, y: 28, width: 204, height: 218 };
  }

  if (actionId === 'death') {
    return { x: 30, y: 44, width: 200, height: 190 };
  }

  return { x: 48, y: 34, width: 160, height: 210 };
}

function createDefaultAttackRect(
  actorId: NinjaActorId,
  direction: FacingDirection,
  actionId: string
): NinjaRect {
  const baseWidth = getDefaultAttackWidth(actorId, actionId);
  const baseHeight = actorId === 'mainNinja' ? 24 : 22;
  const y = actorId === 'mainNinja' ? 154 : 156;
  const rightX = actorId === 'mainNinja' ? 156 : 154;
  const x = direction === 'right' ? rightX : NINJA_FRAME_SIZE - rightX - baseWidth;

  return {
    x,
    y,
    width: baseWidth,
    height: baseHeight
  };
}

function getDefaultAttackWidth(actorId: NinjaActorId, actionId: string): number {
  if (actorId === 'enemyNinja') {
    return actionId === 'slash' ? 70 : 58;
  }

  if (actionId === 'attack') {
    return 82;
  }

  return 70;
}

function createDefaultAttackFrames(
  actorId: NinjaActorId,
  actionId: string,
  frameCount: number
): boolean[] {
  const attackFrames = Array.from({ length: frameCount }, () => false);
  const activeFrameIndexes =
    actorId === 'mainNinja'
      ? getMainNinjaDefaultAttackFrames(actionId)
      : getEnemyNinjaDefaultAttackFrames(actionId);

  for (const frameIndex of activeFrameIndexes) {
    if (frameIndex >= 0 && frameIndex < attackFrames.length) {
      attackFrames[frameIndex] = true;
    }
  }

  return attackFrames;
}

function getMainNinjaDefaultAttackFrames(actionId: string): readonly number[] {
  return actionId === 'attack' || actionId === 'slash' ? [13, 14] : [];
}

function getEnemyNinjaDefaultAttackFrames(actionId: string): readonly number[] {
  return actionId === 'slash' ? [15, 16] : [];
}

function normalizeBoundsByActor(
  boundsByActor: Partial<NinjaBoundsByActor> | undefined,
  defaults: NinjaBoundsByActor
): NinjaBoundsByActor {
  return Object.fromEntries(
    NINJA_ACTORS.map((actorDefinition) => [
      actorDefinition.id,
      Object.fromEntries(
        FACING_DIRECTIONS.map((direction) => [
          direction,
          Object.fromEntries(
            actorDefinition.actions.map((actionDefinition) => [
              actionDefinition.id,
              normalizeAnimationBounds(
                boundsByActor?.[actorDefinition.id]?.[direction]?.[actionDefinition.id],
                defaults[actorDefinition.id][direction][actionDefinition.id]
              )
            ])
          )
        ])
      )
    ])
  ) as NinjaBoundsByActor;
}

function normalizeAnimationBounds(
  bounds: Partial<NinjaAnimationBounds> | undefined,
  fallback: NinjaAnimationBounds
): NinjaAnimationBounds {
  return {
    visual: normalizeRect(bounds?.visual, fallback.visual),
    collision: normalizeRect(bounds?.collision, fallback.collision),
    attack: normalizeRect(bounds?.attack, fallback.attack)
  };
}

function normalizeHitFramesByActor(
  hitFramesByActor: Partial<NinjaHitFramesByActor> | undefined,
  defaults: NinjaHitFramesByActor
): NinjaHitFramesByActor {
  return Object.fromEntries(
    NINJA_ACTORS.map((actorDefinition) => [
      actorDefinition.id,
      Object.fromEntries(
        FACING_DIRECTIONS.map((direction) => [
          direction,
          Object.fromEntries(
            actorDefinition.actions.map((actionDefinition) => [
              actionDefinition.id,
              {
                attack: normalizeFrameFlags(
                  hitFramesByActor?.[actorDefinition.id]?.[direction]?.[
                    actionDefinition.id
                  ]?.attack,
                  actionDefinition.frameCount,
                  defaults[actorDefinition.id][direction][actionDefinition.id].attack
                )
              }
            ])
          )
        ])
      )
    ])
  ) as unknown as NinjaHitFramesByActor;
}

function normalizeRect(rect: Partial<NinjaRect> | undefined, fallback: NinjaRect): NinjaRect {
  const x = clampInteger(rect?.x, 0, NINJA_FRAME_SIZE - 1, fallback.x);
  const y = clampInteger(rect?.y, 0, NINJA_FRAME_SIZE - 1, fallback.y);
  const width = clampInteger(rect?.width, 1, NINJA_FRAME_SIZE - x, fallback.width);
  const height = clampInteger(rect?.height, 1, NINJA_FRAME_SIZE - y, fallback.height);

  return { x, y, width, height };
}

function normalizeFrameFlags(
  frames: readonly boolean[] | undefined,
  frameCount: number,
  fallback: readonly boolean[]
): boolean[] {
  if (!Array.isArray(frames)) {
    return [...fallback];
  }

  return Array.from({ length: frameCount }, (_, frameIndex) => frames[frameIndex] === true);
}

function cloneAnimationBounds(bounds: NinjaAnimationBounds): NinjaAnimationBounds {
  return {
    visual: { ...bounds.visual },
    collision: { ...bounds.collision },
    attack: { ...bounds.attack }
  };
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, Math.round(value)));
}
