// Runs the shipped content script against an intercepted HTML fixture only.
// No real account, native App, user browser profile or network is used.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';

const browser=await chromium.launch({channel:'chrome',headless:true});
try{
  const page=await browser.newPage();
  await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><body>
    <div id="messages"><div role="article" aria-label="User message"><div data-testid="user-message-bubble"><span data-quotable="true">Older user message</span></div></div><div role="article" aria-label="Agent response"><div class="leading-relaxed select-text">Old answer must not be imported.</div></div></div>
    <div role="combobox" aria-label="Message input" contenteditable="true"></div><button aria-label="Send message">Send</button>
    <script>
      window.events=[];window.listeners=[];window.submissions=[];
      window.chrome={runtime:{onMessage:{addListener:fn=>listeners.push(fn)},sendMessage:async message=>{events.push(message);return {accepted:true};}}};
      // Simulate the asynchronous reconciliation/remount performed by Lexical.
      document.addEventListener('input',event=>{const node=event.target;if(!node.matches('[contenteditable]'))return;const text=node.textContent;node.textContent='';setTimeout(()=>{const next=node.cloneNode(false);next.textContent=text;node.replaceWith(next);},40);});
      document.querySelector('button').onclick=()=>{
        const editor=document.querySelector('[contenteditable]');submissions.push(editor.textContent);
        const user=document.createElement('div');user.setAttribute('role','article');user.setAttribute('aria-label','User message');user.innerHTML='<div data-testid="user-message-bubble"><span data-quotable="true"></span></div>';user.querySelector('span').textContent=editor.textContent;document.querySelector('#messages').append(user);editor.textContent='';
        const agent=document.createElement('div');agent.setAttribute('role','article');agent.setAttribute('aria-label','Agent response');agent.innerHTML='<div data-testid="turn-cards-container"><div class="leading-relaxed select-text">Private tool trace</div></div><div class="leading-relaxed select-text">New native answer</div>';document.querySelector('#messages').append(agent);
      };
    </script>`}));
  const chatId='native-fixture-123456';await page.goto('https://antigravity.static.usercontent.goog/web/fixture/c/'+chatId);
  await page.addScriptTag({content:await readFile(new URL('../extension/app-content.js',import.meta.url),'utf8')});
  const id='request-fixture-123456',prompt=JSON.stringify({source:'Pitlane',requestMarker:'[Pitlane request: '+id+']',contextAndTask:'First line\nSecond line\n<checkpoint>'});
  await page.evaluate(job=>{for(const fn of window.listeners)fn({action:'app-run',job},{},()=>{});},{id,chatId,prompt,images:[]});
  await page.waitForFunction(()=>window.events.some(event=>['done','error'].includes(event.kind)),{timeout:8000});
  const result=await page.evaluate(()=>({events:window.events,submissions:window.submissions}));
  assert.equal(result.submissions.length,1);assert.equal(result.submissions[0],prompt);
  assert.deepEqual(result.events.map(event=>event.kind),['sent','text','done']);assert.equal(result.events.at(-1).text,'New native answer');
  console.log('PASS: native editor reconciliation preserves all context; exactly one submission; only the new reply is imported.');
}finally{await browser.close();}
