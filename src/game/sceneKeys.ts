export const SceneKeys = {
  Boot: 'Boot',
  Splash: 'Splash',
  MainMenu: 'MainMenu',
  Sandbox: 'Sandbox',
  Multiplayer: 'Multiplayer',
  Gym: 'Gym',
  LaneEditor: 'LaneEditor',
  Settings: 'Settings'
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
