/**
 * One-Command Development Runner (`scripts/dev.js`)
 *
 * Automatically verifies frontend/backend dependencies, backend/.env,
 * PostgreSQL schema initialization/migrations (via backend startup),
 * and runs Express (port 5000) + Vite (port 5173) concurrently with clean shutdown.
 */
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { ensureBackendEnv } from './ensure-env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const backendDir = path.join(rootDir, 'backend');

console.log('====================================================');
console.log(' Starting SOMS (Backend API + Frontend Vite)');
console.log('====================================================\n');

function parseDeclaredMajor(versionSpec) {
  const match = String(versionSpec || '').trim().match(/^(?:\^|~|>=|=)?\s*(\d+)\./);
  return match ? Number(match[1]) : null;
}

function getPackagesNeedingInstall(packageJsonPath, nodeModulesDir, includeDevDependencies = false) {
  if (!existsSync(packageJsonPath)) return [];
  try {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
    const required = {
      ...(pkg.dependencies || {}),
      ...(includeDevDependencies ? pkg.devDependencies || {} : {}),
    };
    const entries = Object.entries(required);
    if (entries.length === 0) return [];

    const missingOrStale = entries
      .filter(([name, spec]) => {
        const pkgManifest = path.join(nodeModulesDir, ...name.split('/'), 'package.json');
        if (!existsSync(pkgManifest)) return true;
        const expectedMajor = parseDeclaredMajor(spec);
        if (expectedMajor === null) return false;
        try {
          const installed = JSON.parse(readFileSync(pkgManifest, 'utf8'));
          const installedMajor = parseDeclaredMajor(installed.version);
          return installedMajor !== null && installedMajor !== expectedMajor;
        } catch {
          return true;
        }
      })
      .map(([name]) => name);

    if (missingOrStale.length > 0) return missingOrStale;
    if (!existsSync(path.join(nodeModulesDir, '.package-lock.json'))) {
      return ['.package-lock.json'];
    }
    return [];
  } catch {
    return [];
  }
}

const ANSI_ESCAPE_REGEX = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

function stripAnsi(text) {
  return String(text || '').replace(ANSI_ESCAPE_REGEX, '');
}

function runNpmSync(args, cwd) {
  const npmExecPath = process.env.npm_execpath;
  if (npmExecPath && npmExecPath.endsWith('.js') && existsSync(npmExecPath)) {
    return spawnSync(process.execPath, [npmExecPath, ...args], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
  }

  if (process.platform === 'win32') {
    const comSpec = process.env.ComSpec || 'cmd.exe';
    return spawnSync(comSpec, ['/d', '/s', '/c', 'npm', ...args], {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
  }

  return spawnSync('npm', args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
  });
}

function ensureDependencies() {
  const rootNeedsInstall = getPackagesNeedingInstall(
    path.join(rootDir, 'package.json'),
    path.join(rootDir, 'node_modules'),
    true
  );

  if (rootNeedsInstall.length > 0) {
    console.log(`[SETUP] Installing missing or updated root dependencies (${rootNeedsInstall.length})...`);
    const rootInstall = runNpmSync(['install'], rootDir);
    if (rootInstall.error || rootInstall.status !== 0) {
      console.error('\x1b[31m[SETUP ERROR]\x1b[0m Failed to install root dependencies.');
      if (rootInstall.error) console.error(rootInstall.error.message);
      process.exit(rootInstall.status || 1);
    }
  }

  const backendNeedsInstall = getPackagesNeedingInstall(
    path.join(backendDir, 'package.json'),
    path.join(backendDir, 'node_modules'),
    false
  );

  if (backendNeedsInstall.length > 0) {
    console.log(`[SETUP] Installing missing or updated backend dependencies (${backendNeedsInstall.length})...`);
    const backendInstall = runNpmSync(['install'], backendDir);
    if (backendInstall.error || backendInstall.status !== 0) {
      console.error('\x1b[31m[SETUP ERROR]\x1b[0m Failed to install backend dependencies.');
      if (backendInstall.error) console.error(backendInstall.error.message);
      process.exit(backendInstall.status || 1);
    }
  }
}

ensureDependencies();
ensureBackendEnv(rootDir);

let backend = null;
let frontend = null;
let backendExited = false;
let isShuttingDown = false;
let dbNoticeMessage = '';
let dbHintMessage = '';
let dbBannerPrinted = false;
let resolveBackendReady = null;
const backendReadyPromise = new Promise((resolve) => {
  resolveBackendReady = resolve;
});

function printDatabaseActionBanner() {
  if (dbBannerPrinted || !dbNoticeMessage) return;
  dbBannerPrinted = true;
  console.error('\n\x1b[33m====================================================\x1b[0m');
  console.error('\x1b[31m [ACTION REQUIRED] PostgreSQL Is Not Connected\x1b[0m');
  console.error(`  ${dbNoticeMessage}`);
  if (dbHintMessage) console.error(`  ${dbHintMessage}`);
  console.error('  1. Check backend/.env (DB_USER, DB_PASSWORD, DB_HOST, DB_PORT).');
  console.error('  2. Confirm PostgreSQL is running locally.');
  console.error('  3. Restart "npm start" once updated (auto-setup will seed student_org_db).');
  console.error('\x1b[33m====================================================\x1b[0m\n');
}

function prefixStream(stream, prefix, isError = false, onLine = null) {
  let remainder = '';
  const write = isError ? console.error : console.log;

  stream.on('data', (chunk) => {
    remainder += chunk.toString();
    const lines = remainder.split(/\r?\n/);
    remainder = lines.pop() ?? '';
    for (const line of lines) {
      if (line.length > 0) {
        write(`${prefix} ${line}`);
        if (onLine) onLine(line);
      }
    }
  });

  stream.on('end', () => {
    if (remainder.trim().length > 0) {
      const lastLine = remainder.trimEnd();
      write(`${prefix} ${lastLine}`);
      if (onLine) onLine(lastLine);
    }
  });
}

function shutdown(exitCode = 0) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  if (resolveBackendReady) resolveBackendReady(false);
  console.log('\nStopping SOMS development servers...');
  try {
    if (backend && !backend.killed && backend.exitCode === null) backend.kill('SIGTERM');
  } catch {}
  try {
    if (frontend && !frontend.killed && frontend.exitCode === null) frontend.kill('SIGTERM');
  } catch {}
  process.exit(exitCode);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

// 1. Spawn Backend first so PostgreSQL database creation, schema, and migrations finish before Vite loads
backend = spawn(process.execPath, [path.join(backendDir, 'server.js')], {
  cwd: rootDir,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

prefixStream(backend.stdout, '\x1b[36m[BACKEND]\x1b[0m', false, (line) => {
  if (/^Server running on port \d+/.test(stripAnsi(line)) && resolveBackendReady) {
    resolveBackendReady(true);
    resolveBackendReady = null;
  }
});
prefixStream(backend.stderr, '\x1b[31m[BACKEND ERROR]\x1b[0m', true, (line) => {
  if (line.includes('[DATABASE NOTICE]')) {
    dbNoticeMessage = line.replace(/^\[DATABASE NOTICE\]\s*/, '').trim();
  } else if (line.startsWith('Hint:')) {
    dbHintMessage = line.trim();
  }
});

backend.on('error', (err) => {
  console.error('\x1b[31m[BACKEND PROCESS ERROR]\x1b[0m', err.message);
  backendExited = true;
  shutdown(1);
});

backend.on('exit', (code, signal) => {
  backendExited = true;
  if (resolveBackendReady) {
    resolveBackendReady(false);
    resolveBackendReady = null;
  }
  if (!isShuttingDown) {
    console.error(`\x1b[31m[DEV]\x1b[0m Backend stopped unexpectedly (${signal || `code ${code}`}).`);
    shutdown(code && code !== 0 ? code : 1);
  }
});

// Wait until this backend process confirms listening (or up to 30s timeout) before launching Vite
const startupTimer = setTimeout(() => {
  if (resolveBackendReady) {
    resolveBackendReady(false);
    resolveBackendReady = null;
  }
}, 30000);
const backendReady = await backendReadyPromise;
clearTimeout(startupTimer);

if (!backendReady && backendExited) {
  shutdown(1);
}

// 2. Spawn Frontend (Vite)
const viteBin = path.join(rootDir, 'node_modules', 'vite', 'bin', 'vite.js');
if (!existsSync(viteBin)) {
  console.error('\x1b[31m[FRONTEND ERROR]\x1b[0m Vite binary not found in node_modules. Run "npm install" and retry.');
  shutdown(1);
}

frontend = spawn(process.execPath, [viteBin], {
  cwd: rootDir,
  stdio: 'pipe',
  env: { ...process.env, FORCE_COLOR: '1' },
});

prefixStream(frontend.stdout, '\x1b[32m[FRONTEND]\x1b[0m', false, (line) => {
  if (/Local:\s+https?:\/\//.test(stripAnsi(line))) {
    setTimeout(printDatabaseActionBanner, 50);
  }
});
prefixStream(frontend.stderr, '\x1b[33m[FRONTEND]\x1b[0m', true);

frontend.on('error', (err) => {
  console.error('\x1b[31m[FRONTEND PROCESS ERROR]\x1b[0m', err.message);
  shutdown(1);
});

frontend.on('exit', (code, signal) => {
  if (!isShuttingDown) {
    console.error(`\x1b[33m[DEV]\x1b[0m Frontend stopped unexpectedly (${signal || `code ${code}`}).`);
    shutdown(code && code !== 0 ? code : 1);
  }
});
