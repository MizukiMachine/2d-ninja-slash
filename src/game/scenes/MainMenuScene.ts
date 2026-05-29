import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';

export class MainMenuScene extends BaseScene {
  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#111827');
    this.addTitle('2D Ninja Slash', 86);
    this.addLabel(`${this.profile.width} x ${this.profile.height}`, 132);

    const buttons = [
      { label: 'Sandbox', scene: SceneKeys.Sandbox },
      { label: 'Ninja Gym', scene: SceneKeys.Gym },
      { label: 'Lane Editor', scene: SceneKeys.LaneEditor },
      { label: 'Settings', scene: SceneKeys.Settings }
    ] as const;
    const columns = this.profile.width >= 900 ? 2 : 1;
    const buttonWidth = columns === 2 ? 286 : 300;
    const buttonHeight = 52;
    const gapX = 28;
    const gapY = 16;
    const totalWidth = columns * buttonWidth + (columns - 1) * gapX;
    const startX = this.centerX - totalWidth / 2 + buttonWidth / 2;
    const startY = this.profile.width >= 900 ? 226 : 206;

    buttons.forEach((button, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);

      this.createTextButton({
        x: startX + column * (buttonWidth + gapX),
        y: startY + row * (buttonHeight + gapY),
        label: button.label,
        width: buttonWidth,
        height: buttonHeight,
        onClick: () => this.goTo(button.scene)
      });
    });
  }
}
