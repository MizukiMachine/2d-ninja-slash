import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import { loadGameFonts } from '../gameFonts';

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
    void this.completeBoot();
  }

  private async completeBoot(): Promise<void> {
    await loadGameFonts();
    this.goTo(SceneKeys.Splash);
  }
}
