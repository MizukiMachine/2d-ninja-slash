import { readdirSync, statSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

const backgroundSpriteSheetSets = ['current', 'legacy'] as const;
const debugBackgroundsModuleId = 'virtual:debug-backgrounds';
const resolvedDebugBackgroundsModuleId = `\0${debugBackgroundsModuleId}`;

type BackgroundSpriteSheetSet = (typeof backgroundSpriteSheetSets)[number];

function getBackgroundDirectory(spriteSheetSet: BackgroundSpriteSheetSet): string {
  return resolve(process.cwd(), 'public', 'assets', spriteSheetSet, 'backgrounds');
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
  readonly fileNamesBySpriteSet: Record<BackgroundSpriteSheetSet, readonly string[]>;
  readonly urlsBySpriteSet: Record<BackgroundSpriteSheetSet, Readonly<Record<string, string>>>;
} {
  const fileNamesBySpriteSet = {} as Record<BackgroundSpriteSheetSet, readonly string[]>;
  const urlsBySpriteSet = {} as Record<
    BackgroundSpriteSheetSet,
    Readonly<Record<string, string>>
  >;

  for (const spriteSheetSet of backgroundSpriteSheetSets) {
    const backgroundUrlsByFileName: Record<string, string> = {};
    const backgroundDirectory = getBackgroundDirectory(spriteSheetSet);
    const fileNames = readPngFileNames(backgroundDirectory);

    for (const fileName of fileNames) {
      backgroundUrlsByFileName[fileName] = `/assets/${spriteSheetSet}/backgrounds/${fileName}`;
    }

    if (fileNames.length === 0) {
      throw new Error(`No PNG backgrounds found in ${backgroundDirectory}`);
    }

    fileNamesBySpriteSet[spriteSheetSet] = fileNames;
    urlsBySpriteSet[spriteSheetSet] = Object.fromEntries(
      fileNames.map((fileName) => [fileName, backgroundUrlsByFileName[fileName]])
    );
  }

  return { fileNamesBySpriteSet, urlsBySpriteSet };
}

function createBackgroundManifestCode(): string {
  const manifest = createBackgroundManifest();

  return `const backgroundFileNamesBySpriteSet = ${JSON.stringify(
    manifest.fileNamesBySpriteSet,
    null,
    2
  )};
const backgroundUrlsBySpriteSet = ${JSON.stringify(manifest.urlsBySpriteSet, null, 2)};

export const BACKGROUND_FILE_NAMES_BY_SPRITE_SET = backgroundFileNamesBySpriteSet;
export const BACKGROUND_URLS_BY_SPRITE_SET = backgroundUrlsBySpriteSet;

export const DEFAULT_DEBUG_BACKGROUND_FILE_NAMES = {
  current: backgroundFileNamesBySpriteSet.current[0],
  legacy: backgroundFileNamesBySpriteSet.legacy[0]
};
`;
}

function isBackgroundFilePath(filePath: string): boolean {
  const absoluteFilePath = resolve(filePath);

  return backgroundSpriteSheetSets.some((spriteSheetSet) => {
    const backgroundDirectory = getBackgroundDirectory(spriteSheetSet);

    return (
      absoluteFilePath.startsWith(`${backgroundDirectory}${sep}`) &&
      absoluteFilePath.toLowerCase().endsWith('.png')
    );
  });
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
      server.watcher.add(backgroundSpriteSheetSets.map(getBackgroundDirectory));
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
