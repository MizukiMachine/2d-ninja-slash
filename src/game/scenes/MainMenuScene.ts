import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';

export class MainMenuScene extends BaseScene {
  constructor() {
    super(SceneKeys.MainMenu);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#111827');
    this.addTitle('2D Game Starter', this.centerY - 150);
    this.addLabel(`${this.profile.width} x ${this.profile.height}`, this.centerY - 96);

    this.createTextButton({
      x: this.centerX,
      y: this.centerY - 54,
      label: 'Sandbox',
      onClick: () => this.goTo(SceneKeys.Sandbox)
    });

    this.createTextButton({
      x: this.centerX,
      y: this.centerY + 18,
      label: 'Gym',
      onClick: () => this.goTo(SceneKeys.Gym)
    });

    this.createTextButton({
      x: this.centerX,
      y: this.centerY + 90,
      label: 'Settings',
      onClick: () => this.goTo(SceneKeys.Settings)
    });
  }
}
