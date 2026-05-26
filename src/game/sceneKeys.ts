export const SceneKeys = {
  Boot: 'Boot',
  Splash: 'Splash',
  MainMenu: 'MainMenu',
  Sandbox: 'Sandbox',
  Gym: 'Gym',
  Settings: 'Settings'
} as const;

export type SceneKey = (typeof SceneKeys)[keyof typeof SceneKeys];
