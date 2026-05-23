import Phaser from 'phaser';
import { setAppContext, type AppContext } from '../app/context';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { SandboxScene } from './scenes/SandboxScene';
import { SettingsScene } from './scenes/SettingsScene';
import { SplashScene } from './scenes/SplashScene';

const KEYBOARD_CAPTURE_KEYS = [
  Phaser.Input.Keyboard.KeyCodes.W,
  Phaser.Input.Keyboard.KeyCodes.A,
  Phaser.Input.Keyboard.KeyCodes.S,
  Phaser.Input.Keyboard.KeyCodes.D,
  Phaser.Input.Keyboard.KeyCodes.UP,
  Phaser.Input.Keyboard.KeyCodes.DOWN,
  Phaser.Input.Keyboard.KeyCodes.LEFT,
  Phaser.Input.Keyboard.KeyCodes.RIGHT,
  Phaser.Input.Keyboard.KeyCodes.Z,
  Phaser.Input.Keyboard.KeyCodes.SHIFT,
  Phaser.Input.Keyboard.KeyCodes.ESC
] as const;

export interface CreateGameOptions {
  readonly parent: HTMLElement;
  readonly context: AppContext;
}

export function createGame({ parent, context }: CreateGameOptions): Phaser.Game {
  setAppContext(context);

  const profile = context.getProfile();

  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.WEBGL,
    parent,
    width: profile.width,
    height: profile.height,
    backgroundColor: '#101520',
    roundPixels: true,
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.NO_CENTER
    },
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    input: {
      keyboard: {
        capture: [...KEYBOARD_CAPTURE_KEYS]
      },
      mouse: true,
      touch: true,
      gamepad: false
    },
    scene: [BootScene, SplashScene, MainMenuScene, SandboxScene, SettingsScene]
  };

  return new Phaser.Game(config);
}
