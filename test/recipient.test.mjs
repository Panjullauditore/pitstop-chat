import test from 'node:test';
import assert from 'node:assert/strict';
import {messageRecipients,selectRecipient,mentionSuggestions,completeMention} from '../src/lib/recipient.mjs';

const agents=[{id:'codex',name:'Codex'},{id:'deepseek',name:'DeepSeek Web'},{id:'claude',name:'Code'}];
const ids=text=>messageRecipients(text,agents).map(agent=>agent.id);

test('chips toggle individual mentions and Team clears them while preserving the draft',()=>{
  const first=selectRecipient('Review this file',agents,'codex');
  assert.equal(first,'@Codex Review this file');
  assert.deepEqual(ids(first),['codex']);
  const switched=selectRecipient(first,agents,'deepseek');
  assert.equal(switched,'@DeepSeek Web @Codex Review this file');
  assert.equal(selectRecipient(switched,agents,'deepseek'),first);
  assert.equal(selectRecipient(switched,agents,'broadcast'),'Review this file');
});

test('mention suggestions search only available bot names and provider IDs at the caret',()=>{
  assert.equal(mentionSuggestions('@',1,agents).items.length,3);
  assert.deepEqual(mentionSuggestions('@dee',4,agents).items.map(a=>a.id),['deepseek']);
  assert.deepEqual(mentionSuggestions('Ask @co',7,agents).items.map(a=>a.id),['codex','claude']);
  assert.equal(mentionSuggestions('hello@example.com',17,agents),null);
  assert.equal(mentionSuggestions('@unknown',8,agents),null);
  assert.equal(mentionSuggestions('@Codex hello',12,agents),null);
  assert.equal(mentionSuggestions('@Codex ',7,agents),null);
  assert.equal(mentionSuggestions('@Codex',6,agents.filter(a=>a.id!=='codex')),null);
});

test('accepting a suggestion replaces the tag at the caret and keeps other tags',()=>{
  for(const [source,caret,id,expected] of [
    ['@co',3,'codex','@Codex '],
    ['@de hello',3,'deepseek','@DeepSeek Web hello'],
    ['Review @co later',10,'codex','Review @Codex later'],
    ['@DeepSeek Web hello',5,'codex','@Codex hello'],
    ['@DeepSeek Web review @co',24,'codex','@DeepSeek Web review @Codex '],
    ['@cod later',3,'codex','@Codex later'],
    ['  @co hello',5,'codex','  @Codex hello'],
  ]){
    const range=mentionSuggestions(source,caret,agents);assert.ok(range,source);
    const result=completeMention(source,agents,id,range);assert.equal(result.text,expected);
    assert.ok(ids(result.text).includes(id));assert.ok(result.caret>=0&&result.caret<=result.text.length);
  }
});

test('complete mentions work anywhere and deduplicate without matching emails or URLs',()=>{
  assert.deepEqual(ids('@Code hello'),['claude']);
  assert.deepEqual(ids('@Codex hello'),['codex']);
  assert.deepEqual(ids('@Cod hello @CodexExtra hello'),[]);
  assert.deepEqual(ids('hello'),[]);
  assert.deepEqual(ids('  @deepseek web\nhello'),['deepseek']);
  assert.deepEqual(ids('Ask (@Codex), then @DeepSeek, then @CODEX.'),['codex','deepseek']);
  assert.deepEqual(ids('email@Codex.com https://example.test/@Code'),[]);
  assert.deepEqual(ids('@DeepSeek hello'),['deepseek']);
  assert.equal(mentionSuggestions('@Codex',6,agents),null);
  const named=[{id:'codex',name:'Jerry (Codex)'},{id:'claude',name:'Nara (Claude)'}];
  assert.deepEqual(messageRecipients('Cek ya @Jerry, terus @Nara (Claude).',named).map(a=>a.id),['codex','claude']);
  assert.equal(selectRecipient('@DeepSeek hello',agents,'broadcast'),'hello');
  assert.equal(selectRecipient('@DeepSeek hello',agents,'codex'),'@Codex @DeepSeek hello');
});
