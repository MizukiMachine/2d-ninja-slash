import { Server } from 'colyseus';
import { BATTLE_ROOM_NAME } from './rooms/BattleState.js';
import { BattleRoom } from './rooms/BattleRoom.js';

interface RouteRequest {
  readonly method?: string;
}

interface RouteResponse {
  setHeader(name: string, value: string): void;
  status(code: number): RouteResponse;
  end(): void;
  json(payload: object): void;
}

type NextFunction = () => void;

const port = Number(process.env.PORT ?? 2567);
const protocolVersion = 'duel-v1';

const gameServer = new Server({
  express: (app) => {
    app.use((request: RouteRequest, response: RouteResponse, next: NextFunction) => {
      response.setHeader('Access-Control-Allow-Origin', process.env.CORS_ORIGIN ?? '*');
      response.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
      response.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');

      if (request.method === 'OPTIONS') {
        response.status(204).end();
        return;
      }

      next();
    });

    app.get('/health', (_request: RouteRequest, response: RouteResponse) => {
      response.json({
        ok: true,
        service: '2d-ninja-slash-colyseus',
        protocolVersion,
        room: BATTLE_ROOM_NAME
      });
    });
  }
});

gameServer.define(BATTLE_ROOM_NAME, BattleRoom);

try {
  await gameServer.listen(port, '0.0.0.0');
  console.log(`Colyseus listening on http://localhost:${port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}

const shutdown = async (): Promise<void> => {
  await gameServer.gracefullyShutdown(false);
  process.exit(0);
};

process.once('SIGINT', () => {
  void shutdown();
});
process.once('SIGTERM', () => {
  void shutdown();
});
