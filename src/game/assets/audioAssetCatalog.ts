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

export const COMBAT_BGM_VOLUME = 0.08;
export const GAME_OVER_BGM_VOLUME = 0.15;

export const BGM_TRACKS = [
  {
    id: 'boss-duel',
    key: 'bgm.bossDuel',
    label: 'Boss Duel',
    path: '/assets/bgm/boss-duel.mp3',
    filePath: 'public/assets/bgm/boss-duel.mp3',
    volume: COMBAT_BGM_VOLUME,
    loop: true,
    durationMs: 90_000,
    theme: 'immediate boss duel melody with heavy war drums'
  }
] as const satisfies readonly BgmTrack[];

export const GAME_OVER_BGM_TRACK = {
  id: 'game-over-lament',
  key: 'bgm.gameOverLament',
  label: 'Game Over Lament',
  path: '/assets/bgm/game-over-lament.wav',
  filePath: 'public/assets/bgm/game-over-lament.wav',
  volume: GAME_OVER_BGM_VOLUME,
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

export const DEFAULT_BGM_TRACK_ID: BgmTrackId = 'boss-duel';

// SFX volumes are loudness-normalized: each `volume` is calibrated so every cue
// plays at a consistent perceived loudness (~-20 dB windowed RMS) with a -1 dBFS
// peak ceiling to prevent clipping at master volume 1.0. Values may exceed 1.0 to
// boost quiet source files (Phaser's WebAudio gain is uncapped). Re-derive these
// after replacing a source file by measuring its loudness/peak.
export const SFX_CUES = [
  {
    id: 'ui-select',
    key: 'sfx.uiSelect',
    label: 'UI Select',
    path: '/assets/sfx/ui-select-v2.mp3',
    filePath: 'public/assets/sfx/ui-select-v2.mp3',
    volume: 0.891,
    theme: 'short crisp wooden menu tap'
  },
  {
    id: 'player-slash',
    key: 'sfx.playerSlash',
    label: 'Player Slash',
    path: '/assets/sfx/player-slash.mp3',
    filePath: 'public/assets/sfx/player-slash.mp3',
    volume: 0.405,
    theme: 'katana slash air whoosh'
  },
  {
    id: 'enemy-slash',
    key: 'sfx.enemySlash',
    label: 'Enemy Slash',
    path: '/assets/sfx/enemy-slash.mp3',
    filePath: 'public/assets/sfx/enemy-slash.mp3',
    volume: 0.241,
    theme: 'lower pitched hostile blade swing'
  },
  {
    id: 'jump',
    key: 'sfx.jump',
    label: 'Jump',
    path: '/assets/sfx/jump.mp3',
    filePath: 'public/assets/sfx/jump.mp3',
    volume: 0.484,
    theme: 'cloth burst ninja jump'
  },
  {
    id: 'lane-dash',
    key: 'sfx.laneDash',
    label: 'Lane Dash',
    path: '/assets/sfx/lane-dash.mp3',
    filePath: 'public/assets/sfx/lane-dash.mp3',
    volume: 2.095,
    theme: 'quick evasive dash with fabric snap'
  },
  {
    id: 'hit',
    key: 'sfx.hit',
    label: 'Hit',
    path: '/assets/sfx/hit.mp3',
    filePath: 'public/assets/sfx/hit.mp3',
    volume: 0.433,
    theme: 'sharp blade impact on armor'
  },
  {
    id: 'player-hurt',
    key: 'sfx.playerHurt',
    label: 'Player Hurt',
    path: '/assets/sfx/player-hurt.mp3',
    filePath: 'public/assets/sfx/player-hurt.mp3',
    volume: 0.309,
    theme: 'impact thud with breath hit'
  },
  {
    id: 'enemy-defeat',
    key: 'sfx.enemyDefeat',
    label: 'Enemy Defeat',
    path: '/assets/sfx/enemy-defeat-deep.mp3',
    filePath: 'public/assets/sfx/enemy-defeat-deep.mp3',
    volume: 0.211,
    theme: 'deep heavy ninja fall with low metallic clang and sub-bass impact'
  },
  {
    id: 'player-defeat',
    key: 'sfx.playerDefeat',
    label: 'Player Defeat',
    path: '/assets/sfx/player-defeat.mp3',
    filePath: 'public/assets/sfx/player-defeat.mp3',
    volume: 1.52,
    theme: 'somber defeat hit with low drum'
  },
  {
    id: 'main-ninja-death',
    key: 'sfx.mainNinjaDeath',
    label: 'Main Ninja Death',
    path: '/assets/sfx/main-ninja-death.mp3',
    filePath: 'public/assets/sfx/main-ninja-death.mp3',
    volume: 0.325,
    theme: 'main ninja death fall with cloth slump and low drum'
  },
  {
    id: 'round-clear',
    key: 'sfx.roundClear',
    label: 'Round Clear',
    path: '/assets/sfx/round-clear-loud.wav',
    filePath: 'public/assets/sfx/round-clear-loud.wav',
    volume: 0.99,
    theme: 'extra dry sharp hyoshigi wooden clapper double hit round transition'
  },
  {
    id: 'round-start',
    key: 'sfx.roundStart',
    label: 'Round Start (Hyoshigi)',
    path: '/assets/sfx/round-start-loud.wav',
    filePath: 'public/assets/sfx/round-start-loud.wav',
    volume: 0.99,
    theme: 'extra dry sharp hyoshigi wooden clapper round start cue'
  },
  {
    id: 'round-start-taiko',
    key: 'sfx.roundStartTaiko',
    label: 'Round Start (Taiko)',
    path: '/assets/sfx/round-start-v2.mp3',
    filePath: 'public/assets/sfx/round-start-v2.mp3',
    volume: 0.248,
    theme: 'deep taiko boom with hyoshigi clack and rising shakuhachi swell, battle round start'
  },
  {
    id: 'round-start-gong',
    key: 'sfx.roundStartGong',
    label: 'Round Start (Gong)',
    path: '/assets/sfx/round-start-B.mp3',
    filePath: 'public/assets/sfx/round-start-B.mp3',
    volume: 0.391,
    theme: 'resonant temple gong strike with taiko roll buildup, dramatic moonlit duel start'
  },
  {
    id: 'hyoshigi-preview',
    key: 'sfx.hyoshigiPreview',
    label: 'Hyoshigi',
    path: '/assets/sfx/hyoshigi-preview.wav',
    filePath: 'public/assets/sfx/hyoshigi-preview.wav',
    volume: 0.99,
    theme: 'extra dry hyoshigi wooden clapper preview double hit'
  },
  {
    id: 'kotsuzumi-preview',
    key: 'sfx.kotsuzumiPreview',
    label: 'Kotsuzumi',
    path: '/assets/sfx/kotsuzumi-preview.wav',
    filePath: 'public/assets/sfx/kotsuzumi-preview.wav',
    volume: 0.699,
    theme: 'dry small kotsuzumi hand drum preview with short skin resonance'
  }
] as const satisfies readonly SfxCue[];

export type SfxCueId = (typeof SFX_CUES)[number]['id'];

export const SFX_COMPARE_CUE_IDS = [
  'hyoshigi-preview',
  'kotsuzumi-preview'
] as const satisfies readonly SfxCueId[];

export function isBgmTrackId(value: string): value is BgmTrackId {
  return ALL_BGM_TRACKS.some((track) => track.id === value);
}

export function isSfxCueId(value: string): value is SfxCueId {
  return SFX_CUES.some((cue) => cue.id === value);
}

export function getBgmTrack(id: BgmTrackId): BgmTrack {
  return ALL_BGM_TRACKS.find((track) => track.id === id) ?? BGM_TRACKS[0];
}

export function getSfxCue(id: SfxCueId): SfxCue {
  return SFX_CUES.find((cue) => cue.id === id) ?? SFX_CUES[0];
}
