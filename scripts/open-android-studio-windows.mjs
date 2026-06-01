import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const androidProjectPath = resolve('android');

function commandOutput(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  }).trim();
}

function singleQuotePowerShell(value) {
  return `'${value.replace(/'/g, "''")}'`;
}

if (!existsSync(androidProjectPath)) {
  console.error(`Android project not found: ${androidProjectPath}`);
  process.exit(1);
}

const studioWindowsPath = commandOutput('powershell.exe', [
  '-NoProfile',
  '-ExecutionPolicy',
  'Bypass',
  '-Command',
  [
    '$paths = @(',
    '"$env:ProgramFiles\\Android\\Android Studio\\bin\\studio64.exe",',
    '"${env:ProgramFiles(x86)}\\Android\\Android Studio\\bin\\studio64.exe"',
    ');',
    'foreach ($path in $paths) { if (Test-Path $path) { $path; exit 0 } }',
    '$cmd = Get-Command studio64.exe -ErrorAction SilentlyContinue;',
    'if ($cmd) { $cmd.Source; exit 0 }',
    'exit 1'
  ].join(' ')
]).replace(/\r/g, '');

const androidProjectWindowsPath = commandOutput('wslpath', ['-w', androidProjectPath]).replace(
  /\r/g,
  ''
);

const command = [
  `$studio = ${singleQuotePowerShell(studioWindowsPath)};`,
  `$project = ${singleQuotePowerShell(androidProjectWindowsPath)};`,
  'Start-Process -FilePath $studio -ArgumentList @($project);'
].join(' ');

const result = spawnSync(
  'powershell.exe',
  ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', command],
  {
    cwd: existsSync('/mnt/c') ? '/mnt/c' : process.cwd(),
    stdio: 'inherit'
  }
);

process.exit(result.status ?? 1);
