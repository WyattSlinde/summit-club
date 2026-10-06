import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeFriendTag, validFriendTag, accountReturn, initials } from '../lib/member-profile.ts';
import { prepareProfilePhoto } from '../lib/profile-photo.ts';

test('friend tags normalize but never accept names, paths or partial tags', () => {
  assert.equal(normalizeFriendTag(' sum-1a2b3c4d5e '), 'SUM-1A2B3C4D5E');
  assert.equal(validFriendTag(' sum-1a2b3c4d5e '), true);
  for (const value of ['Taylor', 'SUM-', 'SUM-1A2B', 'SUM-1A2B3C4D5E6', 'SUM-1A2B3C4D5G', '../profile', '<script>']) assert.equal(validFriendTag(value), false);
  assert.equal(initials('  Taylor Outside '), 'TO');
});
test('account links return only to fixed club actions and never accept external destinations', () => {
  assert.equal(accountReturn('?intent=idea'), '/?afterSignIn=idea#board');
  assert.equal(accountReturn('?intent=vote&outing=coast'), '/?afterSignIn=vote&outing=coast#expeditions');
  for (const query of ['?return_to=https://evil.test', '?intent=vote&outing=https://evil.test', '?intent=vote&outing=coast&outing=ridge', '?intent=idea&intent=vote', '']) assert.equal(accountReturn(query), null);
});
test('photo processing rejects oversized files and active image formats before decoding', async () => {
  for (const type of ['image/svg+xml', 'text/html', 'image/gif', 'application/octet-stream']) await assert.rejects(prepareProfilePhoto(new File(['anything'], 'upload', { type })), /JPG, PNG, or WebP/);
  await assert.rejects(prepareProfilePhoto(new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'huge.jpg', { type: 'image/jpeg' })), /smaller than 10 MB/);
});
