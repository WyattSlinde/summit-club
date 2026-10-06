import { writeFile } from 'node:fs/promises';
const args = process.argv.slice(2);
function value(flag) { const index = args.indexOf(flag); return index < 0 ? '' : args[index + 1] || ''; }
const url = value('--url'), publishableKey = value('--key'), authReady = args.includes('--auth-ready');
if (!/^https:\/\/[a-z0-9]{20}\.supabase\.co$/.test(url)) throw new Error('Provide the dedicated SUMMIT project URL with --url.');
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) throw new Error('Provide a modern publishable key with --key. Secret and service-role keys are never accepted.');
await writeFile(new URL('../lib/cloud-config.json', import.meta.url), JSON.stringify({ url, publishableKey, authReady }, null, 2) + '\n');
console.log(`SUMMIT public backend configuration saved. Email signup ${authReady ? 'enabled after operator verification' : 'remains disabled until email delivery is verified'}.`);
