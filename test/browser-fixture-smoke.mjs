// Exercises a real Chromium process against intercepted fixture pages only.
// No DeepSeek account or network is used, and no Pitlane user data is touched.
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright-core';
import {DeepSeekBrowserBridge} from '../deepseek-browser.mjs';

const directory=await mkdtemp(join(tmpdir(),'pitlane-browser-fixture-'));
const sent=[];
const bridge=new DeepSeekBrowserBridge({directory,timeout:10000,launch:async(profile,options)=>{
  const context=await chromium.launchPersistentContext(profile,{...options,headless:true});
  await context.route('https://chat.deepseek.com/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;
    if(path==='/api/v0/chat/completion'){
      sent.push(JSON.parse(request.postData()).prompt);
      const events=[{v:{response:{fragments:[{type:'RESPONSE',content:'Fixture browser reply'}]}}},{p:'response/status',o:'SET',v:'FINISHED'}];
      return route.fulfill({contentType:'text/event-stream',body:events.map(event=>'data: '+JSON.stringify(event)+'\n\n').join('')});
    }
    return route.fulfill({contentType:'text/html',body:`<!doctype html><textarea></textarea><script>
      localStorage.setItem('userToken','fixture-only');
      document.querySelector('textarea').addEventListener('keydown',async event=>{
        if(event.key==='Enter'){event.preventDefault();const response=await fetch('/api/v0/chat/completion',{method:'POST',body:JSON.stringify({prompt:event.target.value})});await response.text();}
      });
    </script>`});
  });
  return context;
}});
try{
  assert.equal((await bridge.open()).status,'ready');
  const updates=[];
  assert.equal(await bridge.run('Fixture Soul and project context',{onDelta:text=>updates.push(text)}),'Fixture browser reply');
  assert.deepEqual(sent,['Fixture Soul and project context']);assert.deepEqual(updates,['Fixture browser reply']);
  assert.equal(bridge.snapshot().status,'ready');
  console.log('PASS: real browser filled the editor, sent through the page, and returned streamed answer text. Fixture only; not a real DeepSeek-account test.');
}finally{await bridge.close();assert.ok(directory.startsWith(join(tmpdir(),'pitlane-browser-fixture-')));await rm(directory,{recursive:true,force:true});}
