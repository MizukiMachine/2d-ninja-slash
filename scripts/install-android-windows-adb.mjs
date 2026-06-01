import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const appActivity = 'com.mizuki2.ninjaslash/.MainActivity';
const apkPath = resolve('android/app/build/outputs/apk/debug/app-debug.apk');

function readArg(name) {
  const prefix = `${name}=`;
  const index = process.argv.indexOf(name);

  if (index >= 0) {
    return process.argv[index + 1];
  }

  const inline = process.argv.find((arg) => arg.startsWith(prefix));

  return inline?.slice(prefix.length);
}

function commandOutput(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  }).trim();
}

function getWindowsAdbPath() {
  const adbWindowsPath = commandOutput('powershell.exe', [
    '-NoProfile',
    '-ExecutionPolicy',
    'Bypass',
    '-Command',
    '$env:LOCALAPPDATA + "\\Android\\Sdk\\platform-tools\\adb.exe"'
  ]).replace(/\r/g, '');

  return commandOutput('wslpath', ['-u', adbWindowsPath]);
}

function getWindowsPath(path) {
  return commandOutput('wslpath', ['-w', path]).replace(/\r/g, '');
}

function parseDeviceIds(devicesOutput) {
  return devicesOutput
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => /\sdevice(\s|$)/.test(line))
    .map((line) => line.split(/\s+/)[0]);
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit' });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

if (!existsSync(apkPath)) {
  console.error(`APK not found: ${apkPath}`);
  console.error('Build it first, for example: npm run android:cloud:apk');
  process.exit(1);
}

const adbPath = getWindowsAdbPath();
const apkWindowsPath = getWindowsPath(apkPath);
const requestedTarget = readArg('--target');
const devicesOutput = commandOutput(adbPath, ['devices', '-l']);

console.log(devicesOutput);

const deviceIds = parseDeviceIds(devicesOutput);
const target = requestedTarget ?? (deviceIds.length === 1 ? deviceIds[0] : undefined);

if (!target) {
  if (deviceIds.length === 0) {
    console.error('No Windows ADB device/emulator is connected.');
    console.error('Start the emulator from Windows Android Studio, then run this again.');
  } else {
    console.error('Multiple Windows ADB devices are connected. Choose one with --target.');
    console.error(`Available targets: ${deviceIds.join(', ')}`);
  }

  process.exit(1);
}

run(adbPath, ['-s', target, 'install', '-r', apkWindowsPath]);
run(adbPath, ['-s', target, 'shell', 'am', 'start', '-n', appActivity]);
