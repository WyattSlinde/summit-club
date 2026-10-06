import { spawn } from 'node:child_process';
import { access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const directory = fileURLToPath(new URL('..', import.meta.url));
const address = 'http://127.0.0.1:4173/';
const checkOnly = process.argv.includes('--check');
const noOpen = process.argv.includes('--no-open');

async function inspect() {
  try {
    const response = await fetch(address, { signal: AbortSignal.timeout(2500) });
    const html = await response.text();
    if (response.ok && html.includes('SUMMIT Basecamp')) return 'ready';
    return 'occupied';
  } catch (error) {
    return error?.cause?.code === 'ECONNREFUSED' ? 'stopped' : 'waiting';
  }
}

function showSite() {
  console.log(`\nSUMMIT is ready: ${address}\n`);
  if (!noOpen && !checkOnly && process.platform === 'darwin') {
    const opener = spawn('/usr/bin/open', [address], { stdio: 'ignore' });
    opener.on('error', () => console.log('Open the address above in your browser.'));
  }
}

const initial = await inspect();
if (checkOnly) {
  console.log(`SUMMIT preview: ${initial} (${address})`);
  process.exit(initial === 'ready' ? 0 : 1);
}
if (initial === 'ready') {
  showSite();
  console.log('The existing server is already running.');
  process.exit(0);
}
if (initial === 'occupied') {
  console.error('Port 4173 is responding with a different page or an error. No process was stopped.');
  process.exit(1);
}
try {
  await access(new URL('../node_modules/vinext/dist/cli.js', import.meta.url));
} catch {
  console.error('Dependencies are missing. Run npm ci in the summit folder, then open Start SUMMIT.command again.');
  process.exit(1);
}

console.log('Starting SUMMIT. Keep this terminal open while using the local site.');
const server = spawn(process.execPath, ['scripts/run-framework.mjs', 'dev'], { cwd: directory, stdio: 'inherit' });
let ended = false;
const stop = () => { if (!ended) server.kill('SIGTERM'); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('error', error => { ended = true; console.error(`Could not start SUMMIT: ${error.message}`); process.exitCode = 1; });
server.on('exit', code => { ended = true; process.exitCode = code ?? 1; });
for (let attempt = 0; attempt < 45 && !ended; attempt++) {
  await new Promise(resolve => setTimeout(resolve, 800));
  if (await inspect() === 'ready') { showSite(); break; }
  if (attempt === 44) console.error('The site has not become ready yet. Check the server output above; the server has been left running.');
}
