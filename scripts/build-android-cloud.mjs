import { spawnSync } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const configuredColyseusUrl = process.env.VITE_COLYSEUS_URL?.trim();

if (!configuredColyseusUrl) {
  console.error(
    'VITE_COLYSEUS_URL is required for Android cloud builds. Example: VITE_COLYSEUS_URL=https://your-colyseus-host npm run android:cloud:run'
  );
  process.exit(1);
}

const isSecureCloudUrl =
  configuredColyseusUrl.startsWith('https://') ||
  configuredColyseusUrl.startsWith('wss://');

if (!isSecureCloudUrl) {
  console.error(
    `VITE_COLYSEUS_URL should use https:// or wss:// for Colyseus Cloud builds. Received: ${configuredColyseusUrl}`
  );
  process.exit(1);
}

const result = spawnSync(npmCommand, ['run', 'build:game'], {
  env: {
    ...process.env,
    VITE_COLYSEUS_URL: configuredColyseusUrl
  },
  stdio: 'inherit'
});

process.exit(result.status ?? 1);
