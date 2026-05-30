import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import { loadGameFonts } from '../gameFonts';
import { SandboxScene } from './SandboxScene';

export class BootScene extends BaseScene {
  constructor() {
    super(SceneKeys.Boot);
  }

  preload(): void {
    // Paint the loading background immediately and show a progress overlay, so
    // the first load (the longest one — ~30 PNGs + audio, possibly over a cold
    // CDN on a fresh deploy) shows visible feedback instead of a blank/black
    // screen. The loader auto-runs after preload(); the overlay tracks its %.
    this.cameras.main.setBackgroundColor('#101520');
    this.showLoadingOverlay();

    this.preloadAudioAssets();
    // Front-load the gameplay actor spritesheets and the active background here,
    // during the dedicated boot/loading phase, alongside the audio. Otherwise
    // they only load the first time SandboxScene is entered, decoding ~30 PNGs
    // in one synchronous burst — the visible "startup slowdown". SandboxScene's
    // own loads are cache-guarded, so this simply moves the cost off the hot path.
    SandboxScene.queueGameplayAssets(this, this.debug.get().backgroundFileName);
  }

  create(): void {
    this.hideLoadingOverlay();
    this.cameras.main.setBackgroundColor('#101520');

    // If a gameplay asset failed to arrive, building the animations now would
    // create broken/empty frames and every later scene would render black with
    // no explanation. Surface a retry prompt instead of proceeding silently.
    if (this.didLoadFail()) {
      this.showLoadErrorOverlay();
      return;
    }

    this.debug.resetRuntime();
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
