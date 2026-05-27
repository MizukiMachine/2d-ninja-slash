export const SceneKeys = {
  Boot: 'Boot',
  Splash: 'Splash',
  MainMenu: 'MainMenu',
  Sandbox: 'Sandbox',
  Gym: 'Gym',
  LaneEditor: 'LaneEditor',
  LevelProgress: 'LevelProgress',
  ElementEditor: 'ElementEditor',
  BackgroundLab: 'BackgroundLab',
  RunnerLab: 'RunnerLab',
  BaselineLevel: 'BaselineLevel',
  Settings: 'Settings'
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
