export type ProfileId = 'landscape' | 'portrait';

export interface GameProfile {
  readonly id: ProfileId;
  readonly label: string;
  readonly width: number;
  readonly height: number;
}

export const GAME_PROFILES = {
  landscape: {
    id: 'landscape',
    label: 'Landscape 1280x720',
    width: 1280,
    height: 720
  },
  portrait: {
    id: 'portrait',
    label: 'Portrait 720x1280',
    width: 720,
    height: 1280
  }
} as const satisfies Record<ProfileId, GameProfile>;

export const DEFAULT_PROFILE_ID: ProfileId = 'landscape';

export function getProfileById(profileId: ProfileId): GameProfile {
  return GAME_PROFILES[profileId];
}

export function isProfileId(value: string): value is ProfileId {
  return Object.hasOwn(GAME_PROFILES, value);
}
