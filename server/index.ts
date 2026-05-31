import { defineRoom, defineServer } from 'colyseus';
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
const serviceName = '2d-ninja-slash-colyseus';
const corsOrigin = process.env.CLIENT_ORIGIN ?? process.env.CORS_ORIGIN ?? '*';

export const gameServer = defineServer({
  rooms: {
    [BATTLE_ROOM_NAME]: defineRoom(BattleRoom)
  },
  express: (app) => {
    app.use((request: RouteRequest, response: RouteResponse, next: NextFunction) => {
      response.setHeader('Access-Control-Allow-Origin', corsOrigin);
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
        service: serviceName,
        protocolVersion,
        room: BATTLE_ROOM_NAME,
        nodeEnv: process.env.NODE_ENV ?? 'development',
        colyseusCloud: process.env.COLYSEUS_CLOUD !== undefined,
        clientOriginConfigured: corsOrigin !== '*',
        build: process.env.BUILD_SHA ?? process.env.RENDER_GIT_COMMIT ?? 'local',
        uptimeSeconds: Math.floor(process.uptime())
      });
    });
  }
});

try {
  await gameServer.listen(port, '0.0.0.0');
  console.log(`${serviceName} listening on http://localhost:${port}`);
} catch (error) {
  console.error(error);
  process.exit(1);
}
