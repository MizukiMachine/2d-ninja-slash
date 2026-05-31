import { createColyseusClient } from './colyseusClient';
import {
  DUEL_ROOM_NAME,
  type MultiplayerRoom,
  type MultiplayerState
} from './multiplayerTypes';

const RECONNECTION_TOKEN_KEY = 'ninja-slash.duel.reconnectionToken.v1';

function logMultiplayerSession(event: string, details: object = {}): void {
  const payload = { event, at: Date.now(), ...details };

  console.info(
    `[ninja-slash:multiplayer-session] event=${event} details=${formatDebugDetails(details)} at=${payload.at}`,
    payload
  );
}

function formatDebugDetails(details: object): string {
  try {
    return JSON.stringify(details);
  } catch {
    return '[unserializable]';
  }
}

function readReconnectionToken(): string | null {
  try {
    return window.sessionStorage.getItem(RECONNECTION_TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeReconnectionToken(token: string): void {
  try {
    window.sessionStorage.setItem(RECONNECTION_TOKEN_KEY, token);
  } catch {
    // Session recovery is optional; gameplay can still join a fresh room.
  }
}

function clearReconnectionToken(): void {
  try {
    window.sessionStorage.removeItem(RECONNECTION_TOKEN_KEY);
  } catch {
    // Ignore storage failures in private browsing or locked-down embeds.
  }
}

export async function joinDuelRoom(name?: string): Promise<MultiplayerRoom> {
  const client = createColyseusClient();
  const token = readReconnectionToken();

  if (token !== null) {
    try {
      logMultiplayerSession('reconnect:start', { token });
      const room = await client.reconnect<MultiplayerState>(token);
      writeReconnectionToken(room.reconnectionToken);
      logMultiplayerSession('reconnect:success', {
        roomId: room.roomId,
        sessionId: room.sessionId,
        reconnectionToken: room.reconnectionToken
      });
      return room as MultiplayerRoom;
    } catch (error) {
      logMultiplayerSession('reconnect:failed', {
        token,
        error: error instanceof Error ? error.message : String(error)
      });
      clearReconnectionToken();
    }
  }

  logMultiplayerSession('join-or-create:start', { roomName: DUEL_ROOM_NAME });
  const room = await client.joinOrCreate<MultiplayerState>(DUEL_ROOM_NAME, {
    name
  });

  writeReconnectionToken(room.reconnectionToken);
  logMultiplayerSession('join-or-create:success', {
    roomId: room.roomId,
    sessionId: room.sessionId,
    reconnectionToken: room.reconnectionToken
  });
  room.onLeave((code) => {
    logMultiplayerSession('room:leave', {
      code,
      roomId: room.roomId,
      sessionId: room.sessionId
    });
    if (code === 1000) {
      clearReconnectionToken();
    }
  });

  return room as MultiplayerRoom;
}
