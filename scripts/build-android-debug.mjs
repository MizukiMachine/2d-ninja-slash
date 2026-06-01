import { spawnSync } from 'node:child_process';

const DEFAULT_ANDROID_EMULATOR_COLYSEUS_URL = 'http://10.0.2.2:2567';
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const configuredColyseusUrl = process.env.VITE_COLYSEUS_URL?.trim();

const result = spawnSync(npmCommand, ['run', 'build:game'], {
  env: {
    ...process.env,
    VITE_COLYSEUS_URL:
      configuredColyseusUrl && configuredColyseusUrl.length > 0
        ? configuredColyseusUrl
        : DEFAULT_ANDROID_EMULATOR_COLYSEUS_URL
  },
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
