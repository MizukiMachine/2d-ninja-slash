import { schema, type SchemaType } from '@colyseus/schema';

export const BATTLE_ROOM_NAME = 'duel';
export const BATTLE_MAX_HEALTH = 5;

export type BattlePhase = 'waiting' | 'countdown' | 'fighting' | 'finished';
export type BattleLaneId = 'upper' | 'middle' | 'lower';
export type BattleFacing = 'left' | 'right';
export type BattleAction = 'idle' | 'run' | 'jump' | 'slash' | 'hurt' | 'dead';

export const BattlePlayerState = schema(
  {
    id: { type: 'string', default: '' },
    name: { type: 'string', default: '' },
    slot: { type: 'number', default: 0 },
    connected: { type: 'boolean', default: true },
    x: { type: 'number', default: 0 },
    y: { type: 'number', default: 0 },
    lane: { type: 'string', default: 'middle' },
    facing: { type: 'string', default: 'right' },
    action: { type: 'string', default: 'idle' },
    hp: { type: 'number', default: BATTLE_MAX_HEALTH },
    attackSeq: { type: 'number', default: 0 },
    jumpSeq: { type: 'number', default: 0 },
    hurtSeq: { type: 'number', default: 0 },
    wins: { type: 'number', default: 0 },
    readyForRematch: { type: 'boolean', default: false }
  },
  'BattlePlayerState'
);

export type BattlePlayerState = SchemaType<typeof BattlePlayerState>;

export const BattleState = schema(
  {
    players: { map: BattlePlayerState },
    phase: { type: 'string', default: 'waiting' },
    countdownMs: { type: 'number', default: 0 },
    elapsedMs: { type: 'number', default: 0 },
    winnerId: { type: 'string', default: '' },
    status: { type: 'string', default: 'Waiting for opponent' }
  },
  'BattleState'
);

export type BattleState = SchemaType<typeof BattleState>;
