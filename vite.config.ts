import { mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const projectRoot = process.cwd();

const debugBackgroundsModuleId = 'virtual:debug-backgrounds';
const resolvedDebugBackgroundsModuleId = `\0${debugBackgroundsModuleId}`;
const defaultDebugBackgroundFileName = 'three-lane-rough-castle-courtyard.png';
const ninjaBoundsDirectory = resolve(process.cwd(), 'public', 'assets', 'config');
const ninjaBoundsPath = join(ninjaBoundsDirectory, 'ninja-bounds.json');
const gameplayTuningPath = join(ninjaBoundsDirectory, 'gameplay-tuning.json');
const sandboxLanesPath = join(ninjaBoundsDirectory, 'sandbox-lanes.json');
const sfxBindingsPath = join(ninjaBoundsDirectory, 'sfx-bindings.json');

interface DebugRequest {
  readonly method?: string;
  setEncoding(encoding: string): void;
  on(eventName: 'data', callback: (chunk: string) => void): void;
  on(eventName: 'end', callback: () => void): void;
  on(eventName: 'error', callback: (error: Error) => void): void;
}

interface DebugResponse {
  statusCode: number;
  setHeader(name: string, value: string): void;
  end(body: string): void;
}

function readRequestBody(request: DebugRequest): Promise<string> {
  return new Promise((resolveBody, reject) => {
    let body = '';

    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
    });
    request.on('end', () => resolveBody(body));
    request.on('error', reject);
  });
}

function sendJson(response: DebugResponse, statusCode: number, payload: object): void {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

function getBackgroundDirectory(): string {
  return resolve(process.cwd(), 'public', 'assets', 'backgrounds');
}

function readPngFileNames(backgroundDirectory: string): readonly string[] {
  return readdirSync(backgroundDirectory)
    .filter((fileName) => {
      const filePath = join(backgroundDirectory, fileName);

      return fileName.toLowerCase().endsWith('.png') && statSync(filePath).isFile();
    })
    .sort((a, b) => a.localeCompare(b));
}

function createBackgroundManifest(): {
  readonly fileNames: readonly string[];
  readonly urls: Readonly<Record<string, string>>;
} {
  const backgroundDirectory = getBackgroundDirectory();
  const fileNames = readPngFileNames(backgroundDirectory);

  if (fileNames.length === 0) {
    throw new Error(`No PNG backgrounds found in ${backgroundDirectory}`);
  }

  return {
    fileNames,
    urls: Object.fromEntries(
      fileNames.map((fileName) => [fileName, `/assets/backgrounds/${fileName}`])
    )
  };
}

function createBackgroundManifestCode(): string {
  const manifest = createBackgroundManifest();

  if (!manifest.fileNames.includes(defaultDebugBackgroundFileName)) {
    throw new Error(`Default background not found: ${defaultDebugBackgroundFileName}`);
  }

  const defaultBackgroundCode = JSON.stringify(defaultDebugBackgroundFileName);

  return `const backgroundFileNames = ${JSON.stringify(
    manifest.fileNames,
    null,
    2
  )};
const backgroundUrls = ${JSON.stringify(manifest.urls, null, 2)};

export const BACKGROUND_FILE_NAMES = backgroundFileNames;
export const BACKGROUND_URLS = backgroundUrls;

export const DEFAULT_DEBUG_BACKGROUND_FILE_NAME = ${defaultBackgroundCode};
`;
}

function isBackgroundFilePath(filePath: string): boolean {
  const absoluteFilePath = resolve(filePath);
  const backgroundDirectory = getBackgroundDirectory();

  return (
    absoluteFilePath.startsWith(`${backgroundDirectory}${sep}`) &&
    absoluteFilePath.toLowerCase().endsWith('.png')
  );
}

function debugBackgroundsPlugin(): Plugin {
  return {
    name: 'debug-backgrounds',
    resolveId(id) {
      if (id === debugBackgroundsModuleId) {
        return resolvedDebugBackgroundsModuleId;
      }

      return null;
    },
    load(id) {
      if (id === resolvedDebugBackgroundsModuleId) {
        return createBackgroundManifestCode();
      }

      return null;
    },
    configureServer(server) {
      server.watcher.add(getBackgroundDirectory());
      server.watcher.on('all', (eventName, filePath) => {
        if (
          eventName !== 'add' &&
          eventName !== 'change' &&
          eventName !== 'unlink'
        ) {
          return;
        }

        if (!isBackgroundFilePath(filePath)) {
          return;
        }

        const backgroundModule = server.moduleGraph.getModuleById(
          resolvedDebugBackgroundsModuleId
        );

        if (backgroundModule !== undefined) {
          server.moduleGraph.invalidateModule(backgroundModule);
        }

        server.ws.send({ type: 'full-reload' });
      });
    }
  };
}

function debugConfigWriterPlugin(): Plugin {
  return {
    name: 'debug-config-writer',
    configureServer(server) {
      const writeJsonEndpoint = (endpoint: string, outputPath: string): void => {
        server.middlewares.use(endpoint, async (request, response, next) => {
          const debugRequest = request as unknown as DebugRequest;
          const debugResponse = response as unknown as DebugResponse;

          if (debugRequest.method !== 'PUT' && debugRequest.method !== 'POST') {
            next();
            return;
          }

          try {
            const body = await readRequestBody(debugRequest);
            const parsed = JSON.parse(body) as unknown;

            if (!parsed || typeof parsed !== 'object') {
              sendJson(debugResponse, 400, { ok: false, error: 'Expected a JSON object' });
              return;
            }

            mkdirSync(ninjaBoundsDirectory, { recursive: true });
            writeFileSync(outputPath, `${JSON.stringify(parsed, null, 2)}\n`);
            sendJson(debugResponse, 200, { ok: true, path: outputPath });
          } catch (error) {
            sendJson(debugResponse, 500, {
              ok: false,
              error: error instanceof Error ? error.message : 'Unknown save error'
            });
          }
        });
      };

      server.middlewares.use('/__debug/ninja-bounds', async (request, response, next) => {
        const debugRequest = request as unknown as DebugRequest;
        const debugResponse = response as unknown as DebugResponse;

        if (debugRequest.method !== 'PUT' && debugRequest.method !== 'POST') {
          next();
          return;
        }

        try {
          const body = await readRequestBody(debugRequest);
          const parsed = JSON.parse(body) as unknown;

          if (!parsed || typeof parsed !== 'object') {
            sendJson(debugResponse, 400, { ok: false, error: 'Expected a JSON object' });
            return;
          }

          mkdirSync(ninjaBoundsDirectory, { recursive: true });
          writeFileSync(ninjaBoundsPath, `${JSON.stringify(parsed, null, 2)}\n`);
          sendJson(debugResponse, 200, { ok: true, path: ninjaBoundsPath });
        } catch (error) {
          sendJson(debugResponse, 500, {
            ok: false,
            error: error instanceof Error ? error.message : 'Unknown save error'
          });
        }
      });
      writeJsonEndpoint('/__debug/gameplay-tuning', gameplayTuningPath);
      writeJsonEndpoint('/__debug/sandbox-lanes', sandboxLanesPath);
      writeJsonEndpoint('/__debug/sfx-bindings', sfxBindingsPath);
    }
  };
}

export default defineConfig({
  plugins: [debugBackgroundsPlugin(), debugConfigWriterPlugin()],
  build: {
    rollupOptions: {
      input: {
        // Debug console (open http://localhost:5190/)
        main: resolve(projectRoot, 'index.html'),
        // Standalone game (open http://localhost:5190/game.html)
        game: resolve(projectRoot, 'game.html')
      }
    }
  },
  server: {
    host: '0.0.0.0',
    port: 5190,
    watch: {
      usePolling: true,
      interval: 500,
      ignored: ['**/old/**', '**/dist/**']
    }
  },
  preview: {
    host: '0.0.0.0',
    port: 4173
  }
});
