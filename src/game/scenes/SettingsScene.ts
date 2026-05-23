import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import type { SettingsState } from '../../stores/settingsStore';

export class SettingsScene extends BaseScene {
  private volumeText: Phaser.GameObjects.Text | null = null;
  private mutedText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SceneKeys.Settings);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.addTitle('Settings', this.centerY - 206);

    this.volumeText = this.addLabel('', this.centerY - 118);
    this.mutedText = this.addLabel('', this.centerY - 62);

    this.createTextButton({
      x: this.centerX - 86,
      y: this.centerY + 10,
      label: '-',
      width: 76,
      onClick: () => this.settings.decreaseVolume()
    });

    this.createTextButton({
      x: this.centerX + 86,
      y: this.centerY + 10,
      label: '+',
      width: 76,
      onClick: () => this.settings.increaseVolume()
    });

    this.createTextButton({
      x: this.centerX,
      y: this.centerY + 92,
      label: 'Mute',
      onClick: () => this.settings.toggleMuted()
    });

    this.createTextButton({
      x: this.centerX,
      y: this.centerY + 174,
      label: 'Reset',
      onClick: () => this.settings.reset()
    });

    this.createTextButton({
      x: this.centerX,
      y: this.centerY + 256,
      label: 'Back',
      onClick: () => this.goTo(SceneKeys.MainMenu)
    });

    this.onStore(this.settings, (settings) => {
      this.renderSettings(settings);
    });
  }

  private renderSettings(settings: SettingsState): void {
    const volumePercent = Math.round(settings.volume * 100);
    this.volumeText?.setText(`Volume ${volumePercent}%`);
    this.mutedText?.setText(settings.muted ? 'Muted On' : 'Muted Off');
  }
}
