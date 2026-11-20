/**
 * Shared Environment Bootstrapper (`scripts/ensure-env.js`)
 *
 * Ensures `backend/.env` exists by copying `backend/.env.example` when missing.
 * Safe and non-destructive: never overwrites an existing `backend/.env`.
 */
import { copyFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_ROOT_DIR = path.resolve(__dirname, '..');

export function ensureBackendEnv(rootDir = DEFAULT_ROOT_DIR) {
  const backendDir = path.join(rootDir, 'backend');
  const envPath = path.join(backendDir, '.env');
  const envExamplePath = path.join(backendDir, '.env.example');

  if (!existsSync(envPath) && existsSync(envExamplePath)) {
    copyFileSync(envExamplePath, envPath);
    console.log(
      '[SETUP] Created backend/.env from backend/.env.example (update DB_USER / DB_PASSWORD if your PostgreSQL credentials differ).'
    );
    return { envPath, created: true };
  }

  return { envPath, created: false };
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename)) {
  ensureBackendEnv();
}
