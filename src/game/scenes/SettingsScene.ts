import Phaser from 'phaser';
import { BaseScene } from './BaseScene';
import { SceneKeys } from '../sceneKeys';
import type { SettingsState } from '../../stores/settingsStore';

export class SettingsScene extends BaseScene {
  private volumeText: Phaser.GameObjects.Text | null = null;
  private mutedText: Phaser.GameObjects.Text | null = null;
  private bgmText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super(SceneKeys.Settings);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#101722');
    this.addTitle('Settings', this.centerY - 232);

    this.volumeText = this.addLabel('', this.centerY - 150);
    this.mutedText = this.addLabel('', this.centerY - 100);
    this.bgmText = this.addLabel('', this.centerY - 50);

    this.createTextButton({
      x: this.centerX - 86,
      y: this.centerY + 8,
      label: '-',
      width: 76,
      onClick: () => this.settings.decreaseVolume()
    });

    this.createTextButton({
      x: this.centerX + 86,
      y: this.centerY + 8,
      label: '+',
      width: 76,
      onClick: () => this.settings.increaseVolume()
    });

    this.createTextButton({
      x: this.centerX - 86,
      y: this.centerY + 82,
      label: 'Mute',
      width: 152,
      onClick: () => this.settings.toggleMuted()
    });

    this.createTextButton({
      x: this.centerX + 86,
      y: this.centerY + 82,
      label: 'Toggle BGM',
      width: 152,
      onClick: () => this.settings.toggleBgm()
    });

    this.createTextButton({
      x: this.centerX,
      y: this.centerY + 158,
      label: 'Reset',
      onClick: () => this.settings.reset()
    });

    this.createTextButton({
      x: this.centerX,
      y: this.centerY + 232,
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
    this.bgmText?.setText(settings.bgmEnabled ? 'BGM: ON' : 'BGM: OFF');
  }
}
