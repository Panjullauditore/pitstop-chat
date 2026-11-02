import test from 'node:test';
import assert from 'node:assert/strict';
import {messageRecipient,selectRecipient} from '../src/lib/recipient.mjs';

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
