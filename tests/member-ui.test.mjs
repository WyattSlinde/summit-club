import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

// DOM component tests, not browser automation or inspection of a running site.
test('member controls save a profile, photo, friend request and clear private data on sign-out', async () => {
  const rootPath = fileURLToPath(new URL('../', import.meta.url));
  const dom = new JSDOM('<!doctype html><html><body><div id="test-root"></div></body></html>', { url: 'https://example.test/summit-club/profile/', pretendToBeVisual: true });
  for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLButtonElement','Node','Element','Event','MouseEvent','CustomEvent','MutationObserver','getComputedStyle']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.location = dom.window.location;
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0); globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  globalThis.matchMedia = window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:member-photo-test'; URL.revokeObjectURL = () => {};
  const output = path.join(rootPath, 'outputs/member-component-test.mjs'); await mkdir(path.dirname(output), { recursive: true });
  const { outputFiles } = await build({ entryPoints: [path.join(rootPath, 'app/profile/profile.tsx')], bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env.BASE_URL': '"/summit-club/"' }, plugins: [{ name: 'member-test-dependencies', setup(builder) {
    builder.onResolve({ filter: /(?:@\/lib\/cloud-client|\.\/cloud-client)$/ }, () => ({ path: path.join(rootPath, 'tests/fixtures/member-cloud.mjs'), external: true }));
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(rootPath, 'preview/link.tsx') }));
    builder.onResolve({ filter: /profile-photo$/ }, () => ({ path: 'photo-fixture', namespace: 'photo' }));
    builder.onLoad({ filter: /.*/, namespace: 'photo' }, () => ({ contents: 'export async function prepareProfilePhoto(file) { return new Blob(["prepared"], { type: "image/jpeg" }); }', loader: 'js' }));
  } }] });
  await writeFile(output, outputFiles[0].text);
  const { createElement, act } = await import('react');
  const { createRoot } = await import('react-dom/client');
  const { default: MemberProfile } = await import(pathToFileURL(output).href);
  const { calls } = await import('./fixtures/member-cloud.mjs');
  const root = createRoot(document.getElementById('test-root'));
  async function settle(task = () => {}) { await act(async () => { await task(); await new Promise(resolve => setTimeout(resolve, 20)); }); }
  const buttons = () => [...document.querySelectorAll('button')];
  async function click(text) { const button = buttons().find(b => b.textContent.trim() === text); assert.ok(button, `button: ${text}`); await settle(() => button.click()); }
  async function change(element, value) { assert.ok(element); await settle(() => { const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new Event('input', { bubbles: true })); }); }
  try {
    await settle(() => root.render(createElement(MemberProfile)));
    assert.match(document.body.textContent, /Taylor/);
    const [bio, wants] = document.querySelectorAll('textarea');
    await change(bio, 'New to hiking; bringing snacks.'); await change(wants, 'A sunrise hike with friends.');
    await change(document.querySelector('input[autocomplete="nickname"]'), 'Taylor Outside');
    await click('Save my profile');
    const saved = calls.findLast(c => c.operation === 'save_profile');
    assert.equal(saved.payload.bio, 'New to hiking; bringing snacks.'); assert.equal(saved.payload.wants, 'A sunrise hike with friends.'); assert.equal(saved.payload.display_name, 'Taylor Outside');
    assert.match(document.body.textContent, /Profile saved/);
    const fileInput = document.querySelector('input[type="file"]');
    await settle(() => { Object.defineProperty(fileInput, 'files', { configurable: true, value: [new dom.window.File(['photo'], 'photo.jpg', { type: 'image/jpeg' })] }); fileInput.dispatchEvent(new Event('change', { bubbles: true })); });
    assert.match(document.body.textContent, /Preview your crop/);
    await click('Save photo');
    const upload = calls.find(c => c.operation === 'upload'); assert.equal(upload.bucket, 'member-photos'); assert.equal(upload.options.contentType, 'image/jpeg'); assert.ok(upload.path.endsWith('/avatar.jpg'));
    await click('Privacy & account');
    const shared = document.querySelector('input[value="friends"]'); await settle(() => shared.click());
    const requests = document.querySelector('.member-switch input'); await settle(() => requests.click());
    await click('Save privacy settings');
    assert.equal(calls.findLast(c => c.operation === 'save_profile').payload.visibility, 'friends'); assert.equal(calls.findLast(c => c.operation === 'save_profile').payload.accepting_requests, true);
    const crewButton = buttons().find(b => b.textContent.includes('My crew')); await settle(() => crewButton.click());
    await change(document.querySelector('.member-add-friend input'), 'SUM-AA11BB22CC'); await click('Send request');
    assert.equal(calls.findLast(c => c.operation === 'friend').payload.tag, 'SUM-AA11BB22CC');
    await click('Accept'); assert.match(document.body.textContent, /now friends/); assert.match(document.body.textContent, /A coastal cleanup/);
    await click('Remove friend'); assert.match(document.body.textContent, /Every crew starts with one friend/);
    await click('Sign out'); assert.doesNotMatch(document.body.textContent, /Taylor Outside/); assert.match(document.body.textContent, /Create account/);
  } finally { await act(async () => root.unmount()); dom.window.close(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});
