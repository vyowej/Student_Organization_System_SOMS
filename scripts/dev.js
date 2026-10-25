/**
 * One-Command Development Runner (`scripts/dev.js`)
 *
 * Spawns both the Express backend server (port 5000) and the Vite frontend dev server (port 5173)
 * concurrently in a single terminal process with unified logging and graceful shutdown.
 */
import { spawn } from 'node:child_process';
import process from 'node:process';

console.log('====================================================');
console.log(' Starting SOMS (Backend API + Frontend Vite)');
console.log('====================================================\n');

const isWindows = process.platform === 'win32';
const npmCmd = isWindows ? 'npm.cmd' : 'npm';

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

// 2. Spawn Frontend (Vite on port 5173)
const frontend = spawn(npmCmd, ['run', 'dev'], {
  stdio: 'pipe',
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

// Graceful shutdown on Ctrl+C or exit
function cleanup() {
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
process.on('exit', cleanup);
