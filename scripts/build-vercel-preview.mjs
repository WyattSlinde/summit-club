import { build } from 'vite';
import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(root, 'outputs/vercel-preview/.vercel/output');
await build({ configFile: path.join(root, 'preview/vite.config.ts') });
await mkdir(output, { recursive: true });
// A read-only preview status, with no copied member records or fabricated votes.
await writeFile(path.join(output, 'static/preview-status.json'), JSON.stringify({
  previewOnly: true, signedIn: false, leader: false, member: null,
  votes: [], myVotes: [], proposals: [], events: [], rsvps: [],
}));
await writeFile(path.join(output, 'config.json'), JSON.stringify({ version: 3, routes: [
  { src: '/api/basecamp', methods: ['GET', 'HEAD'], dest: '/preview-status.json', headers: { 'Cache-Control': 'no-store' } },
  { src: '/api/.*', status: 503 },
  { src: '/(?:ascent-hd|ascent-motion|ridge-hd|ridge-motion)/(.*)', headers: { 'Cache-Control': 'public, max-age=86400' }, continue: true },
  { handle: 'filesystem' },
  { src: '/(?:register|leadership|signin-with-chatgpt|signout-with-chatgpt)/?', dest: '/index.html' },
] }, null, 2));
console.log(`Vercel preview ready at ${output}`);
