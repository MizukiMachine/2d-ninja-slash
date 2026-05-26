import Phaser from 'phaser';
import { SceneKeys } from '../sceneKeys';
import {
  createDebugElement,
  formatElementKind,
  getDebugLevel,
  getDebugLevelElements,
  normalizeElementEditorSettings,
  setDebugLevelElements,
  type DebugElementKind,
  type DebugLevelElement
} from '../debugFeatures';
import { DebugLabScene } from './DebugLabScene';

const NUDGE_STEP = 8;

export class ElementEditorScene extends DebugLabScene {
  private graphics: Phaser.GameObjects.Graphics | null = null;
  private readout: Phaser.GameObjects.Text | null = null;
  private labelTexts: Phaser.GameObjects.Text[] = [];
  private lastCommandSerial = 0;

  constructor() {
    super(SceneKeys.ElementEditor);
  }

  preload(): void {
    this.preloadDebugBackground();
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.createDebugBackground('cover');
    this.graphics = this.add.graphics().setDepth(70).setScrollFactor(0);
    this.readout = this.createLabTitle('Element Editor', 'rect-based gameplay markers');
    this.createBackInput();
    this.createPointerInput();
    this.createKeyboardInput();
  }

  update(): void {
    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);

    this.syncDebugBackground('cover');
    this.handleCommand(settings.commandSerial);
    this.drawElements(settings.showGrid, settings.showLabels, settings.showCollision);
    this.updateReadout();
    this.debug.setPerformance({
      fps: this.game.loop.actualFps,
      physicsBodies: this.physics.world.bodies.size + this.physics.world.staticBodies.size
    });
  }

  private createPointerInput(): void {
    const handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
      const selected = this.pickElement(pointer.x, pointer.y);

      if (selected !== null) {
        this.selectElement(selected.id);
        return;
      }

      const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);
      this.addElement(settings.selectedKind, pointer.x, pointer.y);
    };

    this.input.on('pointerdown', handlePointerDown);
    this.trackCleanup(() => {
      this.input.off('pointerdown', handlePointerDown);
    });
  }

  private createKeyboardInput(): void {
    const keyboard = this.input.keyboard;
    const deleteKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.DELETE);
    const duplicateKey = keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    const arrows = keyboard?.createCursorKeys();
    const deleteSelected = (): void => this.deleteSelectedElement();
    const duplicateSelected = (): void => this.duplicateSelectedElement();
    const nudgeFromKeyboard = (): void => {
      const dx = Number(arrows?.right.isDown) - Number(arrows?.left.isDown);
      const dy = Number(arrows?.down.isDown) - Number(arrows?.up.isDown);

      if (dx !== 0 || dy !== 0) {
        this.nudgeSelected(dx * NUDGE_STEP, dy * NUDGE_STEP);
      }
    };

    deleteKey?.on('down', deleteSelected);
    duplicateKey?.on('down', duplicateSelected);
    this.events.on(Phaser.Scenes.Events.UPDATE, nudgeFromKeyboard);
    this.trackCleanup(() => {
      deleteKey?.off('down', deleteSelected);
      duplicateKey?.off('down', duplicateSelected);
      this.events.off(Phaser.Scenes.Events.UPDATE, nudgeFromKeyboard);
    });
  }

  private handleCommand(commandSerial: number): void {
    if (commandSerial === this.lastCommandSerial) {
      return;
    }

    this.lastCommandSerial = commandSerial;
    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);

    switch (settings.command) {
      case 'add':
        this.addElement(settings.selectedKind, this.centerX, this.centerY);
        break;
      case 'delete':
        this.deleteSelectedElement();
        break;
      case 'duplicate':
        this.duplicateSelectedElement();
        break;
      case 'nudge':
        this.nudgeSelected(settings.nudgeX, settings.nudgeY);
        break;
      case 'none':
        break;
    }

    this.debug.setElementEditor({
      ...normalizeElementEditorSettings(this.debug.get().elementEditor),
      command: 'none'
    });
  }

  private drawElements(showGrid: boolean, showLabels: boolean, showCollision: boolean): void {
    const graphics = this.graphics;

    if (graphics === null) {
      return;
    }

    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);
    const elements = this.getSelectedLevelElements();

    graphics.clear();
    this.clearLabels();

    if (showGrid) {
      this.drawGrid(graphics, 32, 0xffffff, 0.1);
      this.drawGrid(graphics, 128, 0x64b5ff, 0.22);
    }

    for (const element of elements) {
      const selected = element.id === settings.selectedElementId;
      const color = getElementColor(element.kind);
      graphics.fillStyle(color, element.kind === 'hazard' ? 0.56 : 0.72);
      graphics.fillRect(element.x, element.y, element.width, element.height);
      graphics.lineStyle(selected ? 4 : 2, selected ? 0xffd447 : 0xf8fafc, selected ? 0.98 : 0.44);
      graphics.strokeRect(element.x, element.y, element.width, element.height);

      if (showCollision) {
        graphics.lineStyle(1, 0x05080d, 0.72);
        graphics.strokeRect(element.x + 3, element.y + 3, element.width - 6, element.height - 6);
      }

      if (showLabels) {
        this.labelTexts.push(
          this.add
            .text(element.x, element.y - 18, `${element.id} | ${formatElementKind(element.kind)}`, {
              backgroundColor: 'rgba(2, 6, 23, 0.66)',
              color: selected ? '#ffd447' : '#cbd5e1',
              fontFamily: 'Consolas, monospace',
              fontSize: '12px',
              padding: { x: 5, y: 3 }
            })
            .setDepth(100)
            .setScrollFactor(0)
        );
      }
    }
  }

  private updateReadout(): void {
    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);
    const level = getDebugLevel(settings.selectedLevelId);
    const elements = this.getSelectedLevelElements();
    const selected = elements.find((element) => element.id === settings.selectedElementId);

    this.readout?.setText(
      selected === undefined
        ? `${level.label} | ${elements.length} elements | ${formatElementKind(settings.selectedKind)}`
        : `${level.label} | ${selected.id} | ${formatElementKind(selected.kind)} | ${selected.width}x${selected.height} @ ${selected.x},${selected.y}`
    );
  }

  private addElement(kind: DebugElementKind, x: number, y: number): void {
    const elements = this.getSelectedLevelElements();
    const nextElement = createDebugElement(kind, x, y, this.computeNextSerial());
    this.setSelectedLevelElements([...elements, nextElement]);
    this.selectElement(nextElement.id);
  }

  private deleteSelectedElement(): void {
    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);

    if (settings.selectedElementId === null) {
      return;
    }

    const elements = this.getSelectedLevelElements().filter(
      (element) => element.id !== settings.selectedElementId
    );
    this.setSelectedLevelElements(elements);
    this.selectElement(elements.at(-1)?.id ?? null);
  }

  private duplicateSelectedElement(): void {
    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);
    const elements = this.getSelectedLevelElements();
    const source = elements.find((element) => element.id === settings.selectedElementId);

    if (source === undefined) {
      return;
    }

    const duplicate = {
      ...source,
      id: `${source.kind}-${String(this.computeNextSerial()).padStart(3, '0')}`,
      x: source.x + 24,
      y: source.y + 24,
      label: `${source.label} Copy`
    };
    this.setSelectedLevelElements([...elements, duplicate]);
    this.selectElement(duplicate.id);
  }

  private nudgeSelected(deltaX: number, deltaY: number): void {
    if (deltaX === 0 && deltaY === 0) {
      return;
    }

    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);

    if (settings.selectedElementId === null) {
      return;
    }

    this.setSelectedLevelElements(
      this.getSelectedLevelElements().map((element) =>
        element.id === settings.selectedElementId
          ? {
              ...element,
              x: Math.round(element.x + deltaX),
              y: Math.round(element.y + deltaY)
            }
          : element
      )
    );
  }

  private pickElement(x: number, y: number): DebugLevelElement | null {
    const elements = this.getSelectedLevelElements();

    for (let index = elements.length - 1; index >= 0; index -= 1) {
      const element = elements[index];

      if (
        x >= element.x &&
        x <= element.x + element.width &&
        y >= element.y &&
        y <= element.y + element.height
      ) {
        return element;
      }
    }

    return null;
  }

  private selectElement(selectedElementId: string | null): void {
    this.debug.setElementEditor({
      ...normalizeElementEditorSettings(this.debug.get().elementEditor),
      selectedElementId
    });
  }

  private computeNextSerial(): number {
    const elements = this.getSelectedLevelElements();
    const maxSerial = elements.reduce((max, element) => {
      const match = /-(\d+)$/u.exec(element.id);
      const serial = match === null ? 0 : Number(match[1]);

      return Math.max(max, Number.isFinite(serial) ? serial : 0);
    }, 0);

    return maxSerial + 1;
  }

  private getSelectedLevelElements(): readonly DebugLevelElement[] {
    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);

    return getDebugLevelElements(this.app.getDebugElementsConfig(), settings.selectedLevelId);
  }

  private setSelectedLevelElements(elements: readonly DebugLevelElement[]): void {
    const settings = normalizeElementEditorSettings(this.debug.get().elementEditor);

    this.app.setDebugElementsConfig(
      setDebugLevelElements(
        this.app.getDebugElementsConfig(),
        settings.selectedLevelId,
        elements
      )
    );
  }

  private clearLabels(): void {
    this.labelTexts.forEach((label) => label.destroy());
    this.labelTexts = [];
  }
}

function getElementColor(kind: DebugElementKind): number {
  switch (kind) {
    case 'platform':
      return 0x35d08f;
    case 'hazard':
      return 0xe56b6f;
    case 'pickup':
      return 0xf2c45b;
    case 'spawn':
      return 0x64b5ff;
    case 'goal':
      return 0x9f7aea;
    case 'enemy':
      return 0xff91d0;
  }
}
