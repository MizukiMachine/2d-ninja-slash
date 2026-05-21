import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';

export class SplashScene extends BaseScene {
  constructor() {
    super(SceneKeys.Splash);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101520');
    this.addTitle('Phaser 4 Starter', this.centerY - 28);
    this.addLabel(`${this.profile.label}`, this.centerY + 30);

    this.time.delayedCall(650, () => {
      this.goTo(SceneKeys.MainMenu);
    });
  }
}
