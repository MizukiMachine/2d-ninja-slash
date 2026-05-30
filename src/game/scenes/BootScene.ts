import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import { loadGameFonts } from '../gameFonts';
import { SandboxScene } from './SandboxScene';

export class BootScene extends BaseScene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    this.preloadAudioAssets();
    // Front-load the gameplay actor spritesheets and the active background here,
    // during the dedicated boot/loading phase, alongside the audio. Otherwise
    // they only load the first time SandboxScene is entered, decoding ~30 PNGs
    // in one synchronous burst — the visible "startup slowdown". SandboxScene's
    // own loads are cache-guarded, so this simply moves the cost off the hot path.
    SandboxScene.queueGameplayAssets(this, this.debug.get().backgroundFileName);
  }

  create(): void {
    this.debug.resetRuntime();
    this.cameras.main.setBackgroundColor('#101520');
    // Build the actor animations now (on the shared animation manager) so the
    // first SandboxScene entry has nothing to construct on its first frame.
    SandboxScene.createGameplayAnimations(this);
    void this.completeBoot();
  }

  private async completeBoot(): Promise<void> {
    await loadGameFonts();
    this.goTo(SceneKeys.Splash);
  }
}
