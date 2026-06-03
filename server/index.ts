import { defineRoom, defineServer, matchMaker } from 'colyseus';
import { BATTLE_ROOM_NAME } from './rooms/BattleState.js';
import { BattleRoom } from './rooms/BattleRoom.js';
import { createCorsOriginConfig, resolveCorsHeaderOrigin } from './cors.js';

interface RouteRequest {
  readonly method?: string;
  get?(name: string): string | undefined;
  header?(name: string): string | undefined;
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
const corsConfig = createCorsOriginConfig({
  clientOrigin: process.env.CLIENT_ORIGIN,
  corsOrigin: process.env.CORS_ORIGIN
});

function getRequestOrigin(request: RouteRequest): string | undefined {
  return request.get?.('origin') ?? request.header?.('origin');
}

matchMaker.controller.getCorsHeaders = (headers: Headers): Record<string, string> => ({
  'Access-Control-Allow-Origin': resolveCorsHeaderOrigin(
    corsConfig,
    headers.get('origin') ?? undefined
  ),
  Vary: 'Origin'
});

export const gameServer = defineServer({
  rooms: {
    [BATTLE_ROOM_NAME]: defineRoom(BattleRoom)
  },
  express: (app) => {
    app.use((request: RouteRequest, response: RouteResponse, next: NextFunction) => {
      response.setHeader(
        'Access-Control-Allow-Origin',
        resolveCorsHeaderOrigin(corsConfig, getRequestOrigin(request))
      );
      response.setHeader('Vary', 'Origin');
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
        clientOriginConfigured: !corsConfig.allowAll,
        androidOriginAllowed:
          corsConfig.allowAll ||
          corsConfig.allowedOrigins.has('https://localhost'),
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
