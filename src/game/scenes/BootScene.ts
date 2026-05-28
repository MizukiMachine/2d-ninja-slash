import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';

export class BootScene extends BaseScene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    this.preloadAudioAssets();
  }

  create(): void {
    this.debug.resetRuntime();
    this.cameras.main.setBackgroundColor('#101520');
    this.goTo(SceneKeys.Splash);
  }
}
