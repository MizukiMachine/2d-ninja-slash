import { readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const debugBackgroundsModuleId = 'virtual:debug-backgrounds';
const resolvedDebugBackgroundsModuleId = `\0${debugBackgroundsModuleId}`;

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

  return `const backgroundFileNames = ${JSON.stringify(
    manifest.fileNames,
    null,
    2
  )};
const backgroundUrls = ${JSON.stringify(manifest.urls, null, 2)};

export const BACKGROUND_FILE_NAMES = backgroundFileNames;
export const BACKGROUND_URLS = backgroundUrls;

export const DEFAULT_DEBUG_BACKGROUND_FILE_NAME = backgroundFileNames[0];
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

export default defineConfig({
  plugins: [debugBackgroundsPlugin()],
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
