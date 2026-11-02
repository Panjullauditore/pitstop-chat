// Explicit opt-in smoke test. Calls real CLI accounts; does not touch user chats.
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomInt } from 'node:crypto';
import sharp from 'sharp';
import { runAgent, detectAgents } from '../adapters.mjs';

const directory = await mkdtemp(join(tmpdir(), 'pitlane-vision-'));
try {
  const code = String(randomInt(10000, 99999));
  const file = join(directory, 'sample.jpg');
  await sharp(Buffer.from(`<svg width="700" height="420" xmlns="http://www.w3.org/2000/svg"><rect width="700" height="420" fill="white"/><text x="60" y="100" font-size="72" font-family="Arial" fill="black">${code}</text><circle cx="150" cy="265" r="65" fill="#ff0000"/><rect x="310" y="200" width="130" height="130" fill="#0000ff"/></svg>`)).jpeg({quality:95}).toFile(file);
  const definitions = detectAgents();
  for (const agent of process.argv.slice(2).length ? process.argv.slice(2) : ['codex','antigravity']) {
    if (!definitions[agent]?.installed) { console.log(`${agent}: CLI not installed`); continue; }
    try {
      const reply = await runAgent(agent, 'Inspect the attached image. Reply with the five digit number printed in the image and identify both colored shapes. Do not guess. Do not use shell commands. You may use view_file only to read the explicitly attached image. Reply in one sentence.', {cwd:directory,definitions,images:[{path:file,name:'sample.jpg',mimeType:'image/jpeg'}],timeoutMs:90_000});
      const pass = reply.includes(code) && /red|merah/i.test(reply) && /blue|biru/i.test(reply) && /circle|lingkaran/i.test(reply) && /square|persegi/i.test(reply);
      console.log(JSON.stringify({agent,pass,reply}));
      if (!pass) process.exitCode=1;
    } catch (error) { console.log(JSON.stringify({agent,pass:false,error:error.message})); process.exitCode=1; }
  }
} finally { await rm(directory,{recursive:true,force:true}); }
