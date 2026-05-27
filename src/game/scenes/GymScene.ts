import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import {
  DEFAULT_NINJA_BOUNDS_CONFIG,
  NINJA_CENTER,
  NINJA_FRAME_SIZE,
  areNinjaRectsEqual,
  getNinjaAction,
  getNinjaActor,
  getNinjaAnimationBounds,
  getNinjaAnimationKey,
  getDefaultNinjaActionId,
  getNinjaLaneAnchor,
  getNinjaTextureKey,
  isNinjaHitFrameActive,
  normalizeFacingDirection,
  normalizeNinjaActionId,
  normalizeNinjaActorId,
  preloadNinjaAnimationAssets,
  registerNinjaAnimations,
  setNinjaAnimationBounds,
  setNinjaLaneAnchor,
  type FacingDirection,
  type NinjaActorId,
  type NinjaBoundsConfig,
  type NinjaBoundsKind,
  type NinjaLaneAnchor,
  type NinjaRect
} from '../ninjaBounds';

const GRID_MINOR = 16;
const GRID_MAJOR = 64;
const MIN_ZOOM = 0.75;
const MAX_ZOOM = 4;
const EDIT_HANDLE_SIZE = 10;
const EDIT_HANDLE_HIT_PADDING = 7;
const EDIT_MIN_RECT_SIZE = 1;
const LANE_ANCHOR_HIT_RADIUS = 13;

function clampPreviewZoom(value: number): number {
  return Phaser.Math.Clamp(Math.round(value * 100) / 100, MIN_ZOOM, MAX_ZOOM);
}

type BoundsEditHandle = 'move' | 'n' | 'e' | 's' | 'w' | 'ne' | 'se' | 'sw' | 'nw';

interface BoundsEditState {
  readonly pointerId: number;
  readonly handle: BoundsEditHandle;
  readonly startPointer: Phaser.Math.Vector2;
  readonly startRect: NinjaRect;
}

interface ScreenHandle {
  readonly handle: Exclude<BoundsEditHandle, 'move'>;
  readonly x: number;
  readonly y: number;
}

interface PendingBoundsUpdate {
  readonly actorId: NinjaActorId;
  readonly direction: FacingDirection;
  readonly actionId: string;
  readonly boundsKind: NinjaBoundsKind;
  readonly rect: NinjaRect;
}

interface PendingLaneAnchorUpdate {
  readonly actorId: NinjaActorId;
  readonly direction: FacingDirection;
  readonly actionId: string;
  readonly anchor: NinjaLaneAnchor;
}

export class GymScene extends BaseScene {
  private actor: Phaser.GameObjects.Sprite | null = null;
  private overlay: Phaser.GameObjects.Graphics | null = null;
  private titleText: Phaser.GameObjects.Text | null = null;
  private detailText: Phaser.GameObjects.Text | null = null;
  private boundsConfig: NinjaBoundsConfig = DEFAULT_NINJA_BOUNDS_CONFIG;
  private selectedActorId: NinjaActorId = 'mainNinja';
  private selectedDirection: FacingDirection = 'right';
  private selectedActionId = getDefaultNinjaActionId(this.selectedActorId);
  private selectedBoundsKind: NinjaBoundsKind = 'collision';
  private showVisualBounds = true;
  private showCollisionBounds = true;
  private showAttackBounds = true;
  private playbackRate = 1;
  private previewZoom = 1.35;
  private lastTelemetryAt = Number.NEGATIVE_INFINITY;
  private boundsEditState: BoundsEditState | null = null;
  private laneAnchorEditPointerId: number | null = null;
  private pendingBoundsUpdate: PendingBoundsUpdate | null = null;
  private pendingLaneAnchorUpdate: PendingLaneAnchorUpdate | null = null;
  private boundsUpdateFrame: number | null = null;
  private laneAnchorUpdateFrame: number | null = null;
  private readonly screenRect = new Phaser.Geom.Rectangle();

  constructor() {
    super(SceneKeys.Gym);
  }

  preload(): void {
    preloadNinjaAnimationAssets(this);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#0b1020');
    registerNinjaAnimations(this);
    this.createGrid();
    this.createTextOverlay();
    this.createInput();

    const frame = this.getFramePlacement();
    this.actor = this.add
      .sprite(
        frame.left + NINJA_CENTER.x * this.previewZoom,
        frame.top + NINJA_FRAME_SIZE * this.previewZoom,
        getNinjaTextureKey(this.selectedActorId, this.selectedDirection, this.selectedActionId),
        0
      )
      .setOrigin(0.5, 1)
      .setDepth(50)
      .setScale(this.previewZoom);
    this.overlay = this.add.graphics().setDepth(90).setScrollFactor(0);

    this.syncFromGlobal();
    this.playSelectedAnimation(true);
    this.updateGymMarker();

    this.events.once('shutdown', () => {
      this.flushPendingBoundsUpdate();
      if (globalThis.__NINJA_SLASH_GYM__ !== undefined) {
        globalThis.__NINJA_SLASH_GYM__ = {
          ...globalThis.__NINJA_SLASH_GYM__,
          active: false
        };
      }
    });
  }

  update(time: number): void {
    if (this.actor === null) {
      return;
    }

    this.syncFromGlobal();
    this.playSelectedAnimation(false);
    this.layoutActor();
    this.drawBounds();
    this.updateReadout();
    this.updateGymMarker();
    this.publishTelemetry(time);
  }

  private createGrid(): void {
    const grid = this.add.graphics().setDepth(0).setScrollFactor(0);
    const { width, height } = this.profile;
    const centerX = width / 2;
    const centerY = height / 2;

    grid.fillStyle(0x0b1020, 1);
    grid.fillRect(0, 0, width, height);

    for (let x = 0; x <= width; x += GRID_MINOR) {
      const isMajor = x % GRID_MAJOR === 0;
      grid.lineStyle(1, isMajor ? 0x334155 : 0x1e293b, isMajor ? 0.55 : 0.32);
      grid.lineBetween(x, 0, x, height);
    }

    for (let y = 0; y <= height; y += GRID_MINOR) {
      const isMajor = y % GRID_MAJOR === 0;
      grid.lineStyle(1, isMajor ? 0x334155 : 0x1e293b, isMajor ? 0.55 : 0.32);
      grid.lineBetween(0, y, width, y);
    }

    grid.lineStyle(2, 0xf6c961, 0.8);
    grid.lineBetween(centerX, 0, centerX, height);
    grid.lineBetween(0, centerY, width, centerY);
  }

  private createTextOverlay(): void {
    this.titleText = this.add
      .text(24, 24, 'Ninja Gym', {
        backgroundColor: 'rgba(2, 6, 23, 0.54)',
        color: '#f8fafc',
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '20px',
        fontStyle: '700',
        padding: { x: 12, y: 8 }
      })
      .setDepth(100)
      .setScrollFactor(0);

    this.createTextButton({
      x: this.profile.width - 88,
      y: 42,
      label: 'Back',
      width: 152,
      height: 38,
      onClick: () => this.goTo(SceneKeys.MainMenu)
    })
      .setDepth(100)
      .setScrollFactor(0);

    this.detailText = this.add
      .text(24, 70, 'animation preview loading', {
        backgroundColor: 'rgba(2, 6, 23, 0.42)',
        color: '#cbd5e1',
        fontFamily: 'Consolas, monospace',
        fontSize: '14px',
        padding: { x: 12, y: 8 }
      })
      .setDepth(100)
      .setScrollFactor(0);

    this.add
      .text(this.centerX, this.profile.height - 26, 'Esc / Backspace: menu  |  Mouse wheel: zoom  |  Drag lane anchor', {
        backgroundColor: 'rgba(2, 6, 23, 0.42)',
        color: '#cbd5e1',
        fontFamily: 'Consolas, monospace',
        fontSize: '13px',
        padding: { x: 12, y: 6 }
      })
      .setOrigin(0.5)
      .setDepth(100)
      .setScrollFactor(0);
  }

  private createInput(): void {
    const keyboard = this.input.keyboard;
    const escape = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
    const backspace = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.BACKSPACE);
    const goBack = (): void => this.goTo(SceneKeys.MainMenu);
    const adjustZoom = (
      _pointer: Phaser.Input.Pointer,
      _objects: unknown[],
      _deltaX: number,
      deltaY: number
    ): void => {
      const direction = deltaY > 0 ? -1 : 1;
      this.setPreviewZoom(this.previewZoom + direction * 0.1);
    };
    const startBoundsEdit = (pointer: Phaser.Input.Pointer): void => {
      const handle = this.getBoundsEditHandle(pointer);

      if (handle === null) {
        return;
      }

      this.boundsEditState = {
        pointerId: pointer.id,
        handle,
        startPointer: this.getPointerFramePoint(pointer),
        startRect: { ...this.getSelectedBounds() }
      };
      this.input.setDefaultCursor(this.getCursorForHandle(handle));
    };
    const startEdit = (pointer: Phaser.Input.Pointer): void => {
      if (this.isLaneAnchorHit(pointer)) {
        this.laneAnchorEditPointerId = pointer.id;
        this.applyLaneAnchorEdit(pointer);
        this.input.setDefaultCursor('crosshair');
        return;
      }

      startBoundsEdit(pointer);
    };
    const updateEdit = (pointer: Phaser.Input.Pointer): void => {
      if (this.laneAnchorEditPointerId !== null) {
        if (pointer.id === this.laneAnchorEditPointerId) {
          this.applyLaneAnchorEdit(pointer);
        }
        return;
      }

      if (this.boundsEditState !== null) {
        if (pointer.id === this.boundsEditState.pointerId) {
          this.applyBoundsEdit(pointer);
        }
        return;
      }

      const handle = this.getBoundsEditHandle(pointer);
      this.input.setDefaultCursor(
        this.isLaneAnchorHit(pointer)
          ? 'crosshair'
          : handle === null
            ? 'default'
            : this.getCursorForHandle(handle)
      );
    };
    const stopEdit = (pointer: Phaser.Input.Pointer): void => {
      if (
        this.laneAnchorEditPointerId !== null &&
        pointer.id === this.laneAnchorEditPointerId
      ) {
        this.applyLaneAnchorEdit(pointer);
        this.flushPendingLaneAnchorUpdate();
        this.laneAnchorEditPointerId = null;
        this.input.setDefaultCursor('default');
        return;
      }

      if (
        this.boundsEditState !== null &&
        pointer.id === this.boundsEditState.pointerId
      ) {
        this.applyBoundsEdit(pointer);
        this.flushPendingBoundsUpdate();
        this.boundsEditState = null;
        this.input.setDefaultCursor('default');
      }
    };

    escape?.on('down', goBack);
    backspace?.on('down', goBack);
    this.input.on('wheel', adjustZoom);
    this.input.on('pointerdown', startEdit);
    this.input.on('pointermove', updateEdit);
    this.input.on('pointerup', stopEdit);
    this.input.on('pointerupoutside', stopEdit);

    this.trackCleanup(() => {
      escape?.off('down', goBack);
      backspace?.off('down', goBack);
      this.input.off('wheel', adjustZoom);
      this.input.off('pointerdown', startEdit);
      this.input.off('pointermove', updateEdit);
      this.input.off('pointerup', stopEdit);
      this.input.off('pointerupoutside', stopEdit);
      this.flushPendingBoundsUpdate();
      this.flushPendingLaneAnchorUpdate();
      try {
        this.input.setDefaultCursor('default');
      } catch {
        // HMR shutdown can tear down the input manager before scene cleanup runs.
      }
    });
  }

  private syncFromGlobal(): void {
    const gymState = globalThis.__NINJA_SLASH_GYM__;
    const nextActorId = normalizeNinjaActorId(gymState?.selectedActorId);
    const nextDirection = normalizeFacingDirection(gymState?.selectedDirection);
    const nextActionId = normalizeNinjaActionId(nextActorId, gymState?.selectedActionId);

    if (
      this.boundsEditState === null &&
      this.pendingBoundsUpdate === null &&
      this.laneAnchorEditPointerId === null &&
      this.pendingLaneAnchorUpdate === null
    ) {
      this.boundsConfig = gymState?.boundsConfig ?? this.app.getNinjaBoundsConfig();
    }
    this.selectedBoundsKind = gymState?.selectedBoundsKind ?? this.selectedBoundsKind;
    this.showVisualBounds = gymState?.showVisualBounds ?? this.showVisualBounds;
    this.showCollisionBounds = gymState?.showCollisionBounds ?? this.showCollisionBounds;
    this.showAttackBounds = gymState?.showAttackBounds ?? this.showAttackBounds;
    this.playbackRate = Phaser.Math.Clamp(gymState?.playbackRate ?? this.playbackRate, 0.25, 2);
    this.previewZoom = clampPreviewZoom(gymState?.zoom ?? this.previewZoom);

    if (
      nextActorId !== this.selectedActorId ||
      nextDirection !== this.selectedDirection ||
      nextActionId !== this.selectedActionId
    ) {
      this.selectedActorId = nextActorId;
      this.selectedDirection = nextDirection;
      this.selectedActionId = nextActionId;
      this.playSelectedAnimation(true);
    }
  }

  private playSelectedAnimation(forceRestart: boolean): void {
    if (this.actor === null) {
      return;
    }

    const animationKey = getNinjaAnimationKey(
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId
    );

    this.actor.anims.timeScale = this.playbackRate;
    const paused = this.debug.get().paused;

    if (forceRestart || this.actor.anims.currentAnim?.key !== animationKey) {
      this.actor.play(animationKey, false);
      if (paused) {
        this.actor.anims.pause();
      }
      return;
    }

    if (paused) {
      if (this.actor.anims.isPlaying) {
        this.actor.anims.pause();
      }
      return;
    }

    if (this.actor.anims.isPaused) {
      this.actor.anims.resume();
      return;
    }

    if (!this.actor.anims.isPlaying) {
      this.actor.play(animationKey, true);
    }
  }

  private setPreviewZoom(value: number): void {
    this.previewZoom = clampPreviewZoom(value);

    if (globalThis.__NINJA_SLASH_GYM__ !== undefined) {
      globalThis.__NINJA_SLASH_GYM__ = {
        ...globalThis.__NINJA_SLASH_GYM__,
        zoom: this.previewZoom
      };
    }
  }

  private layoutActor(): void {
    if (this.actor === null) {
      return;
    }

    const frame = this.getFramePlacement();
    this.actor
      .setPosition(
        frame.left + NINJA_CENTER.x * this.previewZoom,
        frame.top + NINJA_FRAME_SIZE * this.previewZoom
      )
      .setScale(this.previewZoom);
  }

  private drawBounds(): void {
    if (this.overlay === null) {
      return;
    }

    const frame = this.getFramePlacement();
    const activeBounds = getNinjaAnimationBounds(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId
    );
    const activeLaneAnchor = getNinjaLaneAnchor(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId
    );
    const currentFrame = this.getCurrentFrameIndex();
    const attackActive = isNinjaHitFrameActive(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId,
      currentFrame
    );

    this.overlay.clear();
    this.overlay.lineStyle(1, 0xf8fafc, 0.45);
    this.overlay.strokeRect(
      frame.left,
      frame.top,
      NINJA_FRAME_SIZE * this.previewZoom,
      NINJA_FRAME_SIZE * this.previewZoom
    );
    this.renderCrosshair(
      frame.left + NINJA_CENTER.x * this.previewZoom,
      frame.top + NINJA_FRAME_SIZE * this.previewZoom,
      10,
      0xf6c961,
      0.8
    );
    this.drawLaneAnchor(frame.left, frame.top, activeLaneAnchor);

    if (this.showVisualBounds) {
      this.drawRect(frame.left, frame.top, activeBounds.visual, 0x64b5ff, 0.08, true);
    }

    if (this.showCollisionBounds) {
      this.drawRect(frame.left, frame.top, activeBounds.collision, 0x35d08f, 0.12, true);
    }

    if (this.showAttackBounds) {
      this.drawRect(frame.left, frame.top, activeBounds.attack, 0xe56b6f, 0.12, attackActive);
    }

    this.drawEditableRect(
      frame.left,
      frame.top,
      activeBounds[this.selectedBoundsKind],
      this.getBoundsColor(this.selectedBoundsKind)
    );
  }

  private drawRect(
    frameLeft: number,
    frameTop: number,
    rect: NinjaRect,
    color: number,
    fillAlpha: number,
    active: boolean
  ): void {
    if (this.overlay === null) {
      return;
    }

    this.overlay.lineStyle(2, color, active ? 0.95 : 0.3);
    this.overlay.fillStyle(color, active ? fillAlpha : 0.025);
    this.overlay.strokeRect(
      frameLeft + rect.x * this.previewZoom,
      frameTop + rect.y * this.previewZoom,
      rect.width * this.previewZoom,
      rect.height * this.previewZoom
    );
    this.overlay.fillRect(
      frameLeft + rect.x * this.previewZoom,
      frameTop + rect.y * this.previewZoom,
      rect.width * this.previewZoom,
      rect.height * this.previewZoom
    );
  }

  private drawLaneAnchor(
    frameLeft: number,
    frameTop: number,
    anchor: NinjaLaneAnchor
  ): void {
    if (this.overlay === null) {
      return;
    }

    const x = frameLeft + anchor.x * this.previewZoom;
    const y = frameTop + anchor.y * this.previewZoom;
    const lineLeft = frameLeft;
    const lineRight = frameLeft + NINJA_FRAME_SIZE * this.previewZoom;

    this.overlay.lineStyle(2, 0xffd447, 0.78);
    this.overlay.lineBetween(lineLeft, y, lineRight, y);
    this.renderCrosshair(x, y, 13, 0xffd447, 1);
    this.overlay.fillStyle(0x020617, 0.9);
    this.overlay.fillCircle(x, y, 5);
    this.overlay.lineStyle(2, 0xffd447, 1);
    this.overlay.strokeCircle(x, y, LANE_ANCHOR_HIT_RADIUS * 0.5);
  }

  private drawEditableRect(
    frameLeft: number,
    frameTop: number,
    rect: NinjaRect,
    color: number
  ): void {
    if (this.overlay === null) {
      return;
    }

    const x = frameLeft + rect.x * this.previewZoom;
    const y = frameTop + rect.y * this.previewZoom;
    const width = rect.width * this.previewZoom;
    const height = rect.height * this.previewZoom;
    const halfHandle = EDIT_HANDLE_SIZE / 2;

    this.overlay.lineStyle(3, color, 1);
    this.overlay.strokeRect(x, y, width, height);
    this.overlay.fillStyle(0x020617, 0.9);
    this.overlay.lineStyle(2, color, 1);

    for (const handle of this.getScreenHandles(rect)) {
      this.overlay.fillRect(
        handle.x - halfHandle,
        handle.y - halfHandle,
        EDIT_HANDLE_SIZE,
        EDIT_HANDLE_SIZE
      );
      this.overlay.strokeRect(
        handle.x - halfHandle,
        handle.y - halfHandle,
        EDIT_HANDLE_SIZE,
        EDIT_HANDLE_SIZE
      );
    }
  }

  private getSelectedBounds(): NinjaRect {
    return getNinjaAnimationBounds(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId
    )[this.selectedBoundsKind];
  }

  private getBoundsColor(boundsKind: NinjaBoundsKind): number {
    if (boundsKind === 'visual') {
      return 0x64b5ff;
    }

    if (boundsKind === 'attack') {
      return 0xe56b6f;
    }

    return 0x35d08f;
  }

  private getBoundsEditHandle(pointer: Phaser.Input.Pointer): BoundsEditHandle | null {
    const rect = this.getSelectedBounds();
    const screenRect = this.getScreenRect(rect);
    const hitRadius = EDIT_HANDLE_SIZE / 2 + EDIT_HANDLE_HIT_PADDING;

    for (const handle of this.getScreenHandles(rect)) {
      if (
        Math.abs(pointer.x - handle.x) <= hitRadius &&
        Math.abs(pointer.y - handle.y) <= hitRadius
      ) {
        return handle.handle;
      }
    }

    if (
      pointer.x >= screenRect.x - EDIT_HANDLE_HIT_PADDING &&
      pointer.x <= screenRect.x + screenRect.width + EDIT_HANDLE_HIT_PADDING &&
      pointer.y >= screenRect.y - EDIT_HANDLE_HIT_PADDING &&
      pointer.y <= screenRect.y + screenRect.height + EDIT_HANDLE_HIT_PADDING
    ) {
      return 'move';
    }

    return null;
  }

  private getScreenRect(rect: NinjaRect): Phaser.Geom.Rectangle {
    const frame = this.getFramePlacement();

    return this.screenRect.setTo(
      frame.left + rect.x * this.previewZoom,
      frame.top + rect.y * this.previewZoom,
      rect.width * this.previewZoom,
      rect.height * this.previewZoom
    );
  }

  private getScreenHandles(rect: NinjaRect): readonly ScreenHandle[] {
    const screenRect = this.getScreenRect(rect);
    const left = screenRect.x;
    const top = screenRect.y;
    const centerX = screenRect.x + screenRect.width / 2;
    const centerY = screenRect.y + screenRect.height / 2;
    const right = screenRect.x + screenRect.width;
    const bottom = screenRect.y + screenRect.height;

    return [
      { handle: 'nw', x: left, y: top },
      { handle: 'n', x: centerX, y: top },
      { handle: 'ne', x: right, y: top },
      { handle: 'e', x: right, y: centerY },
      { handle: 'se', x: right, y: bottom },
      { handle: 's', x: centerX, y: bottom },
      { handle: 'sw', x: left, y: bottom },
      { handle: 'w', x: left, y: centerY }
    ];
  }

  private getPointerFramePoint(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    const frame = this.getFramePlacement();

    return new Phaser.Math.Vector2(
      (pointer.x - frame.left) / this.previewZoom,
      (pointer.y - frame.top) / this.previewZoom
    );
  }

  private isLaneAnchorHit(pointer: Phaser.Input.Pointer): boolean {
    const anchorPoint = this.getScreenLaneAnchor();

    return (
      Math.abs(pointer.x - anchorPoint.x) <= LANE_ANCHOR_HIT_RADIUS &&
      Math.abs(pointer.y - anchorPoint.y) <= LANE_ANCHOR_HIT_RADIUS
    );
  }

  private getScreenLaneAnchor(): Phaser.Math.Vector2 {
    const frame = this.getFramePlacement();
    const anchor = getNinjaLaneAnchor(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId
    );

    return new Phaser.Math.Vector2(
      frame.left + anchor.x * this.previewZoom,
      frame.top + anchor.y * this.previewZoom
    );
  }

  private applyLaneAnchorEdit(pointer: Phaser.Input.Pointer): void {
    const framePoint = this.getPointerFramePoint(pointer);

    this.updateSelectedLaneAnchor({
      x: Phaser.Math.Clamp(Math.round(framePoint.x), 0, NINJA_FRAME_SIZE - 1),
      y: Phaser.Math.Clamp(Math.round(framePoint.y), 0, NINJA_FRAME_SIZE - 1)
    });
  }

  private updateSelectedLaneAnchor(anchor: NinjaLaneAnchor): void {
    const currentAnchor = getNinjaLaneAnchor(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId
    );

    if (currentAnchor.x === anchor.x && currentAnchor.y === anchor.y) {
      return;
    }

    this.boundsConfig = setNinjaLaneAnchor(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId,
      anchor
    );
    this.updateGymMarker();
    this.queueLaneAnchorUpdate(anchor);
  }

  private applyBoundsEdit(pointer: Phaser.Input.Pointer): void {
    if (this.boundsEditState === null) {
      return;
    }

    const currentPointer = this.getPointerFramePoint(pointer);
    const dx = currentPointer.x - this.boundsEditState.startPointer.x;
    const dy = currentPointer.y - this.boundsEditState.startPointer.y;
    const rect =
      this.boundsEditState.handle === 'move'
        ? this.getMovedRect(this.boundsEditState.startRect, dx, dy)
        : this.getResizedRect(
            this.boundsEditState.startRect,
            this.boundsEditState.handle,
            dx,
            dy
          );

    this.updateSelectedBounds(rect);
  }

  private getMovedRect(rect: NinjaRect, dx: number, dy: number): NinjaRect {
    const x = Phaser.Math.Clamp(
      Math.round(rect.x + dx),
      0,
      NINJA_FRAME_SIZE - rect.width
    );
    const y = Phaser.Math.Clamp(
      Math.round(rect.y + dy),
      0,
      NINJA_FRAME_SIZE - rect.height
    );

    return { ...rect, x, y };
  }

  private getResizedRect(
    rect: NinjaRect,
    handle: Exclude<BoundsEditHandle, 'move'>,
    dx: number,
    dy: number
  ): NinjaRect {
    const startLeft = rect.x;
    const startTop = rect.y;
    const startRight = rect.x + rect.width;
    const startBottom = rect.y + rect.height;
    let left = startLeft;
    let top = startTop;
    let right = startRight;
    let bottom = startBottom;

    if (handle.includes('w')) {
      left = Phaser.Math.Clamp(startLeft + dx, 0, startRight - EDIT_MIN_RECT_SIZE);
    }
    if (handle.includes('e')) {
      right = Phaser.Math.Clamp(startRight + dx, startLeft + EDIT_MIN_RECT_SIZE, NINJA_FRAME_SIZE);
    }
    if (handle.includes('n')) {
      top = Phaser.Math.Clamp(startTop + dy, 0, startBottom - EDIT_MIN_RECT_SIZE);
    }
    if (handle.includes('s')) {
      bottom = Phaser.Math.Clamp(startBottom + dy, startTop + EDIT_MIN_RECT_SIZE, NINJA_FRAME_SIZE);
    }

    const roundedLeft = Math.round(left);
    const roundedTop = Math.round(top);
    const roundedRight = Math.round(right);
    const roundedBottom = Math.round(bottom);

    return {
      x: roundedLeft,
      y: roundedTop,
      width: Math.max(EDIT_MIN_RECT_SIZE, roundedRight - roundedLeft),
      height: Math.max(EDIT_MIN_RECT_SIZE, roundedBottom - roundedTop)
    };
  }

  private updateSelectedBounds(rect: NinjaRect): void {
    if (areNinjaRectsEqual(this.getSelectedBounds(), rect)) {
      return;
    }

    this.boundsConfig = setNinjaAnimationBounds(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId,
      this.selectedBoundsKind,
      rect
    );
    this.updateGymMarker();
    this.queueBoundsUpdate(rect);
  }

  private queueBoundsUpdate(rect: NinjaRect): void {
    this.pendingBoundsUpdate = {
      actorId: this.selectedActorId,
      direction: this.selectedDirection,
      actionId: this.selectedActionId,
      boundsKind: this.selectedBoundsKind,
      rect: { ...rect }
    };

    if (this.boundsUpdateFrame !== null) {
      return;
    }

    this.boundsUpdateFrame = window.requestAnimationFrame(() => {
      this.boundsUpdateFrame = null;
      this.flushPendingBoundsUpdate();
    });
  }

  private queueLaneAnchorUpdate(anchor: NinjaLaneAnchor): void {
    this.pendingLaneAnchorUpdate = {
      actorId: this.selectedActorId,
      direction: this.selectedDirection,
      actionId: this.selectedActionId,
      anchor: { ...anchor }
    };

    if (this.laneAnchorUpdateFrame !== null) {
      return;
    }

    this.laneAnchorUpdateFrame = window.requestAnimationFrame(() => {
      this.laneAnchorUpdateFrame = null;
      this.flushPendingLaneAnchorUpdate();
    });
  }

  private flushPendingBoundsUpdate(): void {
    const pendingUpdate = this.pendingBoundsUpdate;

    if (pendingUpdate === null) {
      return;
    }

    this.pendingBoundsUpdate = null;

    if (this.boundsUpdateFrame !== null) {
      window.cancelAnimationFrame(this.boundsUpdateFrame);
      this.boundsUpdateFrame = null;
    }

    globalThis.__NINJA_SLASH_GYM__?.updateBounds?.(
      pendingUpdate.actorId,
      pendingUpdate.direction,
      pendingUpdate.actionId,
      pendingUpdate.boundsKind,
      pendingUpdate.rect
    );
  }

  private flushPendingLaneAnchorUpdate(): void {
    const pendingUpdate = this.pendingLaneAnchorUpdate;

    if (pendingUpdate === null) {
      return;
    }

    this.pendingLaneAnchorUpdate = null;

    if (this.laneAnchorUpdateFrame !== null) {
      window.cancelAnimationFrame(this.laneAnchorUpdateFrame);
      this.laneAnchorUpdateFrame = null;
    }

    globalThis.__NINJA_SLASH_GYM__?.updateLaneAnchor?.(
      pendingUpdate.actorId,
      pendingUpdate.direction,
      pendingUpdate.actionId,
      pendingUpdate.anchor
    );
  }

  private getCursorForHandle(handle: BoundsEditHandle): string {
    if (handle === 'move') {
      return 'move';
    }

    if (handle === 'n' || handle === 's') {
      return 'ns-resize';
    }

    if (handle === 'e' || handle === 'w') {
      return 'ew-resize';
    }

    return handle === 'ne' || handle === 'sw' ? 'nesw-resize' : 'nwse-resize';
  }

  private updateReadout(): void {
    const actor = getNinjaActor(this.selectedActorId);
    const actionDefinition = getNinjaAction(this.selectedActorId, this.selectedActionId);
    const frameCount = actionDefinition.frameCount;
    const currentFrame = this.getCurrentFrameIndex();
    const hitFrameActive = isNinjaHitFrameActive(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId,
      currentFrame
    );
    const laneAnchor = getNinjaLaneAnchor(
      this.boundsConfig,
      this.selectedActorId,
      this.selectedDirection,
      this.selectedActionId
    );

    this.titleText?.setText('Ninja Gym');
    this.detailText?.setText(
      `${actor.label} • ${this.selectedDirection} • ${actionDefinition.label} • frame ${
        currentFrame + 1
      }/${frameCount} • anchor ${laneAnchor.x},${laneAnchor.y} • hit ${hitFrameActive ? 'ON' : 'off'} • ${actionDefinition.frameRate}fps • ${this.playbackRate.toFixed(
        2
      )}x • zoom ${this.previewZoom.toFixed(2)}x`
    );
  }

  private updateGymMarker(): void {
    const current = globalThis.__NINJA_SLASH_GYM__;

    globalThis.__NINJA_SLASH_GYM__ = {
      active: true,
      selectedActorId: this.selectedActorId,
      selectedDirection: this.selectedDirection,
      selectedActionId: this.selectedActionId,
      selectedBoundsKind: this.selectedBoundsKind,
      showVisualBounds: this.showVisualBounds,
      showCollisionBounds: this.showCollisionBounds,
      showAttackBounds: this.showAttackBounds,
      playbackRate: this.playbackRate,
      boundsConfig: this.boundsConfig,
      currentFrame: this.getCurrentFrameIndex(),
      zoom: this.previewZoom || current?.zoom || 1,
      updateBounds: current?.updateBounds,
      updateLaneAnchor: current?.updateLaneAnchor
    };
  }

  private publishTelemetry(time: number): void {
    if (time - this.lastTelemetryAt < 120) {
      return;
    }

    this.lastTelemetryAt = time;
    this.debug.setPerformance({
      fps: this.game.loop.actualFps,
      physicsBodies: 0
    });
  }

  private getFramePlacement(): { left: number; top: number } {
    return {
      left: this.centerX - (NINJA_FRAME_SIZE * this.previewZoom) / 2,
      top: this.centerY - (NINJA_FRAME_SIZE * this.previewZoom) / 2
    };
  }

  private getCurrentFrameIndex(): number {
    const actionDefinition = getNinjaAction(this.selectedActorId, this.selectedActionId);
    const currentIndex = this.actor?.anims.currentFrame?.index ?? 1;

    return Phaser.Math.Clamp(currentIndex - 1, 0, actionDefinition.frameCount - 1);
  }

  private renderCrosshair(
    x: number,
    y: number,
    size: number,
    color: number,
    alpha: number
  ): void {
    if (this.overlay === null) {
      return;
    }

    this.overlay.lineStyle(2, color, alpha);
    this.overlay.lineBetween(x - size, y, x + size, y);
    this.overlay.lineBetween(x, y - size, x, y + size);
    this.overlay.strokeCircle(x, y, 3);
  }
}
