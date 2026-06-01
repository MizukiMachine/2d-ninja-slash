import type { Room } from '@colyseus/sdk';

export const DUEL_ROOM_NAME = 'duel';
export const MULTIPLAYER_MAX_HEALTH = 5;

export type MultiplayerPhase = 'waiting' | 'countdown' | 'fighting' | 'finished';
export type MultiplayerLaneId = 'upper' | 'middle' | 'lower';
export type MultiplayerFacing = 'left' | 'right';
export type MultiplayerAction = 'idle' | 'run' | 'jump' | 'slash' | 'hurt' | 'dead';

export interface MultiplayerPlayerState {
  readonly id: string;
  readonly name: string;
  readonly slot: number;
  readonly connected: boolean;
  readonly x: number;
  readonly y: number;
  readonly lane: MultiplayerLaneId;
  readonly facing: MultiplayerFacing;
  readonly action: MultiplayerAction;
  readonly hp: number;
  readonly attackSeq: number;
  readonly jumpSeq: number;
  readonly hurtSeq: number;
  readonly wins: number;
}

export interface MultiplayerPlayerCollection {
  readonly size: number;
  get(sessionId: string): MultiplayerPlayerState | undefined;
  forEach(
    callback: (player: MultiplayerPlayerState, sessionId: string) => void
  ): void;
}

export interface MultiplayerState {
  readonly players: MultiplayerPlayerCollection;
  readonly phase: MultiplayerPhase;
  readonly countdownMs: number;
  readonly elapsedMs: number;
  readonly winnerId: string;
  readonly status: string;
}

export type MultiplayerRoom = Room<unknown, MultiplayerState>;

export interface HitMessage {
  readonly attackerId: string;
  readonly targetId: string;
  readonly hp: number;
}

export interface SwingMessage {
  readonly attackerId: string;
}
