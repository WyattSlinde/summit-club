import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdir, writeFile } from 'node:fs/promises';
import { JSDOM } from 'jsdom';
import { pathToFileURL, fileURLToPath } from 'node:url';
import path from 'node:path';

test('trail UI saves an actual chosen rating, shares a photo, edits its caption and removes it', async () => {
  const rootPath = fileURLToPath(new URL('../', import.meta.url));
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', { url: 'https://example.test/summit-club/', pretendToBeVisual: true });
  for (const key of ['window','document','navigator','HTMLElement','HTMLInputElement','HTMLTextAreaElement','HTMLSelectElement','HTMLButtonElement','Node','Element','Event','MouseEvent','CustomEvent','MutationObserver','NodeFilter','getComputedStyle','FormData']) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key] });
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.location = dom.window.location;
  globalThis.requestAnimationFrame = callback => setTimeout(callback, 0); globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.IntersectionObserver = class { constructor(callback) { this.callback = callback; } observe() { queueMicrotask(() => this.callback([{ isIntersecting: true }])); } disconnect() {} };
  globalThis.matchMedia = window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  const originalCreate = URL.createObjectURL, originalRevoke = URL.revokeObjectURL;
  URL.createObjectURL = () => 'blob:trail-photo-test'; URL.revokeObjectURL = () => {};
  const output = path.join(rootPath, 'outputs/trail-component-test.mjs'); await mkdir(path.dirname(output), { recursive: true });
  const { outputFiles } = await build({ entryPoints: [path.join(rootPath, 'app/trail-community.tsx')], bundle: true, write: false, format: 'esm', platform: 'node', packages: 'external', jsx: 'automatic', loader: { '.css': 'empty' }, define: { 'import.meta.env.BASE_URL': '"/summit-club/"' }, plugins: [{ name: 'trail-test-dependencies', setup(builder) {
    builder.onResolve({ filter: /(?:@\/lib\/cloud-client|\.\/cloud-client)$/ }, () => ({ path: path.join(rootPath, 'tests/fixtures/trail-cloud.mjs'), external: true }));
    builder.onResolve({ filter: /^next\/link$/ }, () => ({ path: path.join(rootPath, 'preview/link.tsx') }));
    builder.onLoad({ filter: /lib\/hike-photo\.ts$/ }, async args => {
      const { readFile } = await import('node:fs/promises');
      const source = await readFile(args.path, 'utf8');
      const start = source.indexOf('export async function prepareHikePhoto('), end = source.indexOf('export async function removeHikePhoto(');
      return { contents: source.slice(0,start) + 'export async function prepareHikePhoto(file: File): Promise<Blob> { return new Blob(["prepared"], { type: "image/jpeg" }); }\n' + source.slice(end), loader: 'ts' };
    });
  } }] });
  await writeFile(output, outputFiles[0].text);
  const { createElement, act } = await import('react'); const { createRoot } = await import('react-dom/client');
  const { default: TrailCommunity } = await import(pathToFileURL(output).href);
  const { calls, listeners } = await import('./fixtures/trail-cloud.mjs');
  const root = createRoot(document.getElementById('root'));
  async function settle(task = () => {}) { await act(async () => { await task(); await new Promise(resolve => setTimeout(resolve, 25)); }); }
  const buttons = () => [...document.querySelectorAll('button')];
  async function click(text) { const button = buttons().find(b => b.textContent.trim() === text); assert.ok(button, `button: ${text}`); await settle(() => button.click()); }
  async function change(element, value) { assert.ok(element); await settle(() => { const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new Event(element.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true })); }); }
  const account = { signedIn: true, member: { name: 'Taylor', grade: '11', interest: 'Explore' }, leader: false, votes: [], myVotes: [], proposals: [], events: [], rsvps: [] };
  try {
    await settle(() => root.render(createElement(TrailCommunity, { account })));
    await settle(() => { for (const listener of listeners) listener('INITIAL_SESSION', { user: { id: '10000000-0000-4000-8000-000000000001' } }); });
    await click('Rate this hike');
    await settle(() => { for (const listener of listeners) listener('SIGNED_IN', { user: { id: '10000000-0000-4000-8000-000000000001' } }); });
    assert.ok(document.querySelector('input[name="stars"]'), 'Same-account refresh keeps the rating form open.');
    const fifthStar = document.querySelector('input[name="stars"][value="5"]'); await settle(() => fifthStar.click());
    await settle(() => document.querySelector('input[name="hiked"]').click());
    await click('Save my rating');
    assert.equal(calls.findLast(c => c.operation === 'rate').payload.stars, 5);
    assert.equal(calls.findLast(c => c.operation === 'rate').payload.hiked, true);
    assert.match(document.body.textContent, /Your rating · 5/);
    await click('Add a hike photo');
    const file = document.querySelector('input[type="file"]');
    await settle(() => { Object.defineProperty(file, 'files', { configurable: true, value: [new dom.window.File(['photo'], 'trail.jpg', { type: 'image/jpeg' })] }); file.dispatchEvent(new Event('change', { bubbles: true })); });
    await change(document.querySelector('select[name="hike_id"]'), 'cowles-mountain');
    await change(document.querySelector('textarea[name="caption"]'), 'The best part was the company.');
    await change(document.querySelector('input[name="alt_text"]'), 'Friends enjoying the view from a rocky summit');
    await settle(() => document.querySelector('input[name="consent"]').click());
    await click('Share with the crew');
    const upload = calls.findLast(c => c.operation === 'upload'); assert.equal(upload.bucket, 'hike-photos'); assert.equal(upload.options.upsert, false);
    assert.equal(calls.findLast(c => c.operation === 'photo_draft').payload.consent, true);
    assert.match(document.body.textContent, /The best part was the company/);
    await click('Edit caption'); await change(document.querySelector('textarea[name="caption"]'), 'Our favorite view.'); await click('Save caption');
    assert.match(document.body.textContent, /Our favorite view/);
    await click('Remove'); await click('Remove photo'); assert.equal(calls.findLast(c => c.operation === 'photo_delete').payload.id, calls.findLast(c => c.operation === 'photo_draft').payload.id);
    assert.doesNotMatch(document.body.textContent, /Our favorite view/);
    await settle(() => { for (const listener of listeners) listener('SIGNED_OUT'); root.render(createElement(TrailCommunity, { account: { ...account, signedIn: false, member: null } })); });
    assert.equal(document.querySelectorAll('.trail-photo-card').length, 0);
  } finally { await act(async () => root.unmount()); dom.window.close(); URL.createObjectURL = originalCreate; URL.revokeObjectURL = originalRevoke; }
});
