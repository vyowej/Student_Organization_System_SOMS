/**
 * One-Command Development Runner (`scripts/dev.js`)
 *
 * Spawns both the Express backend server (port 5000) and the Vite frontend dev server (port 5173)
 * concurrently in a single terminal process with unified logging and graceful shutdown.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

console.log('====================================================');
console.log(' Starting SOMS (Backend API + Frontend Vite)');
console.log('====================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';
const viteBin = path.resolve('node_modules', 'vite', 'bin', 'vite.js');

// 1. Spawn Backend (Node Express on port 5000)
const backend = spawn(process.execPath, ['backend/server.js'], {
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

backend.stdout.on('data', (data) => {
  const lines = data.toString().trimEnd().split('\n');
  lines.forEach((line) => console.log(`\x1b[36m[BACKEND]\x1b[0m ${line}`));
});

backend.stderr.on('data', (data) => {
  const lines = data.toString().trimEnd().split('\n');
  lines.forEach((line) => console.error(`\x1b[31m[BACKEND ERROR]\x1b[0m ${line}`));
});

backend.on('error', (err) => {
  console.error('\x1b[31m[BACKEND PROCESS ERROR]\x1b[0m', err.message);
});

// 2. Spawn Frontend (Vite on port 5173)
// Direct Node execution of Vite avoids Windows .cmd spawn EINVAL in Node 22/24 while enabling clean SIGTERM kills
const frontend = existsSync(viteBin)
  ? spawn(process.execPath, [viteBin], {
      stdio: 'pipe',
      env: { ...process.env, FORCE_COLOR: '1' },
    })
  : spawn(npmCmd, ['run', 'dev:vite'], {
      stdio: 'pipe',
      shell: isWindows,
      env: { ...process.env, FORCE_COLOR: '1' },
    });

frontend.stdout.on('data', (data) => {
  const lines = data.toString().trimEnd().split('\n');
  lines.forEach((line) => console.log(`\x1b[32m[FRONTEND]\x1b[0m ${line}`));
});

frontend.stderr.on('data', (data) => {
  const lines = data.toString().trimEnd().split('\n');
  lines.forEach((line) => console.error(`\x1b[33m[FRONTEND]\x1b[0m ${line}`));
});

frontend.on('error', (err) => {
  console.error('\x1b[31m[FRONTEND PROCESS ERROR]\x1b[0m', err.message);
});

// Graceful shutdown on Ctrl+C or kill
let isShuttingDown = false;
function cleanup() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log('\nStopping SOMS development servers...');
  try {
    if (backend && !backend.killed) backend.kill('SIGTERM');
  } catch {}
  try {
    if (frontend && !frontend.killed) frontend.kill('SIGTERM');
  } catch {}
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
