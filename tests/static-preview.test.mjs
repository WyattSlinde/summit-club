import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { sitePath } from '../lib/site-path.ts';

test('project previews keep media and page navigation under the project path', () => {
  for (const href of ['/ascent-hd/mobile/001.webp?v=2', '/register', '/#basecamp', '/photos/credits.txt']) {
    assert.equal(sitePath(href, '/summit-club/'), `/summit-club${href}`);
    assert.equal(sitePath(href, '/'), href);
    assert.equal(sitePath(href), href);
  }
  for (const href of ['#home', 'https://example.com/photo', '//example.com/photo', 'mailto:club@example.com']) {
    assert.equal(sitePath(href, '/summit-club/'), href);
  }
});

test('static preview exposes no account or records and rejects every write', async () => {
  const { outputFiles } = await build({
    entryPoints: [new URL('../preview/basecamp-client.ts', import.meta.url).pathname],
    bundle: true, format: 'esm', write: false,
  });
  const { basecampRequest } = await import(`data:text/javascript;base64,${Buffer.from(outputFiles[0].text).toString('base64')}`);
  const status = await basecampRequest();
  assert.equal(status.previewOnly, true);
  assert.equal(status.signedIn, false);
  assert.equal(status.leader, false);
  assert.equal(status.member, null);
  for (const field of ['votes', 'myVotes', 'proposals', 'events', 'rsvps']) assert.deepEqual(status[field], []);
  status.votes.push({ adventure_id: 'fake', count: 100 });
  assert.deepEqual((await basecampRequest()).votes, []);
  for (const method of ['POST', 'post', 'PUT', 'PATCH', 'DELETE']) {
    await assert.rejects(basecampRequest({ method }), /live club backend/);
  }
});
