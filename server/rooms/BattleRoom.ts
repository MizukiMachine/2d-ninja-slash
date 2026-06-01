import { Client, Room } from 'colyseus';
import {
  BATTLE_MAX_HEALTH,
  BattlePlayerState,
  BattleState,
  type BattleAction,
  type BattleFacing,
  type BattleLaneId
} from './BattleState.js';

export interface MovementInput {
  readonly left?: boolean;
  readonly right?: boolean;
}

interface LaneInput {
  readonly direction?: 'up' | 'down';
}

export interface PlayerIntent {
  readonly left: boolean;
  readonly right: boolean;
  readonly lastNonZeroDirection: -1 | 0 | 1;
  readonly activeUntilMs: number;
}

interface PendingAttack {
  readonly attackerId: string;
  readonly resolveAtMs: number;
}

const WORLD_WIDTH = 1280;
const PLAYER_MIN_X = 58;
const PLAYER_MAX_X = WORLD_WIDTH - PLAYER_MIN_X;
const PLAYER_SPEED = 260;
const ATTACK_RANGE = 180;
const ATTACK_BACK_REACH = 18;
export const BATTLE_DAMAGE_KNOCKBACK_DISTANCE = 160;
const ATTACK_COOLDOWN_MS = 920;
const ATTACK_ACTION_MS = 900;
const MAIN_NINJA_ATTACK_HIT_DELAY_MS = 360;
const ENEMY_NINJA_ATTACK_HIT_DELAY_MS = 420;
const HURT_ACTION_MS = 680;
const JUMP_ACTION_MS = 760;
const COUNTDOWN_MS = 1800;
const RECONNECT_SECONDS = 20;
export const MOVEMENT_INPUT_GRACE_MS = 120;

const LANES: Readonly<Record<BattleLaneId, number>> = {
  upper: 372,
  middle: 501,
  lower: 648
};

const LANE_ORDER: readonly BattleLaneId[] = ['upper', 'middle', 'lower'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function sanitizePlayerName(name: unknown, fallback: string): string {
  if (typeof name !== 'string') {
    return fallback;
  }

  const trimmed = name.trim();

  return trimmed.length > 0 ? trimmed.slice(0, 16) : fallback;
}

export function createIdleMovementIntent(): PlayerIntent {
  return {
    left: false,
    right: false,
    lastNonZeroDirection: 0,
    activeUntilMs: Number.NEGATIVE_INFINITY
  };
}

export function createMovementIntent(
  input: MovementInput,
  previous: PlayerIntent | undefined,
  clockMs: number
): PlayerIntent {
  const left = input.left === true;
  const right = input.right === true;
  const rawDirection = Number(right) - Number(left) as -1 | 0 | 1;

  if (rawDirection !== 0) {
    return {
      left,
      right,
      lastNonZeroDirection: rawDirection,
      activeUntilMs: clockMs + MOVEMENT_INPUT_GRACE_MS
    };
  }

  return {
    left,
    right,
    lastNonZeroDirection: previous?.lastNonZeroDirection ?? 0,
    activeUntilMs: previous?.activeUntilMs ?? Number.NEGATIVE_INFINITY
  };
}

export function getBufferedMovementDirection(
  intent: PlayerIntent,
  clockMs: number
): -1 | 0 | 1 {
  const rawDirection = Number(intent.right) - Number(intent.left) as -1 | 0 | 1;

  if (rawDirection !== 0) {
    return rawDirection;
  }

  if (!intent.left && !intent.right && clockMs <= intent.activeUntilMs) {
    return intent.lastNonZeroDirection;
  }

  return 0;
}

export function resolveBattleDamageKnockbackX({
  attackerX,
  targetX,
  attackerFacing,
  minX = PLAYER_MIN_X,
  maxX = PLAYER_MAX_X
}: {
  readonly attackerX: number;
  readonly targetX: number;
  readonly attackerFacing: BattleFacing;
  readonly minX?: number;
  readonly maxX?: number;
}): number {
  const deltaX = targetX - attackerX;
  const directionX =
    Math.abs(deltaX) > 0.001
      ? deltaX < 0 ? -1 : 1
      : attackerFacing === 'left' ? -1 : 1;

  return clamp(
    targetX + directionX * BATTLE_DAMAGE_KNOCKBACK_DISTANCE,
    minX,
    maxX
  );
}

function getLaneIndex(lane: BattleLaneId): number {
  return Math.max(0, LANE_ORDER.indexOf(lane));
}

function getNextLane(lane: BattleLaneId, direction: 'up' | 'down'): BattleLaneId {
  const offset = direction === 'up' ? -1 : 1;
  const nextIndex = clamp(getLaneIndex(lane) + offset, 0, LANE_ORDER.length - 1);

  return LANE_ORDER[nextIndex];
}

export class BattleRoom extends Room<{ state: BattleState }> {
  private readonly inputsBySessionId = new Map<string, PlayerIntent>();
  private readonly actionUntilMsBySessionId = new Map<string, number>();
  private readonly lastAttackMsBySessionId = new Map<string, number>();
  private readonly reconnectingSessionIds = new Set<string>();
  private pendingAttacks: PendingAttack[] = [];
  private clockMs = 0;

  onCreate(): void {
    this.maxClients = 2;
    this.setState(new BattleState());
    this.setPatchRate(50);
    this.setSimulationInterval((deltaMs) => this.update(deltaMs), 1000 / 60);

    this.onMessage('input', (client, message: MovementInput) => {
      this.handleMovementInput(client, message);
    });
    this.onMessage('lane', (client, message: LaneInput) => {
      this.handleLaneInput(client, message);
    });
    this.onMessage('attack', (client) => {
      this.handleAttackInput(client);
    });
    this.onMessage('jump', (client) => {
      this.handleJumpInput(client);
    });
  }

  onJoin(client: Client, options?: { readonly name?: string }): void {
    const slot = this.getAvailableSlot();
    const player = new BattlePlayerState();
    const spawn = this.getSpawnForSlot(slot);

    player.id = client.sessionId;
    player.name = sanitizePlayerName(options?.name, `P${slot + 1}`);
    player.slot = slot;
    player.connected = true;
    player.x = spawn.x;
    player.y = LANES.middle;
    player.lane = 'middle';
    player.facing = spawn.facing;
    this.state.players.set(client.sessionId, player);
    this.inputsBySessionId.set(client.sessionId, createIdleMovementIntent());
    this.logRoom('join', {
      sessionId: client.sessionId,
      slot,
      playerCount: this.state.players.size
    });

    if (this.state.players.size >= 2) {
      this.startCountdown();
    } else {
      this.state.phase = 'waiting';
      this.state.status = 'Waiting for opponent';
    }
  }

  async onDrop(client: Client): Promise<void> {
    const player = this.state.players.get(client.sessionId);

    if (player === undefined) {
      return;
    }

    player.connected = false;
    this.reconnectingSessionIds.add(client.sessionId);
    this.logRoom('drop:start', {
      sessionId: client.sessionId,
      phase: this.state.phase,
      winnerId: this.state.winnerId
    });

    try {
      await this.allowReconnection(client, RECONNECT_SECONDS);
    } catch {
      this.logRoom('drop:reconnect-expired', {
        sessionId: client.sessionId,
        phase: this.state.phase,
        winnerId: this.state.winnerId
      });
      this.removePlayer(client.sessionId);
    } finally {
      this.reconnectingSessionIds.delete(client.sessionId);
    }
  }

  onReconnect(client: Client): void {
    const player = this.state.players.get(client.sessionId);

    if (player !== undefined) {
      player.connected = true;
      this.inputsBySessionId.set(client.sessionId, createIdleMovementIntent());
      this.logRoom('reconnect', {
        sessionId: client.sessionId,
        phase: this.state.phase,
        winnerId: this.state.winnerId
      });
    }
  }

  onLeave(client: Client): void {
    this.logRoom('leave', {
      sessionId: client.sessionId,
      reconnecting: this.reconnectingSessionIds.has(client.sessionId),
      phase: this.state.phase,
      winnerId: this.state.winnerId
    });

    if (this.reconnectingSessionIds.has(client.sessionId)) {
      return;
    }

    this.removePlayer(client.sessionId);
  }

  private update(deltaMs: number): void {
    this.clockMs += deltaMs;

    if (this.state.phase === 'countdown') {
      this.state.countdownMs = Math.max(0, this.state.countdownMs - deltaMs);
      this.state.status = `Fight in ${Math.ceil(this.state.countdownMs / 1000)}`;

      if (this.state.countdownMs === 0) {
        this.state.phase = 'fighting';
        this.state.status = 'Fight';
      }
    }

    this.expireTemporaryActions();

    if (this.state.phase !== 'fighting') {
      return;
    }

    this.state.elapsedMs += deltaMs;
    this.applyMovement(deltaMs / 1000);
    this.resolvePendingAttacks();
  }

  private handleMovementInput(client: Client, message: MovementInput): void {
    const player = this.state.players.get(client.sessionId);

    if (player === undefined || player.action === 'dead') {
      return;
    }

    this.inputsBySessionId.set(
      client.sessionId,
      createMovementIntent(
        message,
        this.inputsBySessionId.get(client.sessionId),
        this.clockMs
      )
    );
  }

  private handleLaneInput(client: Client, message: LaneInput): void {
    if (this.state.phase !== 'fighting') {
      return;
    }

    if (message.direction !== 'up' && message.direction !== 'down') {
      return;
    }

    const player = this.state.players.get(client.sessionId);

    if (player === undefined || !this.isPlayerControllable(player)) {
      return;
    }

    const nextLane = getNextLane(player.lane as BattleLaneId, message.direction);

    if (nextLane === player.lane) {
      return;
    }

    player.lane = nextLane;
    player.y = LANES[nextLane];
    player.jumpSeq += 1;
    this.setTemporaryAction(player, 'jump', JUMP_ACTION_MS);
  }

  private handleJumpInput(client: Client): void {
    if (this.state.phase !== 'fighting') {
      return;
    }

    const player = this.state.players.get(client.sessionId);

    if (player === undefined || !this.isPlayerControllable(player)) {
      return;
    }

    player.jumpSeq += 1;
    this.setTemporaryAction(player, 'jump', JUMP_ACTION_MS);
  }

  private handleAttackInput(client: Client): void {
    if (this.state.phase !== 'fighting') {
      return;
    }

    const attacker = this.state.players.get(client.sessionId);

    if (attacker === undefined || !this.isPlayerControllable(attacker)) {
      return;
    }

    const lastAttackMs =
      this.lastAttackMsBySessionId.get(client.sessionId) ?? Number.NEGATIVE_INFINITY;

    if (this.clockMs - lastAttackMs < ATTACK_COOLDOWN_MS) {
      return;
    }

    this.lastAttackMsBySessionId.set(client.sessionId, this.clockMs);
    attacker.attackSeq += 1;
    this.setTemporaryAction(attacker, 'slash', ATTACK_ACTION_MS);
    this.broadcast('swing', { attackerId: attacker.id });
    this.pendingAttacks.push({
      attackerId: attacker.id,
      resolveAtMs: this.clockMs + this.getAttackHitDelayMs(attacker)
    });
  }

  private applyMovement(deltaSeconds: number): void {
    for (const player of this.getPlayers()) {
      if (player.action === 'dead') {
        continue;
      }

      if (this.isTemporaryActionLocked(player)) {
        continue;
      }

      const input = this.inputsBySessionId.get(player.id) ?? createIdleMovementIntent();
      const direction = getBufferedMovementDirection(input, this.clockMs);

      if (direction !== 0) {
        player.x = clamp(
          player.x + direction * PLAYER_SPEED * deltaSeconds,
          PLAYER_MIN_X,
          PLAYER_MAX_X
        );
        player.facing = direction > 0 ? 'right' : 'left';
      }

      player.action = direction === 0 ? 'idle' : 'run';
    }
  }

  private startCountdown(): void {
    this.clockMs = 0;
    this.state.phase = 'countdown';
    this.state.countdownMs = COUNTDOWN_MS;
    this.state.elapsedMs = 0;
    this.state.winnerId = '';
    this.state.status = 'Get ready';
    this.actionUntilMsBySessionId.clear();
    this.lastAttackMsBySessionId.clear();
    this.pendingAttacks = [];

    for (const player of this.getPlayers()) {
      const spawn = this.getSpawnForSlot(player.slot);

      player.connected = true;
      player.x = spawn.x;
      player.y = LANES.middle;
      player.lane = 'middle';
      player.facing = spawn.facing;
      player.action = 'idle';
      player.hp = BATTLE_MAX_HEALTH;
      player.attackSeq = 0;
      player.jumpSeq = 0;
      player.hurtSeq = 0;
      this.inputsBySessionId.set(player.id, createIdleMovementIntent());
    }
  }

  private finishMatch(winnerId: string): void {
    const winner = this.state.players.get(winnerId);

    if (winner !== undefined) {
      winner.wins += 1;
    }

    this.pendingAttacks = [];
    this.state.phase = 'finished';
    this.state.winnerId = winnerId;
    this.state.status = 'Match finished';
    this.lock();
    this.logRoom('finish-match', {
      winnerId,
      players: this.getPlayers().map((player) => ({
        id: player.id,
        hp: player.hp,
        connected: player.connected,
        action: player.action
      }))
    });
  }

  private removePlayer(sessionId: string): void {
    const player = this.state.players.get(sessionId);

    this.inputsBySessionId.delete(sessionId);
    this.actionUntilMsBySessionId.delete(sessionId);
    this.lastAttackMsBySessionId.delete(sessionId);
    this.pendingAttacks = this.pendingAttacks.filter(
      (pendingAttack) => pendingAttack.attackerId !== sessionId
    );

    if (player === undefined) {
      this.logRoom('remove-player:missing', { sessionId });
      return;
    }

    const opponent = this.getOpponent(sessionId);

    this.state.players.delete(sessionId);
    this.logRoom('remove-player', {
      sessionId,
      opponentId: opponent?.id,
      phase: this.state.phase,
      winnerId: this.state.winnerId,
      playerCount: this.state.players.size
    });

    if (
      opponent !== undefined &&
      (this.state.phase === 'fighting' || this.state.phase === 'countdown')
    ) {
      this.finishMatch(opponent.id);
      return;
    }

    if (this.state.phase === 'finished') {
      this.state.countdownMs = 0;
      this.state.status = 'Match finished';
      return;
    }

    if (this.state.players.size < 2) {
      this.state.phase = 'waiting';
      this.state.countdownMs = 0;
      this.state.status = 'Waiting for opponent';
      this.state.winnerId = '';
    }
  }

  private setTemporaryAction(
    player: BattlePlayerState,
    action: Exclude<BattleAction, 'idle' | 'run' | 'dead'>,
    durationMs: number
  ): void {
    if (player.action === 'dead') {
      return;
    }

    player.action = action;
    this.actionUntilMsBySessionId.set(player.id, this.clockMs + durationMs);
  }

  private expireTemporaryActions(): void {
    for (const player of this.getPlayers()) {
      if (player.action === 'dead') {
        continue;
      }

      if (!this.isTemporaryActionLocked(player)) {
        this.actionUntilMsBySessionId.delete(player.id);
      }
    }
  }

  private isTemporaryActionLocked(player: BattlePlayerState): boolean {
    const actionUntilMs = this.actionUntilMsBySessionId.get(player.id);

    return actionUntilMs !== undefined && this.clockMs < actionUntilMs;
  }

  private isPlayerControllable(player: BattlePlayerState): boolean {
    return player.action !== 'dead' && !this.isTemporaryActionLocked(player);
  }

  private resolvePendingAttacks(): void {
    if (this.pendingAttacks.length === 0) {
      return;
    }

    const dueAttacks: PendingAttack[] = [];
    const waitingAttacks: PendingAttack[] = [];

    for (const pendingAttack of this.pendingAttacks) {
      if (pendingAttack.resolveAtMs <= this.clockMs) {
        dueAttacks.push(pendingAttack);
      } else {
        waitingAttacks.push(pendingAttack);
      }
    }

    this.pendingAttacks = waitingAttacks;

    for (const pendingAttack of dueAttacks) {
      if (this.state.phase !== 'fighting') {
        return;
      }

      this.resolvePendingAttack(pendingAttack);
    }
  }

  private resolvePendingAttack(pendingAttack: PendingAttack): void {
    const attacker = this.state.players.get(pendingAttack.attackerId);

    if (attacker === undefined || attacker.action !== 'slash') {
      return;
    }

    const target = this.getOpponent(pendingAttack.attackerId);

    if (target === undefined || !this.canAttackHit(attacker, target)) {
      return;
    }

    target.hp = Math.max(0, target.hp - 1);
    target.hurtSeq += 1;

    if (target.hp > 0) {
      target.x = resolveBattleDamageKnockbackX({
        attackerX: attacker.x,
        targetX: target.x,
        attackerFacing: attacker.facing as BattleFacing
      });
      target.facing =
        attacker.x < target.x
          ? 'left'
          : attacker.x > target.x
            ? 'right'
            : attacker.facing === 'left' ? 'right' : 'left';
    }

    this.broadcast('hit', {
      attackerId: attacker.id,
      targetId: target.id,
      hp: target.hp
    });
    this.logRoom('hit', {
      attackerId: attacker.id,
      targetId: target.id,
      targetHp: target.hp,
      targetX: target.x,
      phase: this.state.phase
    });

    if (target.hp <= 0) {
      target.action = 'dead';
      this.actionUntilMsBySessionId.delete(target.id);
      this.finishMatch(attacker.id);
      return;
    }

    this.setTemporaryAction(target, 'hurt', HURT_ACTION_MS);
  }

  private getAttackHitDelayMs(attacker: BattlePlayerState): number {
    return attacker.slot === 0
      ? MAIN_NINJA_ATTACK_HIT_DELAY_MS
      : ENEMY_NINJA_ATTACK_HIT_DELAY_MS;
  }

  private canAttackHit(
    attacker: BattlePlayerState,
    target: BattlePlayerState
  ): boolean {
    if (
      target.action === 'dead' ||
      target.action === 'jump' ||
      attacker.lane !== target.lane
    ) {
      return false;
    }

    const distance = Math.abs(attacker.x - target.x);

    if (distance > ATTACK_RANGE) {
      return false;
    }

    return attacker.facing === 'right'
      ? target.x >= attacker.x - ATTACK_BACK_REACH
      : target.x <= attacker.x + ATTACK_BACK_REACH;
  }

  private getAvailableSlot(): number {
    const usedSlots = new Set(this.getPlayers().map((player) => player.slot));

    return usedSlots.has(0) ? 1 : 0;
  }

  private getSpawnForSlot(slot: number): { readonly x: number; readonly facing: BattleFacing } {
    return slot === 0
      ? { x: 320, facing: 'right' }
      : { x: WORLD_WIDTH - 320, facing: 'left' };
  }

  private getOpponent(sessionId: string): BattlePlayerState | undefined {
    return this.getPlayers().find((player) => player.id !== sessionId);
  }

  private getPlayers(): BattlePlayerState[] {
    const players: BattlePlayerState[] = [];

    this.state.players.forEach((player: BattlePlayerState) => {
      players.push(player);
    });

    return players;
  }

  private logRoom(event: string, details: Record<string, unknown> = {}): void {
    const payload = {
      event,
      roomId: this.roomId,
      phase: this.state.phase,
      winnerId: this.state.winnerId,
      playerCount: this.state.players.size,
      clockMs: this.clockMs,
      at: Date.now(),
      ...details
    };

    console.info(
      `[ninja-slash:room] event=${event} phase=${payload.phase} winner=${payload.winnerId} players=${payload.playerCount} room=${payload.roomId} details=${this.formatDebugDetails(details)} at=${payload.at}`,
      payload
    );
  }

  private formatDebugDetails(details: object): string {
    try {
      return JSON.stringify(details);
    } catch {
      return '[unserializable]';
    }
  }
}
