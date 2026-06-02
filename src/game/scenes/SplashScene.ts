import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import { GAME_SUBTITLE, GAME_TITLE } from '../gameTitle';

export class SplashScene extends BaseScene {
  constructor() {
    super(SceneKeys.Splash);
  }

  protected override shouldSyncDebugBgm(): boolean {
    return false;
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101520');
    this.addTitle(GAME_TITLE, this.centerY - 28);
    this.addLabel(GAME_SUBTITLE, this.centerY + 30);

    this.time.delayedCall(650, () => {
      this.goTo(this.app.getInitialScene?.() ?? SceneKeys.MainMenu);
    });
  }
}
