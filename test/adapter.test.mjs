import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { runAgent } from '../adapters.mjs';

test('adapter Stop terminates a real child process and rejects with AbortError', async t => {
  const directory = await mkdtemp(join(tmpdir(), 'pitlane-adapter-'));
  const script = join(directory, 'waiting.mjs');
  await writeFile(script, "process.stdin.resume(); setInterval(() => {}, 1000);\n");
  t.after(async () => {
    assert.ok(resolve(directory).startsWith(resolve(tmpdir()) + '\\pitlane-adapter-') || resolve(directory).startsWith(resolve(tmpdir()) + '/pitlane-adapter-'));
    await rm(directory, { recursive: true, force: true });
  });
  const controller = new AbortController();
  const pending = runAgent('codex', 'test', { cwd: directory, signal: controller.signal,
    definitions: { codex:{ installed:true, command:process.execPath, script } }, timeoutMs:5000 });
  setTimeout(() => controller.abort(), 150);
  await assert.rejects(pending, error => error.name === 'AbortError');
});

test('missing executable is reported honestly without generating a reply', async () => {
  await assert.rejects(runAgent('codex', 'hello', { definitions:{ codex:{ installed:false } } }), /belum ditemukan/);
});
