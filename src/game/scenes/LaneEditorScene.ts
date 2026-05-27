import Phaser from 'phaser';
import { SceneKeys } from '../sceneKeys';
import {
  normalizeSandboxLaneSettings,
  saveSandboxLaneSettings,
  type SandboxLaneSettings
} from '../debugFeatures';
import {
  PLAYER_LANE_IDS,
  THREE_LANE_BOTTOM_INSET,
  THREE_LANE_MIN_Y,
  createThreeLaneLayoutFromYSettings,
  type PlayerLaneId
} from '../playerLaneMovement';
import { DebugLabScene } from './DebugLabScene';

const LANE_HIT_RADIUS = 20;
const LANE_COLORS: Record<PlayerLaneId, number> = {
  upper: 0x35d08f,
  middle: 0x64b5ff,
  lower: 0xf2c45b
};
const LANE_LABELS: Record<PlayerLaneId, string> = {
  upper: 'Upper',
  middle: 'Middle',
  lower: 'Lower'
};

export class LaneEditorScene extends DebugLabScene {
  private overlay: Phaser.GameObjects.Graphics | null = null;
  private readout: Phaser.GameObjects.Text | null = null;
  private readonly laneLabels: Partial<Record<PlayerLaneId, Phaser.GameObjects.Text>> =
    {};
  private draggingLaneId: PlayerLaneId | null = null;

  constructor() {
    super(SceneKeys.LaneEditor);
  }

  preload(): void {
    this.preloadDebugBackground();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.createDebugBackground('cover');
    this.overlay = this.add.graphics().setDepth(80).setScrollFactor(0);
    this.readout = this.createLabTitle('Lane Editor', 'three lane y positions');
    this.createLaneLabels();
    this.createPointerInput();
    this.createBackInput();
  }

  update(): void {
    this.syncDebugBackground('cover');
    this.drawLanes();
    this.updateReadout();
    this.debug.setPerformance({
      fps: this.game.loop.actualFps,
      physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
    });
  }

  private createLaneLabels(): void {
    for (const laneId of PLAYER_LANE_IDS) {
      this.laneLabels[laneId] = this.add
        .text(28, 0, '', {
          backgroundColor: 'rgba(2, 6, 23, 0.68)',
          color: '#f8fafc',
          fontFamily: 'Consolas, monospace',
          fontSize: '14px',
          padding: { x: 8, y: 5 }
        })
        .setDepth(95)
        .setScrollFactor(0);
    }
  }

  private createPointerInput(): void {
    const handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
      const worldY = this.getPointerWorldY(pointer);
      const laneId = this.pickLane(worldY);

      if (laneId === null) {
        return;
      }

      this.draggingLaneId = laneId;
      this.updateLaneFromPointer(worldY);
    };
    const handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
      if (this.draggingLaneId === null || !pointer.isDown) {
        return;
      }

      this.updateLaneFromPointer(this.getPointerWorldY(pointer));
    };
    const handlePointerUp = (): void => {
      if (this.draggingLaneId === null) {
        return;
      }

      this.persistLaneSettings();
      this.draggingLaneId = null;
    };

    this.input.on('pointerdown', handlePointerDown);
    this.input.on('pointermove', handlePointerMove);
    this.input.on('pointerup', handlePointerUp);
    this.input.on('pointerupoutside', handlePointerUp);
    this.input.on('pointercancel', handlePointerUp);
    this.trackCleanup(() => {
      this.input.off('pointerdown', handlePointerDown);
      this.input.off('pointermove', handlePointerMove);
      this.input.off('pointerup', handlePointerUp);
      this.input.off('pointerupoutside', handlePointerUp);
      this.input.off('pointercancel', handlePointerUp);
    });
  }

  private drawLanes(): void {
    const overlay = this.overlay;

    if (overlay === null) {
      return;
    }

    const { width, height } = this.profile;
    const settings = this.getLaneSettings();
    const layout = createThreeLaneLayoutFromYSettings(settings);
    const minY = THREE_LANE_MIN_Y;
    const maxY = Math.max(minY, height - THREE_LANE_BOTTOM_INSET);

    overlay.clear();
    this.drawGrid(overlay, 64, 0xffffff, 0.1);
    overlay.lineStyle(1, 0xff708c, 0.36);
    overlay.lineBetween(0, minY, width, minY);
    overlay.lineBetween(0, maxY, width, maxY);

    for (const lane of layout.lanes) {
      const isActive = lane.id === this.draggingLaneId;
      const color = LANE_COLORS[lane.id];
      const lineWidth = isActive ? 5 : 3;
      const alpha = isActive ? 0.98 : 0.84;

      overlay.fillStyle(color, isActive ? 0.2 : 0.11);
      overlay.fillRect(0, lane.y - LANE_HIT_RADIUS, width, LANE_HIT_RADIUS * 2);
      overlay.lineStyle(lineWidth, color, alpha);
      overlay.lineBetween(0, lane.y, width, lane.y);
      overlay.fillStyle(color, alpha);
      overlay.fillCircle(34, lane.y, isActive ? 9 : 7);
      overlay.fillCircle(width - 34, lane.y, isActive ? 9 : 7);
      overlay.fillTriangle(10, lane.y, 25, lane.y - 8, 25, lane.y + 8);
      overlay.fillTriangle(width - 10, lane.y, width - 25, lane.y - 8, width - 25, lane.y + 8);

      this.laneLabels[lane.id]?.setPosition(48, lane.y - 34).setText(
        `${LANE_LABELS[lane.id]}  y=${lane.y}`
      );
    }
  }

  private updateReadout(): void {
    const settings = this.getLaneSettings();
    const active = this.draggingLaneId === null ? 'ready' : `${this.draggingLaneId} drag`;

    this.readout?.setText(
      `upper ${settings.upperY} | middle ${settings.middleY} | lower ${settings.lowerY} | ${active}`
    );
  }

  private pickLane(pointerY: number): PlayerLaneId | null {
    const settings = this.getLaneSettings();
    const layout = createThreeLaneLayoutFromYSettings(settings);
    let picked: PlayerLaneId | null = null;
    let closestDistance = Number.POSITIVE_INFINITY;

    for (const lane of layout.lanes) {
      const distance = Math.abs(pointerY - lane.y);

      if (distance <= LANE_HIT_RADIUS && distance < closestDistance) {
        picked = lane.id;
        closestDistance = distance;
      }
    }

    return picked;
  }

  private getPointerWorldY(pointer: Phaser.Input.Pointer): number {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y).y;
  }

  private updateLaneFromPointer(pointerY: number): void {
    if (this.draggingLaneId === null) {
      return;
    }

    this.debug.setSandboxLaneSettings(
      this.createPatchedLaneSettings(this.draggingLaneId, pointerY)
    );
  }

  private createPatchedLaneSettings(
    laneId: PlayerLaneId,
    laneY: number
  ): SandboxLaneSettings {
    const settings = this.getLaneSettings();
    const roundedY = Math.round(laneY);

    switch (laneId) {
      case 'upper':
        return normalizeSandboxLaneSettings(
          { ...settings, upperY: roundedY },
          this.profile.height
        );
      case 'middle':
        return normalizeSandboxLaneSettings(
          { ...settings, middleY: roundedY },
          this.profile.height
        );
      case 'lower':
        return normalizeSandboxLaneSettings(
          { ...settings, lowerY: roundedY },
          this.profile.height
        );
    }
  }

  private persistLaneSettings(): void {
    const settings = this.getLaneSettings();

    try {
      this.debug.setSandboxLaneSettings(
        saveSandboxLaneSettings(this.profile.id, settings, this.profile.height)
      );
    } catch {
      this.debug.setSandboxLaneSettings(settings);
    }
  }

  private getLaneSettings(): SandboxLaneSettings {
    return normalizeSandboxLaneSettings(
      this.debug.get().sandboxLaneSettings,
      this.profile.height
    );
  }
}
