import test from 'node:test';
import assert from 'node:assert/strict';
import { signInFor, readSignInIntent } from '../lib/signin-intent.ts';

test('sign-in returns to the requested club action using a fixed local path', () => {
  for(const intent of ['join','idea']) {
    const href=new URL(signInFor(intent),'https://summit.example');
    assert.equal(href.pathname,'/signin-with-chatgpt');
    const returnTo=new URL(href.searchParams.get('return_to'),'https://summit.example');
    assert.equal(returnTo.origin,'https://summit.example');
    assert.equal(readSignInIntent(returnTo.search),intent);
    assert.equal(returnTo.hash,intent==='join'?'#basecamp':'#board');
  }
  assert.equal(readSignInIntent('?afterSignIn=leader'),null);
  assert.equal(readSignInIntent('?afterSignIn=https://other.example'),null);
});
