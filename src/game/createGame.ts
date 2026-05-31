import Phaser from 'phaser';
import { setAppContext, type AppContext } from '../app/context';
import { BootScene } from './scenes/BootScene';
import { GymScene } from './scenes/GymScene';
import { LaneEditorScene } from './scenes/LaneEditorScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { MultiplayerScene } from './scenes/MultiplayerScene';
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
  Phaser.Input.Keyboard.KeyCodes.SPACE,
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
    // Disable Phaser's delta smoothing. With smoothStep on (the default), every
    // `focus`/visibility event re-arms a 120-frame "cooldown" during which the
    // per-frame delta is clamped down to the 60fps target (see TimeStep.smoothDelta).
    // Clicking "Start" fires a window focus event right as SandboxScene does its
    // heaviest first-frame work (spritesheet GPU uploads, BGM start, HUD build),
    // briefly dropping below 60fps — and the clamp then advances game time slower
    // than real time, which reads as a whole-screen slow-motion for ~2-4s at start.
    // Measured: 61% speed across the cooldown window. Turning smoothing off makes a
    // startup hitch a single small skip instead (invisible while actors stand idle).
    fps: {
      smoothStep: false
    },
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
      activePointers: 4,
      keyboard: {
        capture: [...KEYBOARD_CAPTURE_KEYS]
      },
      mouse: true,
      touch: true,
      gamepad: false
    },
    scene: [
      BootScene,
      SplashScene,
      MainMenuScene,
      SandboxScene,
      MultiplayerScene,
      GymScene,
      LaneEditorScene,
      SettingsScene
    ]
  };

  return new Phaser.Game(config);
}
