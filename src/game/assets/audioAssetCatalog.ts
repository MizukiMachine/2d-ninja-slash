export interface BgmTrack {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly filePath: string;
  readonly volume: number;
  readonly loop: true;
  readonly durationMs: number;
  readonly theme: string;
}

export interface SfxCue {
  readonly id: string;
  readonly key: string;
  readonly label: string;
  readonly path: string;
  readonly filePath: string;
  readonly volume: number;
  readonly theme: string;
}

export const BGM_TRACKS = [
  {
    id: 'shadow-dojo',
    key: 'bgm.shadowDojo',
    label: 'Shadow Dojo',
    path: '/assets/bgm/shadow-dojo.mp3',
    filePath: 'public/assets/bgm/shadow-dojo.mp3',
    volume: 0.42,
    loop: true,
    durationMs: 90_000,
    theme: 'taiko and shakuhachi stealth combat loop'
  },
  {
    id: 'moonlit-pursuit',
    key: 'bgm.moonlitPursuit',
    label: 'Moonlit Pursuit',
    path: '/assets/bgm/moonlit-pursuit.mp3',
    filePath: 'public/assets/bgm/moonlit-pursuit.mp3',
    volume: 0.4,
    loop: true,
    durationMs: 90_000,
    theme: 'fast ninja chase with koto plucks and percussion'
  },
  {
    id: 'bamboo-ambush',
    key: 'bgm.bambooAmbush',
    label: 'Bamboo Ambush',
    path: '/assets/bgm/bamboo-ambush.mp3',
    filePath: 'public/assets/bgm/bamboo-ambush.mp3',
    volume: 0.38,
    loop: true,
    durationMs: 90_000,
    theme: 'tense bamboo forest ambush groove'
  },
  {
    id: 'boss-duel',
    key: 'bgm.bossDuel',
    label: 'Boss Duel',
    path: '/assets/bgm/boss-duel.mp3',
    filePath: 'public/assets/bgm/boss-duel.mp3',
    volume: 0.4,
    loop: true,
    durationMs: 90_000,
    theme: 'dramatic duel rhythm with heavy war drums'
  }
] as const satisfies readonly BgmTrack[];

export const GAME_OVER_BGM_TRACK = {
  id: 'game-over-lament',
  key: 'bgm.gameOverLament',
  label: 'Game Over Lament',
  path: '/assets/bgm/game-over-lament.mp3',
  filePath: 'public/assets/bgm/game-over-lament.mp3',
  volume: 0.44,
  loop: true,
  durationMs: 60_000,
  theme: 'somber shinobi defeat lament with low taiko and distant flute'
} as const satisfies BgmTrack;

export const GAME_OVER_BGM_TRACK_ID = GAME_OVER_BGM_TRACK.id;

export const ALL_BGM_TRACKS = [
  ...BGM_TRACKS,
  GAME_OVER_BGM_TRACK
] as const satisfies readonly BgmTrack[];

export type BgmTrackId = (typeof ALL_BGM_TRACKS)[number]['id'];

export const DEFAULT_BGM_TRACK_ID: BgmTrackId = 'shadow-dojo';

export const SFX_CUES = [
  {
    id: 'ui-select',
    key: 'sfx.uiSelect',
    label: 'UI Select',
    path: '/assets/sfx/ui-select.mp3',
    filePath: 'public/assets/sfx/ui-select.mp3',
    volume: 0.36,
    theme: 'short wooden menu tap'
  },
  {
    id: 'player-slash',
    key: 'sfx.playerSlash',
    label: 'Player Slash',
    path: '/assets/sfx/player-slash.mp3',
    filePath: 'public/assets/sfx/player-slash.mp3',
    volume: 0.56,
    theme: 'katana slash air whoosh'
  },
  {
    id: 'enemy-slash',
    key: 'sfx.enemySlash',
    label: 'Enemy Slash',
    path: '/assets/sfx/enemy-slash.mp3',
    filePath: 'public/assets/sfx/enemy-slash.mp3',
    volume: 0.49,
    theme: 'lower pitched hostile blade swing'
  },
  {
    id: 'jump',
    key: 'sfx.jump',
    label: 'Jump',
    path: '/assets/sfx/jump.mp3',
    filePath: 'public/assets/sfx/jump.mp3',
    volume: 0.41,
    theme: 'cloth burst ninja jump'
  },
  {
    id: 'lane-dash',
    key: 'sfx.laneDash',
    label: 'Lane Dash',
    path: '/assets/sfx/lane-dash.mp3',
    filePath: 'public/assets/sfx/lane-dash.mp3',
    volume: 0.43,
    theme: 'quick evasive dash with fabric snap'
  },
  {
    id: 'hit',
    key: 'sfx.hit',
    label: 'Hit',
    path: '/assets/sfx/hit.mp3',
    filePath: 'public/assets/sfx/hit.mp3',
    volume: 0.54,
    theme: 'sharp blade impact on armor'
  },
  {
    id: 'player-hurt',
    key: 'sfx.playerHurt',
    label: 'Player Hurt',
    path: '/assets/sfx/player-hurt.mp3',
    filePath: 'public/assets/sfx/player-hurt.mp3',
    volume: 0.53,
    theme: 'impact thud with breath hit'
  },
  {
    id: 'enemy-defeat',
    key: 'sfx.enemyDefeat',
    label: 'Enemy Defeat',
    path: '/assets/sfx/enemy-defeat-loud.mp3',
    filePath: 'public/assets/sfx/enemy-defeat-loud.mp3',
    volume: 0.85,
    theme: 'defeated ninja fall with metal ring'
  },
  {
    id: 'player-defeat',
    key: 'sfx.playerDefeat',
    label: 'Player Defeat',
    path: '/assets/sfx/player-defeat.mp3',
    filePath: 'public/assets/sfx/player-defeat.mp3',
    volume: 0.61,
    theme: 'somber defeat hit with low drum'
  },
  {
    id: 'main-ninja-death',
    key: 'sfx.mainNinjaDeath',
    label: 'Main Ninja Death',
    path: '/assets/sfx/main-ninja-death.mp3',
    filePath: 'public/assets/sfx/main-ninja-death.mp3',
    volume: 0.63,
    theme: 'main ninja death fall with cloth slump and low drum'
  },
  {
    id: 'round-clear',
    key: 'sfx.roundClear',
    label: 'Round Clear',
    path: '/assets/sfx/round-clear-loud.wav',
    filePath: 'public/assets/sfx/round-clear-loud.wav',
    volume: 0.9,
    theme: 'louder soft higher taiko double hit round transition'
  },
  {
    id: 'round-start',
    key: 'sfx.roundStart',
    label: 'Round Start',
    path: '/assets/sfx/round-start-loud.wav',
    filePath: 'public/assets/sfx/round-start-loud.wav',
    volume: 0.82,
    theme: 'louder soft higher taiko round start pulse'
  }
] as const satisfies readonly SfxCue[];

export type SfxCueId = (typeof SFX_CUES)[number]['id'];

export function isBgmTrackId(value: string): value is BgmTrackId {
  return ALL_BGM_TRACKS.some((track) => track.id === value);
}

export function getBgmTrack(id: BgmTrackId): BgmTrack {
  return ALL_BGM_TRACKS.find((track) => track.id === id) ?? BGM_TRACKS[0];
}

export function getSfxCue(id: SfxCueId): SfxCue {
  return SFX_CUES.find((cue) => cue.id === id) ?? SFX_CUES[0];
}
