import { spawn } from 'node:child_process';
import { openSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const frontendPort = Number(process.env.ROOM_PORT || 4317);
const backendPort = Number(process.env.ROOM_BACKEND_PORT || 4318);

const frontendUrl = `http://127.0.0.1:${frontendPort}`;
const backendUrl = `http://127.0.0.1:${backendPort}`;

async function isBackendReady() {
  try {
    const res = await fetch(`${backendUrl}/api/bootstrap`, { signal: AbortSignal.timeout(1000) });
    const data = await res.json();
    return Boolean(data.token && data.state?.agents);
  } catch {
    return false;
  }
}

async function isFrontendReady() {
  try {
    const res = await fetch(`${frontendUrl}/api/bootstrap`, { signal: AbortSignal.timeout(1000) });
    const data = await res.json();
    return Boolean(data.token && data.state?.agents);
  } catch {
    return false;
  }
}

// 1. Start Backend if not ready
if (!await isBackendReady()) {
  const out = openSync(join(directory, 'server.log'), 'a');
  const err = openSync(join(directory, 'server-error.log'), 'a');
  const backendProc = spawn(process.execPath, [join(directory, 'server.mjs')], {
    cwd: directory,
    env: { ...process.env, ROOM_PORT: String(backendPort), FRONTEND_PORT: String(frontendPort) },
    windowsHide: true,
    detached: true,
    stdio: ['ignore', out, err]
  });
  backendProc.unref();

  for (let i = 0; i < 30 && !await isBackendReady(); i++) {
    await new Promise(r => setTimeout(r, 200));
  }
}

if (!await isBackendReady()) {
  console.error('Backend belum berjalan. Periksa server-error.log.');
  process.exitCode = 1;
} else {
  // 2. Start Next.js Frontend if not ready
  if (!await isFrontendReady()) {
    const nextBin = join(directory, 'node_modules', 'next', 'dist', 'bin', 'next');
    const out = openSync(join(directory, 'server.log'), 'a');
    const err = openSync(join(directory, 'server-error.log'), 'a');
    
    const frontendProc = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(frontendPort)], {
      cwd: directory,
      env: { ...process.env, ROOM_PORT: String(frontendPort), ROOM_BACKEND_PORT: String(backendPort) },
      windowsHide: true,
      detached: true,
      stdio: ['ignore', out, err]
    });
    frontendProc.unref();

    for (let i = 0; i < 40 && !await isFrontendReady(); i++) {
      await new Promise(r => setTimeout(r, 250));
    }
  }

  if (!await isFrontendReady()) {
    console.error('Frontend AI Room belum siap. Periksa server-error.log.');
    process.exitCode = 1;
  } else {
    console.log('PITSTOP aktif: ' + frontendUrl + ' (Multiple Minds. One Team. One Goal.)');
    if (!process.argv.includes('--no-open')) {
      const child = spawn('rundll32.exe', ['url.dll,FileProtocolHandler', frontendUrl], {
        windowsHide: true,
        detached: true,
        stdio: 'ignore'
      });
      child.on('error', () => console.log('Buka alamat room di browser: ' + frontendUrl));
      child.unref();
    }
  }
}
