import { createColyseusClient } from './colyseusClient';
import {
  DUEL_ROOM_NAME,
  type MultiplayerRoom,
  type MultiplayerState
} from './multiplayerTypes';

const RECONNECTION_TOKEN_KEY = 'ninja-slash.duel.reconnectionToken.v1';

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
      const room = await client.reconnect<MultiplayerState>(token);
      writeReconnectionToken(room.reconnectionToken);
      return room as MultiplayerRoom;
    } catch {
      clearReconnectionToken();
    }
  }

  const room = await client.joinOrCreate<MultiplayerState>(DUEL_ROOM_NAME, {
    name
  });

  writeReconnectionToken(room.reconnectionToken);
  room.onLeave((code) => {
    if (code === 1000) {
      clearReconnectionToken();
    }
  });

  return room as MultiplayerRoom;
}
