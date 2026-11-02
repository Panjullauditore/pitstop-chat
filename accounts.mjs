import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { terminateTree } from './adapters.mjs';

export function accountIdentity(value) {
  const email = value?.email || value?.account?.email || value?.user?.email || value?.command?.data?.email || value?.command?.data?.user?.email;
  return { email: typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email.slice(0, 254) : null };
}
export function codexRequest(definition, method, params = {}) {
  if (!definition?.installed) return Promise.reject(new Error('Codex CLI belum ditemukan.'));
  return new Promise((resolve, reject) => {
    const child = spawn(definition.command, [definition.script, 'app-server', '--stdio'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
    let done = false;
    const timer = setTimeout(() => void finish(new Error('Pemeriksaan akun Codex melewati batas waktu.')), 20000);
    async function finish(error, value) {
      if (done) return; done = true; clearTimeout(timer); child.stdin.end(); await terminateTree(child);
      error ? reject(error) : resolve(value);
    }
    const send = value => child.stdin.write(JSON.stringify(value) + '\n');
    child.stdin.on('error', () => {}); child.stderr.resume();
    child.once('error', error => void finish(error));
    child.once('close', () => { if (!done) void finish(new Error('Codex berhenti sebelum akun diperiksa.')); });
    createInterface({ input: child.stdout }).on('line', line => {
      let message; try { message = JSON.parse(line); } catch { return; }
      if (done) return;
      if (message.error) return void finish(new Error(message.error.message || 'Akun gagal diperiksa.'));
      if (message.id === 1) { send({ method: 'initialized' }); send({ id: 2, method, params }); }
      if (message.id === 2) void finish(null, message.result);
    });
    send({ id: 1, method: 'initialize', params: { clientInfo: { name: 'pitlane_accounts', version: '2.1.0' }, capabilities: { experimentalApi: true } } });
  });
}
export function readClaudeAccount(definition) {
  if (!definition?.installed) return Promise.reject(new Error('Claude CLI belum ditemukan.'));
  return new Promise((resolve, reject) => {
    const child = spawn(definition.command, [...(definition.script ? [definition.script] : []), 'auth', 'status'], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '', done = false;
    const finish = (error, value) => { if (done) return; done = true; clearTimeout(timer); error ? reject(error) : resolve(value); };
    const timer = setTimeout(() => { void terminateTree(child); finish(new Error('Pemeriksaan akun Claude melewati batas waktu.')); }, 15000);
    child.once('error', error => finish(error)); child.stderr.resume(); child.stdout.setEncoding('utf8');
    child.stdout.on('data', chunk => { output += chunk; if (output.length > 100000) { void terminateTree(child); finish(new Error('Respons akun terlalu besar.')); } });
    child.once('close', code => {
      if (done) return;
      try { const data = JSON.parse(output); if (code !== 0 || !data.loggedIn) throw new Error('Claude belum login. Jalankan claude auth login.'); finish(null, accountIdentity(data)); }
      catch (error) { finish(new Error(error instanceof SyntaxError ? 'Status akun Claude tidak dikenali.' : error.message)); }
    });
  });
}
