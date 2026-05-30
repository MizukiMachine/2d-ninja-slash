export type PlayerLaneId = 'upper' | 'middle' | 'lower';
export type LaneTapDirection = 'up' | 'down';
export type PlayerLaneAction = 'idle' | 'run' | 'jump';

export interface PlayerLaneDefinition {
  readonly id: PlayerLaneId;
  readonly y: number;
}

export interface ThreeLaneLayout {
  readonly lanes: readonly [
    PlayerLaneDefinition,
    PlayerLaneDefinition,
    PlayerLaneDefinition
  ];
}

export interface ThreeLaneYSettings {
  readonly upperY: number;
  readonly middleY: number;
  readonly lowerY: number;
}

export interface CreateThreeLaneLayoutInput {
  readonly middleY: number;
  readonly spacing: number;
}

export interface CreateDefaultThreeLaneYSettingsInput {
  readonly worldHeight: number;
  readonly centerY?: number;
  readonly middleOffset?: number;
  readonly spacing?: number;
  readonly minY?: number;
  readonly bottomInset?: number;
}

export interface NormalizeThreeLaneYSettingsOptions {
  readonly worldHeight: number;
  readonly fallback?: ThreeLaneYSettings;
  readonly minY?: number;
  readonly bottomInset?: number;
  readonly minLaneSpacing?: number;
}

export interface PlayerLaneMovementControllerOptions {
  readonly layout: ThreeLaneLayout;
  readonly initialLaneId?: PlayerLaneId;
  readonly doubleTapSeconds?: number;
  readonly transitionSeconds?: number;
  readonly jumpArcHeight?: number;
}

export interface PlayerLaneMovementInput {
  readonly left: boolean;
  readonly right: boolean;
  readonly speed: number;
  readonly deltaSeconds: number;
}

export interface PlayerLaneMovementFrame {
  readonly laneId: PlayerLaneId;
  readonly targetLaneId: PlayerLaneId;
  readonly y: number;
  readonly depthY: number;
  readonly velocityX: number;
  readonly velocityY: number;
  readonly action: PlayerLaneAction;
  readonly isTransitioning: boolean;
  readonly completedTransition: boolean;
}

interface ActiveLaneTransition {
  readonly sourceLaneId: PlayerLaneId;
  readonly targetLaneId: PlayerLaneId;
  readonly sourceY: number;
  readonly targetY: number;
  elapsedSeconds: number;
}

export interface ThreeLaneSpawnInput {
  readonly index: number;
  readonly worldWidth: number;
  readonly edgeInset: number;
}

export interface ThreeLaneSpawnPoint {
  readonly laneId: PlayerLaneId;
  readonly x: number;
}

export interface ThreeLaneSpawnPlacementInput extends ThreeLaneSpawnInput {
  readonly layout: ThreeLaneLayout;
}

export interface ThreeLaneSpawnPlacement extends ThreeLaneSpawnPoint {
  readonly y: number;
}

export const PLAYER_LANE_IDS = ['upper', 'middle', 'lower'] as const;
export const THREE_LANE_SPAWN_LANE_ORDER = ['middle', 'upper', 'lower'] as const;
// One left + one right edge slot per lane fills before overflow scatters inward.
export const THREE_LANE_EDGE_SLOT_COUNT = THREE_LANE_SPAWN_LANE_ORDER.length * 2;
export const PLAYER_LANE_DOUBLE_TAP_SECONDS = 0.3;
export const PLAYER_LANE_TRANSITION_SECONDS = 0.28;
export const PLAYER_LANE_JUMP_ARC_HEIGHT = 34;
export const THREE_LANE_DEFAULT_SPACING = 96;
export const THREE_LANE_DEFAULT_MIDDLE_OFFSET = 108;
export const THREE_LANE_MIN_Y = 140;
export const THREE_LANE_BOTTOM_INSET = 72;
export const THREE_LANE_MIN_SPACING = 24;

const MIN_TRANSITION_SECONDS = 0.01;

export function createThreeLaneLayout({
  middleY,
  spacing
}: CreateThreeLaneLayoutInput): ThreeLaneLayout {
  const safeSpacing = Math.max(0, Math.abs(spacing));

  return {
    lanes: [
      { id: 'upper', y: middleY - safeSpacing },
      { id: 'middle', y: middleY },
      { id: 'lower', y: middleY + safeSpacing }
    ]
  };
}

export function createDefaultThreeLaneYSettings({
  worldHeight,
  centerY,
  middleOffset = THREE_LANE_DEFAULT_MIDDLE_OFFSET,
  spacing = THREE_LANE_DEFAULT_SPACING,
  minY = THREE_LANE_MIN_Y,
  bottomInset = THREE_LANE_BOTTOM_INSET
}: CreateDefaultThreeLaneYSettingsInput): ThreeLaneYSettings {
  const { safeWorldHeight, minLaneY, maxLaneY } = getLaneYBounds(
    worldHeight,
    minY,
    bottomInset
  );
  const safeSpacing = getSafeLaneSpacing(
    minLaneY,
    maxLaneY,
    Math.abs(spacing)
  );
  const middleY = clampInteger(
    (centerY ?? safeWorldHeight / 2) + middleOffset,
    minLaneY + safeSpacing,
    maxLaneY - safeSpacing,
    (minLaneY + maxLaneY) / 2
  );

  return {
    upperY: middleY - safeSpacing,
    middleY,
    lowerY: middleY + safeSpacing
  };
}

export function normalizeThreeLaneYSettings(
  value: unknown,
  {
    worldHeight,
    fallback,
    minY = THREE_LANE_MIN_Y,
    bottomInset = THREE_LANE_BOTTOM_INSET,
    minLaneSpacing = THREE_LANE_MIN_SPACING
  }: NormalizeThreeLaneYSettingsOptions
): ThreeLaneYSettings {
  const candidate = value as Partial<ThreeLaneYSettings> | null;
  const defaultSettings =
    fallback ?? createDefaultThreeLaneYSettings({ worldHeight, minY, bottomInset });
  const { minLaneY, maxLaneY } = getLaneYBounds(worldHeight, minY, bottomInset);
  const safeMinSpacing = getSafeLaneSpacing(
    minLaneY,
    maxLaneY,
    Math.max(0, minLaneSpacing)
  );
  const middleY = clampInteger(
    candidate?.middleY,
    minLaneY + safeMinSpacing,
    maxLaneY - safeMinSpacing,
    defaultSettings.middleY
  );
  const upperY = clampInteger(
    candidate?.upperY,
    minLaneY,
    middleY - safeMinSpacing,
    defaultSettings.upperY
  );
  const lowerY = clampInteger(
    candidate?.lowerY,
    middleY + safeMinSpacing,
    maxLaneY,
    defaultSettings.lowerY
  );

  return { upperY, middleY, lowerY };
}

export function createThreeLaneLayoutFromYSettings(
  settings: ThreeLaneYSettings
): ThreeLaneLayout {
  return {
    lanes: [
      { id: 'upper', y: roundFinite(settings.upperY, 0) },
      { id: 'middle', y: roundFinite(settings.middleY, 0) },
      { id: 'lower', y: roundFinite(settings.lowerY, 0) }
    ]
  };
}

export function getThreeLaneLayoutY(
  layout: ThreeLaneLayout,
  laneId: PlayerLaneId
): number {
  switch (laneId) {
    case 'upper':
      return layout.lanes[0].y;
    case 'middle':
      return layout.lanes[1].y;
    case 'lower':
      return layout.lanes[2].y;
  }
}

/**
 * Bisection (van der Corput, base 2) fraction in (0, 1): 1/2, 1/4, 3/4, 1/8,
 * 3/8, 5/8, 7/8, 1/16, … Each successive index lands in the middle of the
 * largest remaining gap, so overflow spawns stay evenly spread across the
 * interior instead of stacking.
 */
function getBisectionFraction(index: number): number {
  const n = Math.max(0, Math.trunc(index)) + 1;
  const level = 31 - Math.clz32(n);
  const countAtLevel = 1 << level;
  const offsetInLevel = n - countAtLevel;

  return (2 * offsetInLevel + 1) / (countAtLevel * 2);
}

/**
 * Enemy spawn X by index. The first {@link THREE_LANE_EDGE_SLOT_COUNT} spawns
 * fill the left/right edge of each lane (alternating right, left, …). Once the
 * edges are taken, further spawns scatter across the interior via a centre-out
 * bisection so a crowded wave spreads through the middle instead of stacking
 * more columns at the edges. The lane cycles middle → upper → lower throughout.
 */
export function getThreeLaneSpawnPoint({
  index,
  worldWidth,
  edgeInset
}: ThreeLaneSpawnInput): ThreeLaneSpawnPoint {
  const spawnIndex = Math.max(0, Math.trunc(index));
  const safeWorldWidth = Math.max(0, worldWidth);
  const safeEdgeInset = Math.max(0, Math.min(edgeInset, safeWorldWidth / 2));
  const laneId = THREE_LANE_SPAWN_LANE_ORDER[
    spawnIndex % THREE_LANE_SPAWN_LANE_ORDER.length
  ];

  if (spawnIndex < THREE_LANE_EDGE_SLOT_COUNT) {
    const onLeftEdge = spawnIndex % 2 !== 0;
    const x = onLeftEdge ? safeEdgeInset : safeWorldWidth - safeEdgeInset;

    return { laneId, x };
  }

  const overflowIndex = spawnIndex - THREE_LANE_EDGE_SLOT_COUNT;
  const usableWidth = safeWorldWidth - safeEdgeInset * 2;
  const x = safeEdgeInset + getBisectionFraction(overflowIndex) * usableWidth;

  return { laneId, x };
}

export function getThreeLaneSpawnPlacement({
  layout,
  ...input
}: ThreeLaneSpawnPlacementInput): ThreeLaneSpawnPlacement {
  const spawnPoint = getThreeLaneSpawnPoint(input);

  return {
    ...spawnPoint,
    y: getThreeLaneLayoutY(layout, spawnPoint.laneId)
  };
}

export class DoubleTapLaneInputDetector {
  private readonly doubleTapSeconds: number;
  private readonly lastTapSeconds: Record<LaneTapDirection, number> = {
    up: Number.NEGATIVE_INFINITY,
    down: Number.NEGATIVE_INFINITY
  };

  constructor(doubleTapSeconds = PLAYER_LANE_DOUBLE_TAP_SECONDS) {
    this.doubleTapSeconds = Math.max(0, doubleTapSeconds);
  }

  tap(direction: LaneTapDirection, timeSeconds: number): boolean {
    if (!Number.isFinite(timeSeconds)) {
      this.reset(direction);
      return false;
    }

    const previousTapSeconds = this.lastTapSeconds[direction];
    const isDoubleTap =
      timeSeconds >= previousTapSeconds &&
      timeSeconds - previousTapSeconds <= this.doubleTapSeconds;

    this.lastTapSeconds[direction] = isDoubleTap
      ? Number.NEGATIVE_INFINITY
      : timeSeconds;

    return isDoubleTap;
  }

  reset(direction?: LaneTapDirection): void {
    if (direction === undefined) {
      this.lastTapSeconds.up = Number.NEGATIVE_INFINITY;
      this.lastTapSeconds.down = Number.NEGATIVE_INFINITY;
      return;
    }

    this.lastTapSeconds[direction] = Number.NEGATIVE_INFINITY;
  }
}

export class ThreeLaneManager {
  private lanesById: Record<PlayerLaneId, PlayerLaneDefinition>;
  private laneId: PlayerLaneId;

  constructor(layout: ThreeLaneLayout, initialLaneId: PlayerLaneId = 'middle') {
    this.lanesById = createLaneLookup(layout);
    this.laneId = initialLaneId;
  }

  get currentLaneId(): PlayerLaneId {
    return this.laneId;
  }

  get currentY(): number {
    return this.getLaneY(this.laneId);
  }

  getLaneY(laneId: PlayerLaneId): number {
    return this.lanesById[laneId].y;
  }

  getAdjacentLaneId(direction: LaneTapDirection): PlayerLaneId | null {
    const currentIndex = PLAYER_LANE_IDS.indexOf(this.laneId);
    const nextIndex = currentIndex + (direction === 'up' ? -1 : 1);

    return PLAYER_LANE_IDS[nextIndex] ?? null;
  }

  getDirectionToward(targetLaneId: PlayerLaneId): LaneTapDirection | null {
    const currentIndex = PLAYER_LANE_IDS.indexOf(this.laneId);
    const targetIndex = PLAYER_LANE_IDS.indexOf(targetLaneId);

    if (targetIndex < currentIndex) {
      return 'up';
    }

    if (targetIndex > currentIndex) {
      return 'down';
    }

    return null;
  }

  canMove(direction: LaneTapDirection): boolean {
    return this.getAdjacentLaneId(direction) !== null;
  }

  setCurrentLane(laneId: PlayerLaneId): void {
    this.laneId = laneId;
  }

  setLayout(layout: ThreeLaneLayout): void {
    this.lanesById = createLaneLookup(layout);
  }
}

export class PlayerLaneMovementController {
  private readonly laneManager: ThreeLaneManager;
  private readonly doubleTapInput: DoubleTapLaneInputDetector;
  private readonly transitionSeconds: number;
  private readonly jumpArcHeight: number;
  private activeTransition: ActiveLaneTransition | null = null;

  constructor({
    layout,
    initialLaneId = 'middle',
    doubleTapSeconds = PLAYER_LANE_DOUBLE_TAP_SECONDS,
    transitionSeconds = PLAYER_LANE_TRANSITION_SECONDS,
    jumpArcHeight = PLAYER_LANE_JUMP_ARC_HEIGHT
  }: PlayerLaneMovementControllerOptions) {
    this.laneManager = new ThreeLaneManager(layout, initialLaneId);
    this.doubleTapInput = new DoubleTapLaneInputDetector(doubleTapSeconds);
    this.transitionSeconds = Math.max(MIN_TRANSITION_SECONDS, transitionSeconds);
    this.jumpArcHeight = Math.max(0, jumpArcHeight);
  }

  get currentLaneId(): PlayerLaneId {
    return this.laneManager.currentLaneId;
  }

  get targetLaneId(): PlayerLaneId {
    return this.activeTransition?.targetLaneId ?? this.laneManager.currentLaneId;
  }

  get currentY(): number {
    if (this.activeTransition !== null) {
      return this.getTransitionY(this.activeTransition);
    }

    return this.laneManager.currentY;
  }

  get currentDepthY(): number {
    if (this.activeTransition !== null) {
      return this.getTransitionDepthY(this.activeTransition);
    }

    return this.laneManager.currentY;
  }

  get isTransitioning(): boolean {
    return this.activeTransition !== null;
  }

  setLayout(layout: ThreeLaneLayout): void {
    const activeTransition = this.activeTransition;
    const currentTransitionY =
      activeTransition === null ? 0 : this.getTransitionY(activeTransition);

    this.laneManager.setLayout(layout);

    if (activeTransition === null) {
      return;
    }

    const progress = this.getTransitionProgress(activeTransition);
    const targetY = this.laneManager.getLaneY(activeTransition.targetLaneId);
    const arcY = Math.sin(progress * Math.PI) * this.jumpArcHeight;
    const sourceY = progress >= 1
      ? this.laneManager.getLaneY(activeTransition.sourceLaneId)
      : (currentTransitionY + arcY - targetY * progress) / (1 - progress);

    this.activeTransition = {
      ...activeTransition,
      sourceY,
      targetY
    };
  }

  tapLane(direction: LaneTapDirection, timeSeconds: number): boolean {
    if (this.activeTransition !== null) {
      return false;
    }

    if (!this.laneManager.canMove(direction)) {
      this.doubleTapInput.reset(direction);
      return false;
    }

    if (!this.doubleTapInput.tap(direction, timeSeconds)) {
      return false;
    }

    const targetLaneId = this.laneManager.getAdjacentLaneId(direction);

    if (targetLaneId === null) {
      return false;
    }

    this.activeTransition = {
      sourceLaneId: this.laneManager.currentLaneId,
      targetLaneId,
      sourceY: this.laneManager.currentY,
      targetY: this.laneManager.getLaneY(targetLaneId),
      elapsedSeconds: 0
    };

    return true;
  }

  stepLane(direction: LaneTapDirection): boolean {
    if (this.activeTransition !== null) {
      return false;
    }

    return this.startLaneTransition(direction);
  }

  requestLaneStepToward(targetLaneId: PlayerLaneId): boolean {
    if (this.activeTransition !== null) {
      return false;
    }

    const direction = this.laneManager.getDirectionToward(targetLaneId);

    if (direction === null) {
      return false;
    }

    return this.startLaneTransition(direction);
  }

  reset(laneId: PlayerLaneId = 'middle'): void {
    this.activeTransition = null;
    this.doubleTapInput.reset();
    this.laneManager.setCurrentLane(laneId);
  }

  resetTapState(): void {
    this.doubleTapInput.reset();
  }

  update(input: PlayerLaneMovementInput): PlayerLaneMovementFrame {
    const deltaSeconds = Math.max(0, input.deltaSeconds);
    const speed = Number.isFinite(input.speed) ? input.speed : 0;

    if (this.activeTransition !== null) {
      const transition = this.activeTransition;
      transition.elapsedSeconds = Math.min(
        this.transitionSeconds,
        transition.elapsedSeconds + deltaSeconds
      );

      const completedTransition = transition.elapsedSeconds >= this.transitionSeconds;
      const y = completedTransition ? transition.targetY : this.getTransitionY(transition);
      const depthY = completedTransition
        ? transition.targetY
        : this.getTransitionDepthY(transition);

      if (completedTransition) {
        this.laneManager.setCurrentLane(transition.targetLaneId);
        this.activeTransition = null;
        return this.createGroundedFrame(input, speed, true);
      }

      return {
        laneId: transition.sourceLaneId,
        targetLaneId: transition.targetLaneId,
        y,
        depthY,
        velocityX: 0,
        velocityY: 0,
        action: 'jump',
        isTransitioning: true,
        completedTransition: false
      };
    }

    return this.createGroundedFrame(input, speed, false);
  }

  private createGroundedFrame(
    input: PlayerLaneMovementInput,
    speed: number,
    completedTransition: boolean
  ): PlayerLaneMovementFrame {
    const horizontalDirection = Number(input.right) - Number(input.left);
    const velocityX = horizontalDirection * speed;

    return {
      laneId: this.laneManager.currentLaneId,
      targetLaneId: this.laneManager.currentLaneId,
      y: this.laneManager.currentY,
      depthY: this.laneManager.currentY,
      velocityX,
      velocityY: 0,
      action: horizontalDirection === 0 ? 'idle' : 'run',
      isTransitioning: false,
      completedTransition
    };
  }

  private startLaneTransition(direction: LaneTapDirection): boolean {
    const targetLaneId = this.laneManager.getAdjacentLaneId(direction);

    if (targetLaneId === null) {
      return false;
    }

    this.activeTransition = {
      sourceLaneId: this.laneManager.currentLaneId,
      targetLaneId,
      sourceY: this.laneManager.currentY,
      targetY: this.laneManager.getLaneY(targetLaneId),
      elapsedSeconds: 0
    };

    return true;
  }

  private getTransitionY(transition: ActiveLaneTransition): number {
    const progress = this.getTransitionProgress(transition);
    const arcY = Math.sin(progress * Math.PI) * this.jumpArcHeight;

    return this.getTransitionDepthY(transition) - arcY;
  }

  private getTransitionDepthY(transition: ActiveLaneTransition): number {
    const progress = this.getTransitionProgress(transition);

    return transition.sourceY + (transition.targetY - transition.sourceY) * progress;
  }

  private getTransitionProgress(transition: ActiveLaneTransition): number {
    return this.transitionSeconds === 0
      ? 1
      : transition.elapsedSeconds / this.transitionSeconds;
  }
}

function createLaneLookup(
  layout: ThreeLaneLayout
): Record<PlayerLaneId, PlayerLaneDefinition> {
  return {
    upper: layout.lanes[0],
    middle: layout.lanes[1],
    lower: layout.lanes[2]
  };
}

function getLaneYBounds(
  worldHeight: number,
  minY: number,
  bottomInset: number
): {
  readonly safeWorldHeight: number;
  readonly minLaneY: number;
  readonly maxLaneY: number;
} {
  const safeWorldHeight = Math.max(0, roundFinite(worldHeight, 0));
  const minLaneY = Math.max(0, roundFinite(minY, THREE_LANE_MIN_Y));
  const safeBottomInset = Math.max(0, roundFinite(bottomInset, THREE_LANE_BOTTOM_INSET));
  const maxLaneY = Math.max(minLaneY, safeWorldHeight - safeBottomInset);

  return { safeWorldHeight, minLaneY, maxLaneY };
}

function getSafeLaneSpacing(
  minLaneY: number,
  maxLaneY: number,
  spacing: number
): number {
  const maxSpacing = Math.max(0, Math.floor((maxLaneY - minLaneY) / 2));

  return Math.min(maxSpacing, Math.max(0, roundFinite(spacing, 0)));
}

function clampInteger(
  value: unknown,
  min: number,
  max: number,
  fallback: number
): number {
  const safeMin = Math.min(min, max);
  const safeMax = Math.max(min, max);
  const candidate = typeof value === 'number' && Number.isFinite(value)
    ? value
    : fallback;

  return Math.min(safeMax, Math.max(safeMin, Math.round(candidate)));
}

function roundFinite(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.round(value)
    : fallback;
}
