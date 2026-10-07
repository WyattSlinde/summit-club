import test from 'node:test';
import assert from 'node:assert/strict';
import { signInFor, readSignInIntent, signInForVote, readVoteIntent } from '../lib/signin-intent.ts';

test('sign-in returns to the requested club action using a fixed local path', () => {
  for(const intent of ['join','idea']) {
    const href=new URL(signInFor(intent),'https://summit.example');
    assert.equal(href.pathname,'/signin-with-chatgpt');
    const returnTo=new URL(href.searchParams.get('return_to'),'https://summit.example');
    assert.equal(returnTo.origin,'https://summit.example');
    assert.equal(returnTo.pathname,intent==='join'?'/register/':'/members/');
    assert.equal(readSignInIntent(returnTo.search),intent==='join'?null:intent);
    assert.equal(returnTo.hash,intent==='join'?'':'#board');
  }
  assert.equal(readSignInIntent('?afterSignIn=leader'),null);
  assert.equal(readSignInIntent('?afterSignIn=https://other.example'),null);
});

test('vote sign-in returns to the selected outing for explicit confirmation', () => {
  for (const outing of ['ridge', 'coast', 'wild']) {
    const href = new URL(signInForVote(outing), 'https://summit.example');
    assert.equal(href.pathname, '/signin-with-chatgpt');
    assert.deepEqual([...href.searchParams.keys()], ['return_to']);
    const returnPath = href.searchParams.get('return_to');
    assert.equal(returnPath, `/members/?afterSignIn=vote&outing=${outing}#expeditions`);
    const destination = new URL(returnPath, 'https://summit.example');
    assert.equal(destination.origin, 'https://summit.example');
    assert.equal(destination.pathname, '/members/');
    assert.equal(destination.hash, '#expeditions');
    assert.equal(readVoteIntent(destination.search), outing);
    assert.equal(readSignInIntent(destination.search), null);
    assert.equal(destination.searchParams.has('selected'), false, 'the return only restores context, not a submitted vote');
  }
});

test('vote sign-in rejects targets that could alter the fixed destination', () => {
  for (const outing of ['', 'unknown', 'Coast', ' coast', 'coast ', '/coast', 'https://other.example', '//other.example', 'coast&return_to=https://other.example', 'coast#home', 'coast%26outing%3Dridge', null, undefined]) {
    assert.throws(() => signInForVote(outing), { name: 'RangeError', message: 'Choose a listed outing.' });
  }
});

test('vote return ignores unrelated query data and rejects ambiguous or malformed intents', () => {
  assert.equal(readVoteIntent('?journey=grand-reveal&afterSignIn=vote&outing=coast'), 'coast');
  assert.equal(readVoteIntent('?afterSignIn=vote&outing=coast&return_to=https%3A%2F%2Fother.example'), 'coast');
  for (const search of [
    '', '?outing=coast', '?afterSignIn=vote', '?afterSignIn=join&outing=coast', '?afterSignIn=idea&outing=coast',
    '?afterSignIn=vote&outing=unknown', '?afterSignIn=vote&outing=Coast', '?afterSignIn=vote&outing=%20coast',
    '?afterSignIn=vote&outing=coast&outing=ridge', '?afterSignIn=vote&outing=coast&outing=coast',
    '?afterSignIn=vote&afterSignIn=join&outing=coast', '?afterSignIn=vote&afterSignIn=vote&outing=coast',
    '?afterSignIn=vote&outing=https%3A%2F%2Fother.example', '?afterSignIn=vote&outing=coast%26outing%3Dridge',
    '?afterSignIn=vote&outing=coast%23home', '?afterSignIn=vote&outing=%E0%A4%A', '?afterSignIn=%&outing=coast',
  ]) assert.equal(readVoteIntent(search), null, search);
});
