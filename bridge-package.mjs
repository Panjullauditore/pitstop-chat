import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import JSZip from 'jszip';

// Only distributable extension sources; never include pairing grants or app data.
export const BRIDGE_PACKAGE_FILES=Object.freeze([
  'manifest.json','background.js','content.js','page-hook.js','deepseek-dom.js',
  'app-worker.js','app-content.js','site-connect.js','popup.html','popup.js','popup.css','README.md',
]);

export async function buildBridgePackage(directory){
  const files=await Promise.all(BRIDGE_PACKAGE_FILES.map(async name=>[name,await readFile(join(directory,name))]));
  const manifest=JSON.parse(files.find(([name])=>name==='manifest.json')[1].toString('utf8'));
  if(!/^\d+(\.\d+){1,3}$/.test(manifest.version))throw new Error('Invalid bridge package version.');
  const archive=new JSZip();
  for(const [name,bytes] of files)archive.file('pitstop-bridge/'+name,bytes);
  return {filename:`pitstop-bridge-${manifest.version}.zip`,bytes:await archive.generateAsync({type:'nodebuffer',compression:'DEFLATE'})};
}
