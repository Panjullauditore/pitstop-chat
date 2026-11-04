import test from 'node:test';
import assert from 'node:assert/strict';
import {messageRecipient,selectRecipient,mentionSuggestions,completeMention} from '../src/lib/recipient.mjs';

const agents=[{id:'codex',name:'Codex'},{id:'deepseek',name:'DeepSeek Web'},{id:'claude',name:'Code'}];

test('selecting or switching a recipient inserts one mention and preserves the draft',()=>{
  const first=selectRecipient('Review this file',agents,'codex');
  assert.equal(first,'@Codex Review this file');
  assert.equal(messageRecipient(first,agents)?.id,'codex');
  const switched=selectRecipient(first,agents,'deepseek');
  assert.equal(switched,'@DeepSeek Web Review this file');
  assert.equal(selectRecipient(switched,agents,'deepseek'),switched);
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

test('accepting a suggestion preserves the body, completes multiword names and routes to exactly that agent',()=>{
  for(const [source,caret,id,expected] of [
    ['@co',3,'codex','@Codex '],
    ['@de hello',3,'deepseek','@DeepSeek Web hello'],
    ['Review @co later',10,'codex','@Codex Review later'],
    ['@DeepSeek Web hello',5,'codex','@Codex hello'],
    ['@DeepSeek Web review @co',24,'codex','@Codex review '],
    ['@cod later',3,'codex','@Codex later'],
    ['  @co hello',5,'codex','@Codex hello'],
  ]){
    const range=mentionSuggestions(source,caret,agents);assert.ok(range,source);
    const result=completeMention(source,agents,id,range);assert.equal(result.text,expected);
    assert.equal(messageRecipient(result.text,agents)?.id,id);assert.ok(result.caret>=0&&result.caret<=result.text.length);
  }
});

test('deleting a mention returns to all agents and typing a complete mention selects its recipient',()=>{
  assert.equal(messageRecipient('@Code hello',agents)?.id,'claude');
  assert.equal(messageRecipient('@Codex hello',agents)?.id,'codex');
  assert.equal(messageRecipient('@Cod hello',agents),undefined);
  assert.equal(messageRecipient('hello',agents),undefined);
  assert.equal(messageRecipient('',agents),undefined);
  assert.equal(messageRecipient('  @deepseek web\nhello',agents)?.id,'deepseek');
  assert.equal(messageRecipient('@CodexExtra hello',agents),undefined);
  assert.equal(messageRecipient('Ask @Codex about this',agents),undefined);
  assert.equal(messageRecipient('@Codex hello',agents.filter(agent=>agent.id!=='codex')),undefined);
  assert.equal(messageRecipient('@DeepSeek hello',agents)?.id,'deepseek');
  assert.equal(selectRecipient('@DeepSeek hello',agents,'broadcast'),'hello');
  assert.equal(selectRecipient('@DeepSeek hello',agents,'codex'),'@Codex hello');
});
