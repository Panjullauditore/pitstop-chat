import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = dirname(fileURLToPath(import.meta.url));
const frontendPort = process.env.ROOM_PORT || '4317';
const backendPort = process.env.ROOM_BACKEND_PORT || '4318';

console.log(`Memulai Pitlane (Backend: ${backendPort}, Frontend: ${frontendPort})...`);

const backend = spawn(process.execPath, [join(dir, 'server.mjs')], {
  cwd: dir,
  env: { ...process.env, ROOM_PORT: backendPort, FRONTEND_PORT: frontendPort },
  stdio: 'inherit'
});

const nextBin = join(dir, 'node_modules', 'next', 'dist', 'bin', 'next');
const frontend = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', frontendPort], {
  cwd: dir,
  env: { ...process.env, ROOM_PORT: frontendPort, ROOM_BACKEND_PORT: backendPort },
  stdio: 'inherit'
});

function cleanup() {
  try { backend.kill(); } catch {}
  try { frontend.kill(); } catch {}
  process.exit(0);
}

backend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Backend process exited with code ${code}`);
  }
});

frontend.on('exit', (code) => {
  if (code !== 0 && code !== null) {
    console.error(`Frontend process exited with code ${code}`);
  }
});

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);
